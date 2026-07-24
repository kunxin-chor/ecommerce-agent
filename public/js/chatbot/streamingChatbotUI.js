// public/js/chatbot/streamingChatbotUI.js
(function () {
  'use strict';

  // An AdminChatbotUI that asks the server for a Server-Sent Events stream.
  // If the server answers with a stream, tokens are shown live; if it answers
  // with plain JSON (e.g. an older backend), it behaves exactly like the base class.
  class StreamingChatbotUI extends window.AdminChatbotUI {

    async handleMessage(chatInstance, msg) {
      if (!await this._ensureActiveSession(chatInstance)) return;

      chatInstance.messageAddNew(msg, 'me', 'right', 'user');

      let res;
      try {
        // fetch (not axios): axios buffers the whole response in the browser,
        // while fetch lets us read the body as a stream
        res = await fetch('/admin/chat/api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          },
          body: JSON.stringify({
            message: msg,
            sessionId: this.activeSessionId,
            thinking: this.thinking
          })
        });
      } catch (err) {
        console.error('Error calling /admin/chat/api', err);
        chatInstance.messageAddNew('Error contacting server.', 'bot', 'left', 'bot');
        return;
      }

      // Decide from the RESPONSE what the server actually gave us
      const contentType = res.headers.get('content-type') || '';
      try {
        if (contentType.includes('text/event-stream')) {
          await this._consumeEventStream(res, chatInstance);
        } else {
          const data = await res.json();
          this._renderReply(chatInstance, data);
        }
      } catch (err) {
        console.error('Error handling chat response', err);
        chatInstance.messageAddNew('Error contacting server.', 'bot', 'left', 'bot');
      }
    }

    async _consumeEventStream(res, chatInstance) {
      // a typing indicator doubles as the bubble we stream into
      const replyId = chatInstance.messageAddTypingIndicator();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by blank lines; the last chunk may be incomplete
        const frames = buffer.split('\n\n');
        buffer = frames.pop();
        for (const frame of frames) {
          this._handleStreamEvent(frame, chatInstance, replyId);
        }
      }
    }

    _handleStreamEvent(frame, chatInstance, replyId) {
      const eventMatch = frame.match(/^event: (.+)$/m);
      const dataMatch = frame.match(/^data: (.+)$/m);
      if (!dataMatch) return;

      const event = eventMatch ? eventMatch[1] : 'message';
      const data = JSON.parse(dataMatch[1]);

      if (event === 'chunk') {
        // live preview: append tokens in arrival order (reasoning, then reply)
        chatInstance.messageAppendContent(replyId, data.text);
      } else if (event === 'done') {
        // the authoritative payload — rebuild the bubble in its final layout
        chatInstance.messageReplaceContent(replyId, this.replyBuilder.renderText(data));
        if (this.replyBuilder.hasChart(data)) {
          const msgNode = chatInstance.messageGetDOMObject(replyId);
          this.chartRenderer.render(msgNode, data.chart);
        }
      } else if (event === 'error') {
        chatInstance.messageReplaceContent(replyId, data.reply || 'Error contacting server.');
      }
    }
  }

  window.StreamingChatbotUI = StreamingChatbotUI;
})();
