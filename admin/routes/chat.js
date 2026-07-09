const express = require('express');
// new imports here
const router = express.Router();

const ensureAdmin = require('../middlewares/ensureAdmin');

// In-memory sessions for demo; replace with DB if you want persistence
// Remove this when you have a database
let nextSessionId = 1;
const sessions = []; // { id, title, history: [{ text, role, side }] }

router.get('/', ensureAdmin, (req, res) => {
  const activeSessionId = req.query.session ? parseInt(req.query.session) : null;
  const activeSession = sessions.find(s => s.id === activeSessionId);
  res.render('chat', {
    admin: req.session.admin,
    sessions,
    activeSessionId,
    history: activeSession ? activeSession.history : []
  });
});

// Create a new mock chat session
router.post('/sessions', ensureAdmin, (req, res) => {
  const session = { id: nextSessionId++, title: `Chat ${nextSessionId - 1}`, history: [] };
  sessions.push(session);
  res.json({ sessionId: session.id });
});

// Delete a mock chat session
router.post('/sessions/:id/delete', ensureAdmin, (req, res) => {
  const index = sessions.findIndex(s => s.id === parseInt(req.params.id));
  if (index !== -1) sessions.splice(index, 1);
  res.json({ ok: true });
});

// Simple demo API that echoes back
router.post('/api', ensureAdmin, express.json(), async (req, res) => {
  const { message, sessionId } = req.body || {};
  const text = (message || '').toString().trim();
  if (!text) return res.json({ reply: 'Please type something.' });
  const reply = `You said: ${text}`;
  // Simple demo ApexCharts bar chart configuration
  const chart = {
    chart: { type: 'bar', height: 250 },
    series: [
      {
        name: 'Demo',
        data: [10, 20, 15, 30]
      }
    ],
    xaxis: {
      categories: ['Q1', 'Q2', 'Q3', 'Q4']
    }
  };

  const session = sessions.find(s => s.id === parseInt(sessionId));
  if (session) {
    session.history.push({ text, role: 'me', side: 'right' });
    session.history.push({ text: reply, role: 'bot', side: 'left', chart });
  }

  res.json({ reply, chart });
});

module.exports = router;
