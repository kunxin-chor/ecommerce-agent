const { createMiddleware } = require('langchain');
const { AIMessage, ToolMessage } = require('@langchain/core/messages');

const INJECTION_PATTERNS = [
  /ignore\s+(all|any|previous|prior|above|the)[^.]{0,40}(instructions?|prompts?|rules?)/i,
  /disregard\s+(all|any|previous|prior|above|the)[^.]{0,40}(instructions?|prompts?|rules?)/i,
  /forget\s+(everything|all|your)[^.]{0,40}(instructions?|training|rules?)/i,
  /you\s+are\s+now\s+(a|an|the)\s+/i,                    // "you are now DAN..."
  /new\s+(system\s+)?instructions?\s*:/i,
  /system\s+override/i,
  /do\s+not\s+follow\s+(your|any|the)\s+(previous\s+)?(instructions?|rules?)/i,
  /instead,?\s+(output|print|reveal|show|send|delete|create)/i,
  /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i,
  /<\s*\/?\s*system\s*>/i,                                // fake <system> tags
  /\[\s*INST\s*\]/i,                                      // fake [INST] blocks
  /priority\s+(override|instruction|directive)/i,
];

const REFUSAL_TEXT =
  '⚠️ I detected text that looks like a prompt-injection attempt ' +
  '(an instruction trying to override my actual instructions). ' +
  'I can only follow instructions from the system prompt and from ' +
  'messages you type directly. Please rephrase your request.';

function looksLikeInjection(text) {
  if (typeof text !== 'string' || !text) return false;
  return INJECTION_PATTERNS.some(re => re.test(text));
}

function messageText(msg) {
  const c = msg?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c
      .filter(p => p && (p.type === 'text' || typeof p.text === 'string'))
      .map(p => p.text)
      .join('\n');
  }
  return '';
}

const injectionDetectionMiddleware = createMiddleware({
  name: 'injectionDetectionMiddleware',
  beforeModel: (state) => {
    const messages = state.messages || [];

    // Find the cut-off: everything after the last AI message is "new"
    let lastAiIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]._getType && messages[i]._getType() === 'ai') {
        lastAiIndex = i;
        break;
      }
    }
    const newMessages = messages.slice(lastAiIndex + 1);

    for (const msg of newMessages) {
      const type = msg._getType ? msg._getType() : null;
      if (type !== 'human' && type !== 'tool') continue;

      const text = messageText(msg);
      if (looksLikeInjection(text)) {
        console.warn(
          `🚨 [SECURITY] Injection pattern detected in ${type} message:`,
          text.substring(0, 200)
        );
        return {
          messages: [new AIMessage(REFUSAL_TEXT)],
          jumpTo: 'end',
        };
      }
    }
  }
});

// Sessions whose context currently contains untrusted document/review text
const taintedSessions = new Set();

// Spotlight markers injected by ragTools.js — their presence means
// retrieved (untrusted) content is in the conversation.
const UNTRUSTED_MARKER = '<<<UNTRUSTED CONTENT';

// Tools that change state / spend money / must never be document-driven.
// Extend this list as new consequential tools are added.
const SENSITIVE_TOOLS = new Set([
  'create_restock_orders',
  'create_restock_order',
]);

const TAINT_BLOCK_TEXT =
  '🚫 Blocked: this action appears to have been triggered by text inside ' +
  'product documentation or reviews, not by a direct instruction from the ' +
  'admin. If you really want this action, tell me directly (e.g. ' +
  '"create a restock order of 500 units for product 3").';

const taintMiddleware = createMiddleware({
  name: 'taintMiddleware',

  // A fresh human message = a direct instruction from the admin.
  // That clears the taint for the next decision.
  beforeModel: (state, runtime) => {
    const sessionId = String(runtime?.configurable?.sessionId ?? '');
    const messages = state.messages || [];
    const last = messages[messages.length - 1];
    if (last && last._getType && last._getType() === 'human') {
      taintedSessions.delete(sessionId);
    }
    // Scan tool results for spotlight markers → taint the session
    for (const msg of messages) {
      if (msg._getType && msg._getType() === 'tool' &&
          messageText(msg).includes(UNTRUSTED_MARKER)) {
        taintedSessions.add(sessionId);
        return;
      }
    }
  },

  // Gate at tool-execution time: even an approved plan cannot execute a
  // sensitive tool while the context is tainted.
  wrapToolCall: async (request, handler) => {
    const toolName = request?.toolCall?.name || request?.tool?.name || '';
    const sessionId = String(
      request?.runtime?.configurable?.sessionId ?? ''
    );

    if (SENSITIVE_TOOLS.has(toolName) && taintedSessions.has(sessionId)) {
      console.warn(
        `🚫 [SECURITY] Blocked ${toolName}: session ${sessionId} is tainted by untrusted content`
      );
      return new ToolMessage({
        content: TAINT_BLOCK_TEXT,
        tool_call_id: request.toolCall.id,
        name: toolName,
        status: 'error',
      });
    }
    return handler(request);
  }
});

module.exports = {
  injectionDetectionMiddleware,
  taintMiddleware,
  looksLikeInjection,
};
