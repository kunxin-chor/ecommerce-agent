
const {  humanInTheLoopMiddleware } = require('langchain');


// gemini.js

// The agent pauses before running these tools and waits for the admin to
// approve or reject them. The description functions format the approval
// request as markdown, since we render it directly in the chat.
const approvalMiddleware = humanInTheLoopMiddleware({
  interruptOn: {
    write_todos: {
      allowedDecisions: ['approve', 'reject'],
      when: ({ state }) => {
        if (!state || !Array.isArray(state.messages)) return true;

        // Search backward for the most recent write_todos tool message in this run
        const lastWriteTodosMsg = [...state.messages]
          .reverse()
          .find(msg => (msg.name || msg.tool_name) === 'write_todos');

        // Interrupt if no plan has been run yet, OR if the last proposed plan was rejected
        if (!lastWriteTodosMsg) return true;
        if (lastWriteTodosMsg.status === 'error') return true;

        // Otherwise, an approved plan is active; auto-approve subsequent status updates
        return false;
      },
      description: (toolCall) => {
        const lines = toolCall.args.todos.map((todo, index) => `${index + 1}. ${todo.content}`);
        return '📋 **Proposed plan:**\n' + lines.join('\n');
      }
    },
    create_restock_orders: {
      allowedDecisions: ['approve', 'reject'],
      description: (toolCall) => {
        const lines = (toolCall.args.orders || []).map(
          order => `- Product #${order.productId}: restock ${order.stockAmount} units`
        );
        return '📦 **Restock order requested:**\n' + lines.join('\n');
      }
    }
  }
});

const pendingApprovals = new Map();

/**
 * Store pending approval for a session
 * @param {string} sessionId - The session ID
 * @param {
 *  threadId: string,
 *  thinking: boolean,
 *  input: string
 * } pending - The pending approval object, which contains the thread ID, thinking status, and input message
 */
function setPendingApproval(sessionId, pending) {
  pendingApprovals.set(String(sessionId), pending);
}

/**
 * Retrieve and remove pending approval for a session
 * @param {string} sessionId - The session ID
 * @returns {object|null} The pending approval object or null if none exists
 */
function takePendingApproval(sessionId) {
  const pending = pendingApprovals.get(String(sessionId));
  pendingApprovals.delete(String(sessionId));
  return pending || null;
}

function hasPendingApproval(sessionId) {
  return pendingApprovals.has(String(sessionId));
}

// Turn the raw interrupt payload into a markdown description of what the
// agent wants to do (the middleware built one per action; join them)
function formatApproval(hitlRequest) {
  return hitlRequest.actionRequests
    .map(action => action.description)
    .join('\n\n');
}

// The approval question is shown as a normal chat reply: what the agent
// wants to do, plus how to answer
function approvalReply(hitlRequest) {
  return formatApproval(hitlRequest)
    + '\n\n**Approve?** Reply *yes* to go ahead, or *no* to refuse (you can also reply *no <feedback>* to give specific instructions).';
}

// Turns the admin's typed answer into a HITL decision.
// Returns null if the message is not a clear yes or no.
function parseDecision(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  // Match YES / Y variations (e.g. "yes", "YES!", "y.")
  if (/^(yes|y)[!.?]*$/i.test(trimmed)) {
    return { type: 'approve' };
  }

  // Match NO / N variations (e.g. "no", "No.", "NO!", "no, use Acme instead")
  const noMatch = trimmed.match(/^(no|n)\b[!.?\s,-]*(.*)$/i);
  if (noMatch) {
    const feedback = noMatch[2].trim();

    if (feedback.length === 0) {
      return {
        type: 'reject',
        message: 'The admin rejected this proposed plan without providing specific feedback. Acknowledge the rejection politely and ask the admin what changes they would like to make or how they would prefer to proceed. Do NOT execute any tools until they clarify.'
      };
    } else {
      return {
        type: 'reject',
        message: `The admin rejected this proposed plan with the following feedback: "${feedback}". Create a revised plan using write_todos that incorporates this feedback, or ask for clarification if anything is ambiguous.`
      };
    }
  }

  return null;
}

module.exports = {
  approvalMiddleware,
  setPendingApproval,
  takePendingApproval,
  hasPendingApproval,
  formatApproval,
  approvalReply,
  parseDecision

};
