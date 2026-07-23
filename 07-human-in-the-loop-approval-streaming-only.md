# Human-in-the-Loop: Approving Tool Calls Before They Run (Streaming)

So far, our agent can call any of its tools as soon as the model decides to. For most tools this is fine — reading sales data or drawing a chart cannot hurt anything. But `create_restock_orders` simulates placing orders with a supplier. For actions like this, we want a human to confirm before the tool runs.

In this chapter, we will add human-in-the-loop (HITL) approval to our agent. When the agent wants to create restock orders, it will pause, show us the orders in the chat, and wait. The run only continues after we type **yes** or **no**.

We will build this on the streaming version of our chat — the one where progress events arrive as Server-Sent Events while the agent works.

## How the Pause Works

LangChain v1 ships with a `humanInTheLoopMiddleware`. Here is the flow:

1. The model decides to call a tool that we have marked as needing approval.
2. Instead of running the tool, the middleware **interrupts** the run. The agent's state is frozen and saved.
3. Our route sees the interrupt and asks the user for a decision.
4. When the user replies, we **resume** the run with the decision: `approve` (run the tool) or `reject` (skip the tool and tell the model it was rejected).

One thing is required for this to work: a **checkpointer**. Interrupting means the agent has to stop in the middle of a run and continue later — in our case, in a different HTTP request. The checkpointer is what saves the state between those two requests. Without it, there is nothing to resume.

## Step 1: Adding the Checkpointer and the Middleware

Open `gemini.js`. Add the two new imports at the top:

```js
// gemini.js
const { createAgent, todoListMiddleware, humanInTheLoopMiddleware } = require('langchain');
const { MemorySaver } = require('@langchain/langgraph');
```

Then update the agent definition:

```js
// gemini.js
// The checkpointer saves the agent's state after every step, keyed by
// thread_id. Without it, an interrupted run cannot be resumed later.
const checkpointer = new MemorySaver();

const agent = createAgent({
  model,
  tools,
  prompt: 'You are a helpful admin assistant for an ecommerce store. ...', // unchanged
  middleware: [
    todoListMiddleware(),
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
        }
      }
    })
  ],
  checkpointer
});
```

Here's what the new parts do:

