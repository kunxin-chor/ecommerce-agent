(function () {
  // Read server-rendered data
  let initialHistory = [];
  try {
    initialHistory = JSON.parse(document.getElementById('initialHistory').textContent) || [];
  } catch (e) {}

  let activeSessionId = null;
  try {
    activeSessionId = JSON.parse(document.getElementById('activeSessionId').textContent);
  } catch (e) {}

  // Create quikchat widget
  const chat = new quikchat('#admin-chat', async function (chatInstance, msg) {

    // If no session is active, create one automatically
    if (!activeSessionId) {
      const r = await fetch('/admin/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await r.json();
      activeSessionId = data.sessionId;
      // Update URL so refreshing keeps this session
      window.history.pushState({}, '', `/admin/chat?session=${activeSessionId}`);
    }

    // Show user message immediately
    chatInstance.messageAddNew(msg, 'me', 'right', 'user');

    // Send to backend with session ID
    let replyText = '(no reply)';
    try {
      const res = await fetch('/admin/chat/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId: activeSessionId })
      });
      const data = await res.json();
      replyText = (data && data.reply) || '(no reply)';
    } catch (err) {
      console.error('Error calling /admin/chat/api', err);
      replyText = 'Error contacting server.';
    }

    // Show bot reply
    chatInstance.messageAddNew(replyText, 'bot', 'left', 'bot');
  });

  // Seed history on page load
  if (Array.isArray(initialHistory) && initialHistory.length) {
    initialHistory.forEach(function (item) {
      if (!item.text) return;
      chat.messageAddNew(item.text, item.role, item.side, item.role);
    });
  }

  // New Chat button
  document.getElementById('newChatBtn').addEventListener('click', async () => {
    const r = await fetch('/admin/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await r.json();
    // Full page load so the sidebar refreshes
    window.location.href = `/admin/chat?session=${data.sessionId}`;
  });

  // Delete session buttons
  document.querySelectorAll('.delete-session-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const sessionId = btn.dataset.sessionId;
      await fetch(`/admin/chat/sessions/${sessionId}/delete`, { method: 'POST' });
      // If deleting the active session, go to base page
      if (parseInt(sessionId) === activeSessionId) {
        window.location.href = '/admin/chat';
      } else {
        window.location.reload();
      }
    });
  });
})();