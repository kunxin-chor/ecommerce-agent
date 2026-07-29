// admin/modules/runAgentStream.js
const { HumanMessage } = require('@langchain/core/messages');
const { Command } = require('@langchain/langgraph');
const { randomUUID } = require('crypto');
const { agent, thinkingAgent } = require('../../gemini');
const { MariaDBChatHistory } = require('./MariaDBHistory');
const { extractText, extractPlan, isRecursionLimitError } = require('./agentHelpers');
const { takeChartConfig } = require('../tools/chartTools');
const { takeThoughts, peekThoughts } = require('./thoughts');
const { setPendingApproval, takePendingApproval, approvalReply } = require('./approval');

// Runs the agent like runAgent, but instead of waiting for the whole run to
// finish, it calls onEvent(eventName, data) as the agent works. The route
// passes in a function that writes each event into the HTTP response.
async function runAgentStreamFinal(input, config, thinking = false, onEvent) {
  const { sessionId } = config.configurable;
  const history = new MariaDBChatHistory(sessionId);
  const pastMessages = await history.getMessages();

  const activeAgent = thinking ? thinkingAgent : agent;

  const stream = await activeAgent.stream(
    { messages: [...pastMessages, new HumanMessage(input.input)] },
    { ...config, recursionLimit: 50, streamMode: 'updates' }
  );

  let lastAgentContent = null;
  let todos = null;
  let streamedThoughts = 0;
  let planStreamed = false;

  try {
    for await (const step of stream) {
      // stream any new reasoning as soon as the middleware has captured it
      const capturedThoughts = peekThoughts(sessionId);
      for (; streamedThoughts < capturedThoughts.length; streamedThoughts++) {
        onEvent('chunk', { text: `\n\n💭 ${capturedThoughts[streamedThoughts]}` });
      }

      for (const update of Object.values(step)) {
        if (update.todos) {
          todos = update.todos;
          // stream the plan the first time we see it; later write_todos calls
          // only update item statuses, and re-streaming the whole plan each
          // time would flood the preview
          if (!planStreamed) {
            planStreamed = true;
            const planText = extractPlan(update.todos);
            if (planText) onEvent('chunk', { text: '\n\n' + planText });
          }
        }

        const msg = update.messages && update.messages[0];
        if (!msg) continue;

        if (msg._getType() === 'ai') {
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            for (const toolCall of msg.tool_calls) {
              // no chunk for write_todos: the plan itself streams in
              // from the tools update a moment later
              if (toolCall.name !== 'write_todos') {
                onEvent('chunk', { text: `\n\n🔧 *Calling \`${toolCall.name}\`...*` });
              }
            }
          } else {
            lastAgentContent = msg.content;
          }
        }
      }
    }
  } catch (error) {
    if (isRecursionLimitError(error)) {
      // Same policy as runAgent: apologise in character and save the exchange.
      // We return it as a normal result so the route sends it as the `done`
      // payload - the client's preview bubble is then replaced by the apology.
      console.error('Agent hit the recursion limit for input:', input.input);
      const reply = 'I was not able to finish that request — it needed more steps than I am allowed to take. Could you break it into smaller requests? For example, ask me to find the low-stock products first, then create the restock orders one product at a time.';
      await history.addUserMessage(input.input);
      await history.addAIChatMessage(reply);
      return { reply, chart: null, plan: null, thoughts: null };
    }
    throw error;  // unexpected error — let the route send an `error` event
  }

  const reply = extractText(lastAgentContent) || '(no reply)';
  const plan = extractPlan(todos);
  const chart = takeChartConfig(sessionId);
  const thoughts = takeThoughts(sessionId);

  await history.addUserMessage(input.input);
  await history.addAIChatMessage(reply, chart);

  return { reply, chart, plan, thoughts };
}


// Like extractText, but skips thought blocks: the reply should be the
// human-readable answer only
function extractReplyText(content) {
  if (Array.isArray(content)) {
    return content
      .map(part => (typeof part === 'string' ? part : (part && part.thought === true ? '' : part.text || '')))
      .join('');
  }
  return content ? content.toString() : '';
}

