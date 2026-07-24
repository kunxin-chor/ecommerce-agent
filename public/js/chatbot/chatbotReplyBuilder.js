(function () {
  'use strict';

  class ChatbotReplyBuilder {
    constructor(options = {}) {
      this.defaultReply = options.defaultReply || '(no reply)';
    }

    hasPlan(data) {
      return !!(data && data.plan);
    }

    hasThoughts(data) {
      return !!(data && Array.isArray(data.thoughts) && data.thoughts.length > 0);
    }

    hasChart(data) {
      return !!(data && data.chart);
    }

    hasReply(data) {
      return !!(data && data.reply);
    }

    buildPlanSection(data) {
      return data.plan;
    }

    buildThoughtsSection(data) {
      const bullets = data.thoughts.map((t) => `- *${t}*`).join('\n');
      return `💭 **Reasoning:**\n${bullets}`;
    }

    buildReplySection(data) {
      if (this.hasReply(data)) {
        return data.reply;
      }
      return this.defaultReply;
    }

    buildSections(data) {
      const sections = [];

      if (this.hasPlan(data)) {
        sections.push(this.buildPlanSection(data));
      }

      if (this.hasThoughts(data)) {
        sections.push(this.buildThoughtsSection(data));
      }

      sections.push(this.buildReplySection(data));

      return sections;
    }

    renderText(data) {
      return this.buildSections(data).join('\n\n---\n\n');
    }
  }

  window.ChatbotReplyBuilder = ChatbotReplyBuilder;
})();
