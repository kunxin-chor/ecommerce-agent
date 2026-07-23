const express = require('express');
const pool = require('../../database');
const router = express.Router();

const ensureAdmin = require('../middlewares/ensureAdmin');
const { MariaDBChatHistory } = require('../modules/MariaDBHistory');
const { runAgent } = require('../modules/runAgent');
const { runAgentStream, resumeAgentStream } = require('../modules/runAgentStream');
const { isApproval } = require('../modules/hitl');

// Sessions that are paused waiting for the admin to approve a tool call.
const pendingApprovals = new Map();


router.get('/', ensureAdmin, async (req, res) => {
  const adminId = req.session.admin.id;

  // Get all sessions for this admin, most recent first
  const [sessions] = await pool.execute(
    `SELECT id, title, created_at FROM chat_sessions
     WHERE admin_id = ? ORDER BY created_at DESC`,
    [adminId]
  );

  // Active session comes from ?session= query param
  let activeSessionId = req.query.session ? parseInt(req.query.session) : null;

  // If no session specified, default to the most recent one
  if (!activeSessionId && sessions.length > 0) {
    activeSessionId = sessions[0].id;
  }

  // Load messages for the active session
  let messages = [];
  if (activeSessionId) {
    const history = new MariaDBChatHistory(activeSessionId);
    const msgs = await history.getMessages();
    messages = msgs.map(m => ({
      text: m.content,
      role: m._getType() === 'human' ? 'user' : 'bot',
      side: m._getType() === 'human' ? 'right' : 'left',
      chart: m.chartConfig || null,
    }));
  }

  res.render('chat', {
    admin: req.session.admin,
    sessions,           // all conversations for the sidebar
    activeSessionId,    // which one is currently open
    history: messages   // messages for the active session
  });
});

// Create a new chat session
router.post('/sessions', ensureAdmin, express.json(), async (req, res) => {
  const adminId = req.session.admin.id;
  const title = new Date().toLocaleString();

  const [result] = await pool.execute(
    `INSERT INTO chat_sessions (admin_id, title) VALUES (?, ?)`,
    [adminId, title]
  );

  res.json({ sessionId: result.insertId });
});

// Delete a chat session and all its messages
router.post('/sessions/:id/delete', ensureAdmin, async (req, res) => {
  const adminId = req.session.admin.id;
  await pool.execute(
    `DELETE FROM chat_sessions WHERE id = ? AND admin_id = ?`,
    [req.params.id, adminId]
  );
  res.json({ success: true });
});


router.post('/api', ensureAdmin, express.json(), async (req, res) => {
  try {
    const { message, sessionId } = req.body || {};
    const text = (message || '').toString().trim();
    if (!text) return res.json({ reply: 'Please type something.' });
    if (!sessionId) return res.status(400).json({ reply: 'No session selected.' });

    console.log("Running agent with sessionId =", sessionId);
    const { reply, chart, plan } = await runAgent(
      { input: text },
      { configurable: { sessionId } }
    );

    res.json({ reply, chart, plan });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ reply: 'Sorry, something went wrong.' });
  }
});

// Alternative streaming endpoint: sends progress events as Server-Sent Events
// instead of waiting for the whole run to finish. Useful for models with
// reliable streaming support (e.g. OpenAI).
router.post('/api/stream', ensureAdmin, express.json(), async (req, res) => {
  const { message, sessionId } = req.body || {};
  const text = (message || '').toString().trim();
  if (!text) return res.json({ reply: 'Please type something.' });
  if (!sessionId) return res.status(400).json({ reply: 'No session selected.' });

  // Set up Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    // runAgentStream calls sendEvent for each plan/tool_call/tool_result event
    const result = await runAgentStream(
      { input: text },
      { configurable: { sessionId } },
      sendEvent
    );

    // Paused for approval: the needs_approval event was already sent by
    // runAgentStream. Remember the session, then end the stream — the
    // remaining progress arrives on a new stream from /api/stream/approve.
    if (result.interrupted) {
      pendingApprovals.set(sessionId.toString(), {
        userText: text,
        actionCount: result.approval.actionCount
      });
    } else {
      sendEvent('done', { reply: result.reply, chart: result.chart });
    }
  } catch (error) {
    console.error('Chat error:', error);
    sendEvent('done', { reply: 'Sorry, something went wrong.' });
  }
  res.end();
});

// Resume a run that was paused waiting for human approval of a tool call.
router.post('/api/stream/approve', ensureAdmin, express.json(), async (req, res) => {
  const { message, sessionId } = req.body || {};
  const text = (message || '').toString().trim();
  if (!sessionId) return res.status(400).json({ reply: 'No session selected.' });

  const pending = pendingApprovals.get(sessionId.toString());

  // Set up Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  if (!pending) {
    sendEvent('done', { reply: 'There is nothing waiting for approval.' });
    return res.end();
  }

  // Echo the decision so the user sees it in the progress log
  sendEvent(isApproval(text) ? 'approved' : 'rejected', {
    message: isApproval(text) ? '✅ Approved. Continuing...' : '❌ Rejected.'
  });

  try {
    const result = await resumeAgentStream({
      sessionId,
      approved: isApproval(text),
      message: text,
      userText: pending.userText,
      actionCount: pending.actionCount
    }, sendEvent);

    // Another tool call needs approval — stay in the approval flow
    if (result.interrupted) {
      pending.actionCount = result.approval.actionCount;
    } else {
      pendingApprovals.delete(sessionId.toString());
      sendEvent('done', { reply: result.reply, chart: result.chart });
    }
  } catch (error) {
    console.error('Approve error:', error);
    sendEvent('done', { reply: 'Sorry, something went wrong.' });
  }
  res.end();
});

module.exports = router;

