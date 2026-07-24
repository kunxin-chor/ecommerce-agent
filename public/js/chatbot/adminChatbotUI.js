(function () {
  'use strict';

  class AdminChatbotUI {
    constructor(containerSelector, options = {}) {
      this.container = document.querySelector(containerSelector);
      if (!this.container) {
        throw new Error(`AdminChatbotUI: container "${containerSelector}" not found`);
      }

      if (typeof quikchat !== 'function') {
        throw new Error('AdminChatbotUI: quikchat library is not loaded');
      }

      this.activeSessionId = this._parseActiveSessionId();
      this.initialHistory = this._parseInitialHistory();
      this.replyBuilder = options.replyBuilder || new window.ChatbotReplyBuilder();
      this.chartRenderer = options.chartRenderer || new window.ApexChartRenderer();
      this.chatInstance = null;
      this.thinking = true;

      this._init();
    }

    async createSession() {
      try {
        const r = await axios.post('/admin/chat/sessions');
        const sessionId = r.data && r.data.sessionId;
        if (!sessionId) {
          throw new Error('Server did not return a session id');
        }
        window.location.href = `/admin/chat?session=${sessionId}`;
      } catch (err) {
        console.error('Error creating chat session', err);
      }
    }

    async deleteSession(sessionId) {
      if (!sessionId) return;
      try {
        await axios.post(`/admin/chat/sessions/${sessionId}/delete`);
      } catch (err) {
        console.error('Error deleting chat session', err);
        return;
      }

      if (parseInt(sessionId, 10) === this.activeSessionId) {
        window.location.href = '/admin/chat';
      } else {
        window.location.reload();
      }
    }

    async handleMessage(chatInstance, msg) {
      if (!await this._ensureActiveSession(chatInstance)) return;

      chatInstance.messageAddNew(msg, 'me', 'right', 'user');

      try {
        const res = await axios.post('/admin/chat/api', {
          message: msg,
          sessionId: this.activeSessionId,
          thinking: this.thinking,
        });
        this._renderReply(chatInstance, res.data);
      } catch (err) {
        console.error('Error calling /admin/chat/api', err);
        chatInstance.messageAddNew('Error contacting server.', 'bot', 'left', 'bot');
      }
    }

    // Creates a chat session on first use. Returns false (and shows an error
    // bubble) if the session could not be created.
    async _ensureActiveSession(chatInstance) {
      if (this.activeSessionId) return true;
      try {
        const r = await axios.post('/admin/chat/sessions');
        this.activeSessionId = r.data.sessionId;
        window.history.pushState({}, '', `/admin/chat?session=${this.activeSessionId}`);
        return true;
      } catch (err) {
        console.error('Error creating chat session', err);
        chatInstance.messageAddNew('Error creating chat session.', 'bot', 'left', 'bot');
        return false;
      }
    }

    // Renders a completed { reply, chart, plan, thoughts } payload as a bot bubble
    _renderReply(chatInstance, data) {
      const replyMarkdown = this.replyBuilder.renderText(data);
      const replyId = chatInstance.messageAddNew(replyMarkdown, 'bot', 'left', 'bot');

      if (this.replyBuilder.hasChart(data) && replyId != null) {
        const msgNode = chatInstance.messageGetDOMObject(replyId);
        this.chartRenderer.render(msgNode, data.chart);
      }
    }

    _parseInitialHistory() {
      const script = document.getElementById('initialHistory');
      if (!script || !script.textContent) return [];
      try {
        const parsed = JSON.parse(script.textContent);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Failed to parse initial history JSON', e);
        return [];
      }
    }

    _parseActiveSessionId() {
      const script = document.getElementById('activeSessionId');
      if (!script || !script.textContent) return null;
      try {
        return JSON.parse(script.textContent);
      } catch (e) {
        console.error('Failed to parse active session ID', e);
        return null;
      }
    }

    _seedHistory() {
      if (!Array.isArray(this.initialHistory) || this.initialHistory.length === 0) return;

      this.initialHistory.forEach((item) => {
        if (!item || !item.text) return;
        const msgId = this.chatInstance.messageAddNew(
          item.text,
          item.role,
          item.side,
          item.role
        );

        if (item.chart && msgId != null) {
          const msgNode = this.chatInstance.messageGetDOMObject(msgId);
          this.chartRenderer.render(msgNode, item.chart);
        }
      });
    }

    _bindSessionControls() {
      const newChatBtn = document.getElementById('newChatBtn');
      if (newChatBtn) {
        newChatBtn.addEventListener('click', () => this.createSession());
      }

      document.querySelectorAll('.delete-session-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.deleteSession(btn.dataset.sessionId);
        });
      });
    }

    _createThinkingToggle() {
      const inputArea = this.container.querySelector('.quikchat-input-area');
      if (!inputArea) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'd-flex align-items-center ms-2';
      wrapper.innerHTML = `
        <div class="form-check form-switch mb-0">
          <input class="form-check-input" type="checkbox" id="thinkingToggle" checked>
          <label class="form-check-label" for="thinkingToggle" style="font-size: 0.85rem; white-space: nowrap;">Thinking</label>
        </div>
      `;

      const toggle = wrapper.querySelector('#thinkingToggle');
      toggle.addEventListener('change', () => {
        this.thinking = toggle.checked;
      });

      inputArea.appendChild(wrapper);
    }

    _init() {
      this.chatInstance = new quikchat(this.container, (chatInstance, msg) => {
        this.handleMessage(chatInstance, msg);
      });

      this._createThinkingToggle();
      this._seedHistory();
      this._bindSessionControls();
    }
  }

  window.AdminChatbotUI = AdminChatbotUI;
})();
