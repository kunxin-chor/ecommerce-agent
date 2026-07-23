// Option 1: normal request/response (default).
// The browser waits for the whole run, then shows one reply bubble.
async function sendMessageNormal(chatInstance, msg, activeSessionId, renderApexChart) {
  try {
    const res = await axios.post('/admin/chat/api', { message: msg, sessionId: activeSessionId });
    const data = res.data;

    const replyText = (data && data.reply) || '(no reply)';

    // If the agent produced a plan, show it above the reply in the same bubble
    const bubbleText = (data && data.plan)
      ? data.plan + '\n\n---\n\n' + replyText
      : replyText;

    // Add bot text reply and capture its message ID
    const replyId = chatInstance.messageAddNew(
      bubbleText,
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
}

// Option 2: streaming. Progress events arrive as the agent works, and we
// update a single bubble until the final reply replaces it.
async function sendMessageStreaming(chatInstance, msg, activeSessionId, renderApexChart, approval) {
  // If the agent is paused, this message is the approval decision, not a
  // new question — send it to the approve endpoint instead
  const url = approval.waiting ? '/admin/chat/api/stream/approve' : '/admin/chat/api/stream';

  // Add a placeholder bubble that we will update as progress events arrive
  const thinkingId = chatInstance.messageAddNew('⏳ Working...', 'bot', 'left', 'bot');
  let steps = [];

  try {
    const res = await fetch(url, {
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

      // Only complete events end with a blank line; keep the rest for next time
      const events = buffer.split('\n\n');
      buffer = events.pop();

      for (const event of events) {
        if (!event.startsWith('data: ')) continue;
        const data = JSON.parse(event.slice(6));

        if (data.type === 'plan') {
          steps = [data.plan];
          chatInstance.messageReplaceContent(thinkingId, steps.join('\n\n') + '\n\n⏳ Working...');
        }

        if (data.type === 'tool_call') {
          steps.push(`🔧 Calling tool: **${data.tool}**`);
          chatInstance.messageReplaceContent(thinkingId, steps.join('\n\n') + '\n\n⏳ Working...');
        }

        if (data.type === 'tool_result') {
          steps.push(`✅ Got result from: **${data.tool}**`);
          chatInstance.messageReplaceContent(thinkingId, steps.join('\n\n') + '\n\n⏳ Generating response...');
        }

        if (data.type === 'approved' || data.type === 'rejected') {
          steps.push(data.message);
          chatInstance.messageReplaceContent(thinkingId, steps.join('\n\n') + '\n\n⏳ Working...');
        }

        // The agent paused before a tool call: show the approval request and
        // wait — the next user message is the yes/no decision
        if (data.type === 'needs_approval') {
          approval.waiting = true;
          steps.push(data.message);
          chatInstance.messageReplaceContent(thinkingId, steps.join('\n\n'));
        }

        if (data.type === 'done') {
          approval.waiting = false;
          const replyText = data.reply || '(no reply)';
          chatInstance.messageReplaceContent(thinkingId, replyText);

          if (data.chart && thinkingId != null) {
            const msgNode = chatInstance.messageGetDOMObject(thinkingId);
            if (msgNode) {
              renderApexChart(msgNode, data.chart);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error calling /admin/chat/api/stream', err);
    chatInstance.messageReplaceContent(thinkingId, 'Error contacting server.');
  }
}

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

  // Shared flag: true while the agent is paused waiting for the user to
  // approve or reject a tool call. The send function reads and updates it.
  const approval = { waiting: false };

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

    // Choose ONE of the two options below — comment out the one you are not using.
    // Both functions handle their own errors, so no try/catch is needed here.
    // await sendMessageNormal(chatInstance, msg, activeSessionId, renderApexChart);
    await sendMessageStreaming(chatInstance, msg, activeSessionId, renderApexChart, approval);

  });

  // Seed initial history into the widget
  if (Array.isArray(initialHistory) && initialHistory.length) {
    initialHistory.forEach(function (item) {
      if (!item.text) return;
      const msgId = chat.messageAddNew(item.text, item.role, item.side, item.role);

      // Re-render any chart stored with this message
      if (item.chart && msgId != null) {
        const msgNode = chat.messageGetDOMObject(msgId);
        if (msgNode) {
          renderApexChart(msgNode, item.chart);
        }
      }
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
