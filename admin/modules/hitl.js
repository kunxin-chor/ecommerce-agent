const { Command } = require('@langchain/langgraph');

// The checkpointer keeps each conversation's state in memory, keyed by
// thread_id. Once a thread exists it already holds the full conversation,
// so we must NOT send the full MariaDB history again (that would duplicate
// every message in the state). This set tracks which threads exist. Both
// this set and MemorySaver are in-memory, so they expire together on a
// server restart and the thread is rebuilt from the database.
const knownThreads = new Set();

function isThreadKnown(sessionId) {
  return knownThreads.has(sessionId.toString());
}

function markThreadKnown(sessionId) {
  knownThreads.add(sessionId.toString());
}

function getAgentConfig(sessionId) {
  return {
    recursionLimit: 50,
    configurable: {
      sessionId,
      thread_id: `chat_${sessionId}`
    }
  };
}

// An interrupted run surfaces as an __interrupt__ array (a chunk in a
// stream, or a key in an invoke result). The first entry's value is what
// humanInTheLoopMiddleware gave us.
function extractInterruptValue(source) {
  const interrupts = source && source.__interrupt__;
  if (!interrupts || interrupts.length === 0) return null;
  return interrupts[0].value;
}

// value.actionRequests has one entry per paused tool call.
function buildApproval(value) {
  const requests = (value && value.actionRequests) || [];
  return {
    tool: requests[0] ? requests[0].name : null,
    message: (requests[0] && requests[0].description)
      || '⚠️ The agent wants to run a tool. Type **yes** to approve or **no** to reject.',
    actionCount: requests.length || 1
  };
}

function buildResumeCommand(approved, actionCount, rejectMessage) {
  const decision = approved
    ? { type: 'approve' }
    : { type: 'reject', message: `User rejected: ${rejectMessage}` };
  return new Command({
    resume: { decisions: Array(actionCount || 1).fill(decision) }
  });
}

function isApproval(text) {
  return ['yes', 'y', 'ok', 'approve', 'proceed'].includes(text.toLowerCase());
}

module.exports = {
  isThreadKnown,
  markThreadKnown,
  getAgentConfig,
  extractInterruptValue,
  buildApproval,
  buildResumeCommand,
  isApproval
};
