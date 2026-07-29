const express = require('express');
const pool = require('../../database');
const router = express.Router();

const ensureAdmin = require('../middlewares/ensureAdmin');
const { MariaDBChatHistory } = require('../modules/MariaDBHistory');
const { runAgent } = require('../modules/runAgent');
const { runAgentStream } = require('../modules/runAgentStream');
const { hasPendingApproval, parseDecision } = require('../modules/approval');
const { resumeAgent } = require('../modules/runAgent');


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
    const { message, sessionId, thinking } = req.body || {};
    const text = (message || '').toString().trim();
    if (!text) return res.json({ reply: 'Please type something.' });
    if (!sessionId) return res.status(400).json({ reply: 'No session selected.' });

    if (hasPendingApproval(sessionId)) {
      const decisions = parseDecision(text);
      if (!decisions) {
        return res.json({ reply: 'Please reply *yes* to approve or *no* to reject.' });
      }
      const result = await resumeAgent(sessionId, decisions);
      return res.json(result);
    }

    console.log("Running agent");
    const { reply, chart, plan, thoughts } = await runAgent(
      { input: text },
      { configurable: { sessionId } },
      thinking
    );

    res.json({ reply, chart, plan, thoughts });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ reply: 'Sorry, something went wrong.' });
  }
});

// Streaming version of POST /api: same request body, but the response is a
// Server-Sent Events stream instead of one JSON object
router.post('/api/stream', ensureAdmin, express.json(), async (req, res) => {
  const { message, sessionId, thinking } = req.body || {};
  const text = (message || '').toString().trim();

  // Validate BEFORE starting the stream, so these still come back as plain JSON
  if (!text) return res.json({ reply: 'Please type something.' });
  if (!sessionId) return res.status(400).json({ reply: 'No session selected.' });

  // From this point on, the response is an event stream
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // One SSE frame: an event line, a data line, and a blank line to end it
  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await runAgentStream(
      { input: text },
      { configurable: { sessionId } },
      thinking,
      sendEvent
    );
    sendEvent('done', result);
  } catch (error) {
    console.error('Chat stream error:', error);
    sendEvent('error', { reply: 'Sorry, something went wrong.' });
  } finally {
    res.end();
  }
});

module.exports = router;

