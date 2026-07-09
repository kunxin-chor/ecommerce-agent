(function () {
  const container = document.getElementById('admin-chat');
  if (!container) {
    console.error('admin-chat container not found');
    return;
  }
  if (typeof quikchat !== 'function') {
    console.error('quikchat library not loaded');
    return;
  }

  let initialHistory = [];
  const historyScript = document.getElementById('initialHistory');
  if (historyScript && historyScript.textContent) {
    try {
      initialHistory = JSON.parse(historyScript.textContent) || [];
    } catch (e) {
      console.error('Failed to parse initial history JSON', e);
    }
  }

  let activeSessionId = null;
  const sessionScript = document.getElementById('activeSessionId');
  if (sessionScript && sessionScript.textContent) {
    try {
      activeSessionId = JSON.parse(sessionScript.textContent);
    } catch (e) {
      console.error('Failed to parse active session ID', e);
    }
  }

  function renderApexChart(targetElement, chartOptions) {
    if (!window.ApexCharts) {
      console.warn('ApexCharts not loaded; cannot render chart.');
      return;
    }

    const chartDiv = document.createElement('div');
    chartDiv.className = 'chat-apexchart';
    chartDiv.style.width = '100%';
    const height = (chartOptions && chartOptions.chart && chartOptions.chart.height) || 260;
    chartDiv.style.height = height + 'px';
    targetElement.appendChild(chartDiv);

    try {
      const chart = new window.ApexCharts(chartDiv, chartOptions);
      chart.render();
    } catch (e) {
      console.error('Error rendering ApexChart', e);
      chartDiv.textContent = 'Failed to render chart.';
    }
  }

  // Create the chat widget using quikchat
  const chat = new quikchat('#admin-chat', async function (chatInstance, msg) {
    // If no session is active, create one automatically
    if (!activeSessionId) {
      try {
        const r = await axios.post('/admin/chat/sessions');
        activeSessionId = r.data.sessionId;
        // Update URL so refreshing keeps this session
        window.history.pushState({}, '', `/admin/chat?session=${activeSessionId}`);
      } catch (err) {
        console.error('Error creating chat session', err);
        chatInstance.messageAddNew('Error creating chat session.', 'bot', 'left', 'bot');
        return;
      }
    }

    // Add user message to UI
    chatInstance.messageAddNew(msg, 'me', 'right', 'user');

    try {
      const res = await axios.post('/admin/chat/api', { message: msg, sessionId: activeSessionId });
      const data = res.data;

      const replyText = (data && data.reply) || '(no reply)';

      // Add bot text reply and capture its message ID
      const replyId = chatInstance.messageAddNew(
        replyText,
        'bot',
        'left',
        'bot'
      );

      // If the server returns a chart config, render it inside the same message bubble
      if (data && data.chart && replyId != null) {
        const msgNode = chatInstance.messageGetDOMObject(replyId);
        if (msgNode) {
          renderApexChart(msgNode, data.chart);
        }
      }
    } catch (err) {
      console.error('Error calling /admin/chat/api', err);
      chatInstance.messageAddNew('Error contacting server.', 'bot', 'left', 'bot');
    }
  });

  // Seed initial history into the widget
  if (Array.isArray(initialHistory) && initialHistory.length) {
    initialHistory.forEach(function (item) {
      if (!item.text) return;
      chat.messageAddNew(item.text, item.role, item.side, item.role);
    });
  }

  // New Chat button
  const newChatBtn = document.getElementById('newChatBtn');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', async () => {
      try {
        const r = await axios.post('/admin/chat/sessions');
        // Full page load so the sidebar refreshes
        window.location.href = `/admin/chat?session=${r.data.sessionId}`;
      } catch (err) {
        console.error('Error creating chat session', err);
      }
    });
  }

  // Delete session buttons
  document.querySelectorAll('.delete-session-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const sessionId = btn.dataset.sessionId;
      try {
        await axios.post(`/admin/chat/sessions/${sessionId}/delete`);
      } catch (err) {
        console.error('Error deleting chat session', err);
        return;
      }
      // If deleting the active session, go to base page
      if (parseInt(sessionId) === activeSessionId) {
        window.location.href = '/admin/chat';
      } else {
        window.location.reload();
      }
    });
  });
})();