// Core streaming loop shared by runAgentStream and resumeAgentStream
async function executeAgentStream({ activeAgent, streamInput, runConfig, sessionId, userInput, thinking, history }, onEvent) {
  let reply = '';
  let replyStreamed = false;
  let todos = null;
  let planStreamed = false;
  let streamedThoughts = 0;

  const chunk = (text) => onEvent('chunk', { text });

  function processTokens(data, event) {
    const c = data.chunk;
    if (!c || !c.content) return;
    if (typeof c.content !== 'string') return;
    if ((c.tool_call_chunks || []).length > 0) return;
    if ((event.tags || []).includes('justification')) return;

    const prefix = (replyStreamed === false) ? '\n\n---\n\n' : '';
    chunk(prefix + c.content);
    replyStreamed = true;
  }

  function processChatModelEnd(data) {
    const output = data.output;
    if (output && (!output.tool_calls || output.tool_calls.length === 0)) {
      reply = extractReplyText(output.content);
    }
  }

  function processToolStart(data, event) {
    if (event.name === 'write_todos') return;
    chunk(`\n\n🔧 *Calling \`${event.name}\`...*`);
  }

  function processToolEnd(data, event) {
    if (event.name !== 'write_todos') chunk(' ✔️');
  }

  function processPlan(data) {
    const c = data.chunk;
    if (!c) return;
    for (const update of Object.values(c)) {
      if (update && update.todos) {
        todos = update.todos;
        if (!planStreamed) {
          planStreamed = true;
          const planText = extractPlan(update.todos);
          if (planText) chunk('\n\n' + planText);
        }
      }
    }
  }

  const handlers = {
    on_chat_model_stream: processTokens,
    on_chat_model_end: processChatModelEnd,
    on_tool_start: processToolStart,
    on_tool_end: processToolEnd,
    on_chain_stream: processPlan
  };

  function processEvent(event) {
    const handler = handlers[event.event];
    if (handler) handler(event.data, event);
  }

  async function processStream(stream) {
    for await (const event of stream) {
      processEvent(event);

      const capturedThoughts = peekThoughts(sessionId);
      for (; streamedThoughts < capturedThoughts.length; streamedThoughts++) {
        const prefix = (streamedThoughts === 0) ? '\n\n---\n\n💭 **Reasoning:**\n' : '\n';
        chunk(`${prefix} - ${capturedThoughts[streamedThoughts]}`);
      }
    }
  }

  const stream = activeAgent.streamEvents(streamInput, runConfig);

  try {
    await processStream(stream);
  } catch (error) {
    if (isRecursionLimitError(error)) {
      console.error('Agent hit the recursion limit for input:', userInput);
      const apology = 'I was not able to finish that request — it needed more steps than I am allowed to take. Could you break it into smaller requests?';
      await history.addUserMessage(userInput);
      await history.addAIChatMessage(apology);
      return { reply: apology, chart: null, replyStreamed: false };
    }
    throw error;
  }

  const threadId = runConfig.configurable.thread_id;
  const state = await activeAgent.getState({ configurable: { thread_id: threadId } });
  const interrupts = (state.tasks || []).flatMap(task => task.interrupts || []);
  if (interrupts.length > 0) {
    setPendingApproval(sessionId, { threadId, thinking, input: userInput });
    return { reply: approvalReply(interrupts[0].value), chart: null, plan: null, replyStreamed: false };
  }

  const chart = takeChartConfig(sessionId);
  const plan = todos ? extractPlan(todos) : null;
  takeThoughts(sessionId);

  await history.addUserMessage(userInput);
  await history.addAIChatMessage(reply || '(no reply)', chart);

  return { reply: reply || '(no reply)', chart, plan, replyStreamed };
}

async function runAgentStream(input, config, thinking = false, onEvent) {
  const { sessionId } = config.configurable;
  const history = new MariaDBChatHistory(sessionId);
  const pastMessages = await history.getMessages();

  const activeAgent = thinking ? thinkingAgent : agent;
  const threadId = config.configurable?.thread_id || randomUUID();
  const runConfig = {
    ...config,
    configurable: { ...config.configurable, thread_id: threadId },
    recursionLimit: 50,
    version: 'v2'
  };

  const streamInput = { messages: [...pastMessages, new HumanMessage(input.input)] };

  return executeAgentStream({
    activeAgent,
    streamInput,
    runConfig,
    sessionId,
    userInput: input.input,
    thinking,
    history
  }, onEvent);
}

async function resumeAgentStream(sessionId, decisions, onEvent) {
  const pending = takePendingApproval(sessionId);
  if (!pending) {
    return { reply: 'Nothing is waiting for approval.', chart: null, plan: null, replyStreamed: false };
  }

  const { threadId, thinking, input: userInput } = pending;
  const history = new MariaDBChatHistory(sessionId);
  const activeAgent = thinking ? thinkingAgent : agent;
  const runConfig = {
    configurable: { sessionId, thread_id: threadId },
    recursionLimit: 50,
    version: 'v2'
  };

  const streamInput = new Command({
    resume: { decisions: Array.isArray(decisions) ? decisions : [decisions] }
  });

  return executeAgentStream({
    activeAgent,
    streamInput,
    runConfig,
    sessionId,
    userInput,
    thinking,
    history
  }, onEvent);
}

module.exports = { runAgentStream, resumeAgentStream };