- `MemorySaver` keeps the agent's state in the server's memory, keyed by a `thread_id` that we will supply. It is the simplest checkpointer — fine for development. Since it lives in memory, a server restart forgets all paused runs; for production you would swap in a database-backed checkpointer without changing any other code.
- `interruptOn` lists which tools need approval. We only list `create_restock_orders`; every other tool runs immediately as before.
- `allowedDecisions` restricts what the human can say. We allow `approve` and `reject`. (LangChain also supports an `edit` decision, where the human rewrites the tool arguments before the call — we don't need it here.)
- `description` builds the message shown to the user. Recall that our `create_restock_orders` tool takes a batch: `orders` is an array of `{ productId, stockAmount }`. We format one line per order so the admin sees exactly what will be placed. Note this description is a **markdown** string — our chat widget renders markdown, so the bold text and line breaks will display properly.

We keep the batch tool as it is. One approval covers the whole batch, which matches how the agent was already prompted to work.

## Step 2: Creating a Shared HITL Helper Module

The streaming runner and the routes will both need the same pieces: the thread config, the interrupt check, and the resume command. Rather than duplicating them, create a new file `admin/modules/hitl.js`:

```js
// admin/modules/hitl.js
const { Command } = require('@langchain/langgraph');

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

function extractInterruptValue(source) {
  const interrupts = source && source.__interrupt__;
  if (!interrupts || interrupts.length === 0) return null;
  return interrupts[0].value;
}

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

A few important things to note:

- `getAgentConfig` derives the `thread_id` from the chat session id. This is the key the checkpointer uses, so each conversation gets its own saved state.
- `extractInterruptValue` checks for an `__interrupt__` array. When a streamed run is interrupted, the stream ends with a chunk that has this key, and the first entry's `value` is what the middleware gave us.
- The interrupt `value` contains `actionRequests` — one entry per tool call that is waiting. Each entry has the tool `name`, the `args`, and the `description` we wrote in Step 1.
- To resume, we don't call the agent with a normal message. We pass a `Command` object with `resume.decisions` — one decision per action request. For `reject` we can attach a message, which the model will see as the tool result. This is how the agent knows not to try again.

### Why the `knownThreads` set?

There is a subtle problem now that we have a checkpointer. Until this chapter, every request sent the **whole** MariaDB history to the agent:

```js
{ messages: [...pastMessages, new HumanMessage(input.input)] }
```

But once a thread exists in the checkpointer, it **already holds the full conversation** — the agent state keeps every message. If we send the whole history again, every message appears twice in the state, and the duplication grows with every turn. The model starts seeing each message repeated and the context window fills up with copies.

So the rule is:

- **First message of a session**: the checkpointer knows nothing yet, so send the full history plus the new message.
- **Every later message**: send only the new message. The checkpointer supplies the rest.

The `knownThreads` set tracks which case we are in. It lives in memory, just like `MemorySaver`, so both forget together when the server restarts. On the first message after a restart we send the full history again, and the thread is rebuilt from the database. The two stores can never disagree about what exists.

## Step 3: Updating the Streaming Agent Runner

Open `admin/modules/runAgentStream.js`. First, import the helpers:

```js
const {
  isThreadKnown,
  markThreadKnown,
  getAgentConfig,
  extractInterruptValue,
  buildApproval,
  buildResumeCommand
} = require('./hitl');
```

Right now the file has one function that both streams the run and saves the history. We are about to have two kinds of runs — the initial one and the resume after approval — and they stream in exactly the same way. So let's pull the streaming loop into a shared internal function:

```js
// admin/modules/runAgentStream.js

// Streams one agent run, calling onStep for each progress event. `input` is
// either { messages } for a fresh run or a resume Command after approval.
// Returns { interrupted, approval } if the run paused, otherwise { reply, chart }.
async function streamRun(input, sessionId, onStep) {
  const stream = await agent.stream(input, getAgentConfig(sessionId));

  let planSent = false;
  let lastAgentContent = null;

  for await (const step of stream) {
    // When the agent pauses for approval, the stream ends with an
    // __interrupt__ chunk instead of a final model message
    const interruptValue = extractInterruptValue(step);
    if (interruptValue) {
      const approval = buildApproval(interruptValue);
      onStep('needs_approval', approval);
      return { interrupted: true, approval };
    }

    // ... the existing model_request and tools handling stays the same ...
  }

  const reply = extractText(lastAgentContent) || '(no reply)';
  const chart = takeChartConfig(sessionId);
  return { interrupted: false, reply, chart };
}
```

The `for await` body is unchanged apart from the interrupt check at the top — the `model_request` and `tools` handling you already have just moves inside `streamRun`.

With that in place, `runAgentStream` becomes a thin wrapper:

```js
async function runAgentStream(input, config, onStep) {
  const { sessionId } = config.configurable;
  const history = new MariaDBChatHistory(sessionId);
  const pastMessages = await history.getMessages();

  // Same rule as before: only send the full history the first time —
  // after that the checkpointer's thread already has the conversation.
  const messages = isThreadKnown(sessionId)
    ? [new HumanMessage(input.input)]
    : [...pastMessages, new HumanMessage(input.input)];

  const result = await streamRun({ messages }, sessionId, onStep);

  // Paused for approval: don't save anything yet
  if (result.interrupted) return result;

  markThreadKnown(sessionId);

  await history.addUserMessage(input.input);
  await history.addAIChatMessage(result.reply, result.chart);

  return result;
}
```

Note the design decision here: when the run is interrupted, we return **without saving anything** to MariaDB. If we saved the user's message immediately, the chat history would show a question with no answer whenever the admin closes the page mid-approval. We save the user message and the final reply together, only after the run actually finishes.

Finally, add the resume function and update the exports:

```js
// Resume a paused run after the human approves or rejects the tool call.
// userText is the original message that triggered the run — we save it to
// the history only now, together with the final reply.
async function resumeAgentStream({ sessionId, approved, message, userText, actionCount }, onStep) {
  const history = new MariaDBChatHistory(sessionId);

  const result = await streamRun(
    buildResumeCommand(approved, actionCount, message),
    sessionId,
    onStep
  );

  // The agent can pause again if there are more tool calls to approve
  if (result.interrupted) return result;

  await history.addUserMessage(userText);
  await history.addAIChatMessage(result.reply, result.chart);

  return result;
}

module.exports = { runAgentStream, resumeAgentStream };
```

Why check for an interrupt **again** after resuming? The model may respond to an approval by calling the same tool again (for example, "restock these three products" can produce a second call after the first is approved). If that happens we return the new approval request and let the flow repeat. Don't assume one approval is the end of the run.

## Step 4: Adding the Approval Route

Now we wire everything up in `admin/routes/chat.js`. Add the imports and a place to remember paused sessions:

```js
const { runAgentStream, resumeAgentStream } = require('../modules/runAgentStream');
const { isApproval } = require('../modules/hitl');

// Sessions that are paused waiting for the admin to approve a tool call.
const pendingApprovals = new Map();
```

Why do we need `pendingApprovals`? When the approval answer arrives, we must resume with the **original** user message (to save it to history) and the number of waiting tool calls (to build the decisions array). The HTTP request that carries the answer only contains the yes/no text, so we stash those two pieces here, keyed by session id.

Update `/api/stream` to handle an interruption:

```js
    const result = await runAgentStream(
      { input: text },
      { configurable: { sessionId } },
      sendEvent
    );

    // Paused for approval: the needs_approval event was already sent by
    // runAgentStream. Remember the session, then end the stream — the
    // remaining progress arrives on a new stream from /api/stream/approve.
    if (result.interrupted) {
      pendingApprovals.set(sessionId.toString(), {
        userText: text,
        actionCount: result.approval.actionCount
      });
    } else {
      sendEvent('done', { reply: result.reply, chart: result.chart });
    }
```

A design note: some implementations hold the original SSE response open while waiting for the human, and keep writing to it after the answer arrives. We don't do that. Holding a response open across user input creates a resource you have to clean up on disconnects, and it complicates error handling. Instead we end the stream after `needs_approval`, and the approval answer starts a **new** stream on its own endpoint:

```js
router.post('/api/stream/approve', ensureAdmin, express.json(), async (req, res) => {
  const { message, sessionId } = req.body || {};
  const text = (message || '').toString().trim();
  if (!sessionId) return res.status(400).json({ reply: 'No session selected.' });

  const pending = pendingApprovals.get(sessionId.toString());

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  if (!pending) {
    sendEvent('done', { reply: 'There is nothing waiting for approval.' });
    return res.end();
  }

  // Echo the decision so the user sees it in the progress log
  sendEvent(isApproval(text) ? 'approved' : 'rejected', {
    message: isApproval(text) ? '✅ Approved. Continuing...' : '❌ Rejected.'
  });

  try {
    const result = await resumeAgentStream({
      sessionId,
      approved: isApproval(text),
      message: text,
      userText: pending.userText,
      actionCount: pending.actionCount
    }, sendEvent);

    // Another tool call needs approval — stay in the approval flow
    if (result.interrupted) {
      pending.actionCount = result.approval.actionCount;
    } else {
      pendingApprovals.delete(sessionId.toString());
      sendEvent('done', { reply: result.reply, chart: result.chart });
    }
  } catch (error) {
    console.error('Approve error:', error);
    sendEvent('done', { reply: 'Sorry, something went wrong.' });
  }
  res.end();
});
```

At this point the backend is complete. Two routes work as a pair: `/api/stream` starts a run, and `/api/stream/approve` resumes it.

## Step 5: Updating the Chat Frontend

The last piece is `public/js/adminChatBot.js`. The rule on the browser side is simple: while the agent is paused, the next thing the user types is a **decision**, not a new question — so it goes to the approve endpoint.

Add an `approval` flag inside the IIFE, just before we create the quikchat widget:

```js
  // Shared flag: true while the agent is paused waiting for the user to
  // approve or reject a tool call. The send function reads and updates it.
  const approval = { waiting: false };
```

We use an object rather than a plain boolean so `sendMessageStreaming` (which lives outside the IIFE) can share and mutate the same state by reference.

Update `sendMessageStreaming` to accept the flag and pick the URL:

```js
async function sendMessageStreaming(chatInstance, msg, activeSessionId, renderApexChart, approval) {
  // If the agent is paused, this message is the approval decision, not a
  // new question — send it to the approve endpoint instead
  const url = approval.waiting ? '/admin/chat/api/stream/approve' : '/admin/chat/api/stream';

  // Add a placeholder bubble that we will update as progress events arrive
  const thinkingId = chatInstance.messageAddNew('⏳ Working...', 'bot', 'left', 'bot');
  let steps = [];

  try {
    const res = await fetch(url, {
      // ... unchanged ...
```

Then add handlers for the two new event types inside the stream-reading loop:

```js
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
```

Note that after `needs_approval`, the server ends the stream without a `done` event. Our reading loop simply finishes, and the bubble keeps the approval message. The flag is what carries the state forward to the next user message.

And clear the flag when a run completes:

```js
        if (data.type === 'done') {
          approval.waiting = false;
          // ...
```

Finally, pass the flag in the quikchat callback:

```js
    await sendMessageStreaming(chatInstance, msg, activeSessionId, renderApexChart, approval);
```

One small thing that makes this work nicely: the approve endpoint emits the same event types as the normal stream — `tool_call`, `tool_result`, possibly another `needs_approval`, and finally `done`. That is why one reading loop handles both URLs with no special cases.

## Step 6: Testing the Approval Flow

Restart the server and open the admin chat:

1. Type: `Which products are low on stock?` — the agent answers normally. No approval needed, because no restock tool was called.
2. Type: `Create restock orders for the low-stock products, 50 units each.`
3. Watch the progress bubble. After the plan and the tool calls, it stops at:

   > ⚠️ **Restock Orders Require Approval**
   > 1. Product ID **3** — **50** units
   > 2. Product ID **7** — **50** units
   >
   > Type **yes** to approve or **no** to reject.

4. Type `yes`. A new stream starts, the tool executes, and the final reply appears.
5. Ask for another restock, but this time type `no`. The agent should come back with a reply acknowledging that the restock was rejected — it should **not** create the orders.

A few things can go wrong, and each has a distinctive symptom:

- **The agent never pauses and the tool just runs.** The middleware is not seeing the tool name. Check that the key in `interruptOn` is exactly `create_restock_orders` — it must match the `name` in the tool definition, not the JavaScript variable name.
- **The pause works, but the answer to it starts a brand-new run.** The `approval.waiting` flag is not being set or not being passed. Check that `sendMessageStreaming` receives the `approval` object.
- **Error: "No checkpointer set".** You added `humanInTheLoopMiddleware` but forgot the `checkpointer` option in `createAgent`. Interrupts cannot work without one.
- **The model repeats itself or the context grows strangely.** You are sending the full history on every message even though the checkpointer has the thread. Revisit the `isThreadKnown` rule from Step 2.
- **After a server restart, typing `yes` gets "There is nothing waiting for approval."** Expected behaviour: `MemorySaver` and `pendingApprovals` are both in memory, so a restart forgets paused runs. Just repeat your request.

## Wrapping Up

Let's recap what we built:

- A checkpointer (`MemorySaver`) plus `humanInTheLoopMiddleware`, so the agent can freeze before running `create_restock_orders`.
- A shared `hitl.js` module for the thread config, the interrupt check, and the resume command.
- Interrupt handling in the streaming runner, with history saved only after the human decides.
- A `/api/stream/approve` route that resumes the paused run as a new event stream, with the pending state kept server-side.
- A frontend that treats the message after a pause as a decision.

The same pattern extends to any tool you consider dangerous — deleting data, sending emails, charging cards. Add the tool name to `interruptOn`, and it joins the approval flow with no other changes.

## Exercises

1. Add an `edit` decision to `allowedDecisions`, and let the admin change `stockAmount` before approving. What extra UI would you need to collect the new amount?
2. Right now, rejecting sends the model a generic message. Modify the flow so the admin can type a reason (for example, `no, wait until the end of the month`) and have the model take it into account.
3. Replace `MemorySaver` with a database-backed checkpointer (for example, the LangGraph Postgres saver). Which parts of this chapter's code still work unchanged?
