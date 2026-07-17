(function () {
  const historyScript = document.getElementById('initialHistory');
  const initialHistory = historyScript ? JSON.parse(historyScript.textContent) : [];

  let activeSessionId = null;
  const sessionScript = document.getElementById('activeSessionId');
  if (sessionScript && sessionScript.textContent) {
    try {
      activeSessionId = JSON.parse(sessionScript.textContent);
    } catch (e) {}
  }

  const chat = new quikchat('#admin-chat', async function (chatInstance, msg) {
    // Auto-create session on first message
    if (!activeSessionId) {
      try {
        const r = await axios.post('/admin/chat/sessions');
        activeSessionId = r.data.sessionId;
        window.history.pushState({}, '', `/admin/chat?session=${activeSessionId}`);
      } catch (err) {
        chatInstance.messageAddNew('Error creating session.', 'bot', 'left', 'bot');
        return;
      }
    }

    // Show user message
    chatInstance.messageAddNew(msg, 'me', 'right', 'user');
    chatInstance.inputAreaSetEnabled(false);
    chatInstance.inputAreaSetButtonText('Thinking...');

    const steps = [];
    let thinkingId = chatInstance.messageAddNew('⏳ Thinking...', 'bot', 'left', 'bot');

    function removeThinkingPlaceholder() {
      if (thinkingId !== null) {
        chatInstance.messageRemove(thinkingId);
        thinkingId = null;
      }
    }

    try {
      // Use fetch (not axios) for SSE streaming
      const res = await fetch('/admin/chat/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId: activeSessionId })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === 'tool_call') {
            removeThinkingPlaceholder();
            const stepText = `🔧 Calling tool: **${data.tool}**`;
            steps.push(stepText);
            chatInstance.messageAddNew(stepText, 'bot', 'left', 'bot');
          }

          if (data.type === 'tool_result') {
            removeThinkingPlaceholder();
            const stepText = `✅ Got result from: **${data.tool}**`;
            steps.push(stepText);
            chatInstance.messageAddNew(stepText, 'bot', 'left', 'bot');
          }

          if (data.type === 'done') {
            const replyText = data.reply || '(no reply)';
            let replyId;

            if (steps.length > 0) {
              // Keep all previous step bubbles; add the final reply as a new message.
              replyId = chatInstance.messageAddNew(replyText, 'bot', 'left', 'bot');
              removeThinkingPlaceholder();
            } else {
              chatInstance.messageReplaceContent(thinkingId, replyText);
              replyId = thinkingId;
              thinkingId = null;
            }

            if (data.chart && replyId) {
              const replyEl = chatInstance.messageGetDOMObject(replyId);
              if (replyEl) renderApexChart(replyEl, data.chart);
            }
          }
        }
      }

      chatInstance.inputAreaSetEnabled(true);
      chatInstance.inputAreaSetButtonText('Send');

    } catch (err) {
      console.error('Error calling /admin/chat/api', err);
      chatInstance.messageReplaceContent(thinkingId, 'Error contacting server.');
      chatInstance.inputAreaSetEnabled(true);
      chatInstance.inputAreaSetButtonText('Send');
    }
  });

  // Seed history with charts
  if (Array.isArray(initialHistory) && initialHistory.length) {
    initialHistory.forEach(function (item) {
      if (!item.text) return;
      chat.messageAddNew(item.text, item.role, item.side, item.role);
      if (item.chart) {
        const messages = document.querySelectorAll('.quikchat-message');
        const lastMessage = messages[messages.length - 1];
        if (lastMessage) renderApexChart(lastMessage, item.chart);
      }
    });
  }

  function renderApexChart(targetElement, chartOptions) {
    if (!window.ApexCharts) {
      console.warn('ApexCharts not loaded');
      return;
    }
    const chartDiv = document.createElement('div');
    chartDiv.style.width = '100%';
    chartDiv.style.height = ((chartOptions.chart && chartOptions.chart.height) || 260) + 'px';
    targetElement.appendChild(chartDiv);
    try {
      new window.ApexCharts(chartDiv, chartOptions).render();
    } catch (e) {
      console.error('Error rendering chart', e);
    }
  }

  document.getElementById('newChatBtn').addEventListener('click', async () => {
    const r = await axios.post('/admin/chat/sessions');
    window.location.href = `/admin/chat?session=${r.data.sessionId}`;
  });

  document.querySelectorAll('.delete-session-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const sessionId = btn.dataset.sessionId;
      await axios.post(`/admin/chat/sessions/${sessionId}/delete`);
      if (parseInt(sessionId) === activeSessionId) {
        window.location.href = '/admin/chat';
      } else {
        window.location.reload();
      }
    });
  });
})();