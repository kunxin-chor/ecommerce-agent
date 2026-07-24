# Kimi Code Prompt: Human-in-the-Loop Approval (Streaming)

Copy everything inside the code block below into Kimi Code. It assumes you are on the `06c-streaming` branch of the `ecommerce-agent` repo.

````
Add human-in-the-loop (HITL) approval to this project. When the agent wants to call the `create_restock_orders` tool or the first `write_todos` plan, it must pause, show the pending orders or plan in the admin chat, and wait for the admin to type yes or no (or feedback to revise the plan). The run resumes only after the decision. Implement this for the streaming path only (`runAgentStream` + `/api/stream`). Keep the existing code design and UI — do not restructure anything else.

## Background

- The agent is defined in `gemini.js` using `createAgent` from LangChain v1 with `todoListMiddleware()`.
- The streaming runner is `admin/modules/runAgentStream.js`; routes are in `admin/routes/chat.js`; the frontend is `public/js/adminChatBot.js` (quikchat widget).
- Chat history is persisted in MariaDB via `admin/modules/MariaDBHistory.js`. The chart config is stored server-side via `takeChartConfig(sessionId)` from `admin/tools/chartTools.js`.
- The tools that need approval are `create_restock_orders` (batch tool, args: `{ orders: [{ productId, stockAmount }] }`) and `write_todos` (the agent's planner, args: `{ todos: [{ content, status }] }`). Only interrupt on the first `write_todos` call (when the agent state has no todos yet).

## Step 1: gemini.js

- Import `humanInTheLoopMiddleware` from `langchain` and `MemorySaver` from `@langchain/langgraph`.
- Create `const checkpointer = new MemorySaver();` and pass it to `createAgent`.
- Add `humanInTheLoopMiddleware` to the middleware array (keep `todoListMiddleware()` first):

```js
humanInTheLoopMiddleware({
  interruptOn: {
    create_restock_orders: {
      allowedDecisions: ['approve', 'reject'],
      description: (toolCall) => {
        const lines = toolCall.args.orders.map(
          (order, index) => `${index + 1}. Product ID **${order.productId}** — **${order.stockAmount}** units`
        );
        return '⚠️ **Restock Order' + (lines.length > 1 ? 's' : '') + ' Require Approval**\n\n'
          + lines.join('\n')
          + '\n\nType **yes** to approve or **no** to reject.';
      }
    },
    write_todos: {
      allowedDecisions: ['approve', 'reject'],
      description: (toolCall) => {
        const todos = toolCall.args.todos || [];
        const lines = todos.map((todo, index) => {
          const icon = todo.status === 'completed' ? '✅' : todo.status === 'in_progress' ? '⏳' : '⏸️';
          return `${index + 1}. ${icon} ${todo.content}`;
        });
        return '📋 **Review Plan**\n\n'
          + (lines.length ? lines.join('\n') : '(no plan items)')
          + '\n\nType **yes** to approve this plan, or type your feedback to revise it.';
      },
      when: (request) => !request.state.todos || request.state.todos.length === 0
    }
  }
})
```

Do not change the model, tools, prompt, or exports.

## Step 2: New module `admin/modules/hitl.js`

Create this shared helper module:

```js
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
```

## Step 3: `admin/modules/runAgentStream.js`

Refactor so the streaming loop lives in a shared internal function, then add a resume function:

1. New internal `streamRun(input, sessionId, onStep)`:
   - Calls `agent.stream(input, getAgentConfig(sessionId))`.
   - The existing `for await` body (the `model_request` and `tools` handling) moves here unchanged, EXCEPT add this check at the very top of the loop:
     ```js
     const interruptValue = extractInterruptValue(step);
     if (interruptValue) {
       const approval = buildApproval(interruptValue);
       onStep('needs_approval', approval);
       return { interrupted: true, approval };
     }
     ```
   - At the end returns `{ interrupted: false, reply, chart }` (chart from `takeChartConfig(sessionId)` as before).

2. `runAgentStream(input, config, onStep)` becomes a thin wrapper:
   - Loads history as before.
   - Message rule: if `isThreadKnown(sessionId)` send only `[new HumanMessage(input.input)]`, else send `[...pastMessages, new HumanMessage(input.input)]`.
   - Calls `streamRun({ messages }, sessionId, onStep)`.
   - If `result.interrupted`, return the result immediately WITHOUT saving history (history is only saved after the human decides).
   - Otherwise call `markThreadKnown(sessionId)`, save user + AI messages as before, return result.

3. New exported `resumeAgentStream({ sessionId, approved, message, userText, actionCount }, onStep)`:
   - Calls `streamRun(buildResumeCommand(approved, actionCount, message), sessionId, onStep)`.
   - If interrupted again (the agent can pause again), return the result as-is.
   - Otherwise save `history.addUserMessage(userText)` and `history.addAIChatMessage(result.reply, result.chart)`, return result.

4. Export both: `module.exports = { runAgentStream, resumeAgentStream };`

## Step 4: `admin/routes/chat.js`

- Import `resumeAgentStream` and `isApproval`.
- Add near the top:
  ```js
  // Sessions paused waiting for the admin to approve a tool call.
  const pendingApprovals = new Map();
  ```
- In `POST /api/stream`: after `runAgentStream` returns, if `result.interrupted`, store `pendingApprovals.set(sessionId.toString(), { userText: text, actionCount: result.approval.actionCount })` and do NOT send a `done` event (the `needs_approval` event was already sent by the runner). Otherwise send `done` as before.
- Add a new route `POST /api/stream/approve`:
  - Read `{ message, sessionId }`; look up `pendingApprovals.get(sessionId.toString())`.
  - Set SSE headers and a `sendEvent` helper, same as `/api/stream`.
  - If no pending entry: `sendEvent('done', { reply: 'There is nothing waiting for approval.' })`, end.
  - Otherwise `sendEvent(isApproval(text) ? 'approved' : 'rejected', { message: ... })` to echo the decision.
  - Call `resumeAgentStream({ sessionId, approved: isApproval(text), message: text, userText: pending.userText, actionCount: pending.actionCount }, sendEvent)`.
  - If interrupted again, update `pending.actionCount` and stay in the approval flow. Otherwise `pendingApprovals.delete(...)` and `sendEvent('done', { reply: result.reply, chart: result.chart })`.
  - On error, `sendEvent('done', { reply: 'Sorry, something went wrong.' })`. Always `res.end()`.

## Step 5: `public/js/adminChatBot.js`

- Inside the IIFE, before creating the quikchat widget, add:
  ```js
  // true while the agent is paused waiting for approve/reject
  const approval = { waiting: false };
  ```
- Change `sendMessageStreaming` to accept `approval` as a 5th parameter. At the top:
  ```js
  const url = approval.waiting ? '/admin/chat/api/stream/approve' : '/admin/chat/api/stream';
  ```
  and fetch from `url`.
- In the event-reading loop, add two new handlers:
  ```js
  if (data.type === 'approved' || data.type === 'rejected') {
    steps.push(data.message);
    chatInstance.messageReplaceContent(thinkingId, steps.join('\n\n') + '\n\n⏳ Working...');
  }

  if (data.type === 'needs_approval') {
    approval.waiting = true;
    steps.push(data.message);
    chatInstance.messageReplaceContent(thinkingId, steps.join('\n\n'));
  }
  ```
- In the existing `done` handler, add `approval.waiting = false;` as the first line.
- Update the call site: `await sendMessageStreaming(chatInstance, msg, activeSessionId, renderApexChart, approval);`
- Leave `sendMessageNormal` and the rest of the file untouched.

## Important constraints

- Do NOT create a second agent — add the middleware and checkpointer to the existing `agent` in `gemini.js`.
- Do NOT hold the original SSE response open while waiting for approval. End the stream after `needs_approval`; the decision starts a new stream on `/api/stream/approve`.
- Do NOT save anything to MariaDB when a run is interrupted — the user message and reply are saved together only after the run completes.
- The approve endpoint emits the same SSE event types as `/api/stream`, so the frontend uses one reading loop for both.
- After making changes, run `node --check` on every modified file to confirm there are no syntax errors.

## How to verify

1. Restart the server, open the admin chat (streaming mode).
2. "Which products are low on stock?" → normal answer, no approval.
3. "Create restock orders for the low-stock products, 50 units each." → progress bubble stops at an approval request listing the orders.
4. Type `yes` → run resumes, tool executes, final reply appears. Ask again and type `no` → agent acknowledges the rejection and does NOT create orders.
5. "Create restock orders for the low-stock products, 50 units each, and also show me a chart of last month's sales." → progress bubble stops at a plan review.
6. Type `yes` → plan is saved, run proceeds. Or type feedback (e.g. "skip the chart") → agent revises the plan and pauses again; type `yes` to approve the revised plan.
````

## Notes on using this prompt

- The prompt assumes the streaming frontend is active (`sendMessageStreaming` uncommented in the quikchat callback), matching the `06c-streaming` branch default.
- If Kimi Code asks for clarification about the interrupt shape: `agent.stream()` ends with a chunk whose key is `__interrupt__`; the resume input is `new Command({ resume: { decisions: [...] } })` from `@langchain/langgraph`.
- After it finishes, test manually with the verification steps at the bottom before committing.
