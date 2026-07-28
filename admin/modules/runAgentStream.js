// admin/modules/runAgentStream.js
const { HumanMessage } = require('@langchain/core/messages');
const { agent, thinkingAgent } = require('../../gemini');
const { MariaDBChatHistory } = require('./MariaDBHistory');
const { extractText, extractPlan, isRecursionLimitError } = require('./agentHelpers');
const { takeChartConfig } = require('../tools/chartTools');
const { takeThoughts, peekThoughts } = require('./thoughts');

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
        onEvent('chunk', { text: `\n\n💭 *${capturedThoughts[streamedThoughts]}*` });
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

async function runAgentStream(input, config, thinking = false, onEvent) {
  // setup
  const { sessionId } = config.configurable;
  const history = new MariaDBChatHistory(sessionId);
  const pastMessages = await history.getMessages();

  const activeAgent = thinking ? thinkingAgent : agent;

  const stream = activeAgent.streamEvents(
    { messages: [...pastMessages, new HumanMessage(input.input)] },
    { ...config, recursionLimit: 50, version: 'v2' }
  );

  let lastAgentContent = null;
  let todos = null;
  let streamedThoughts = 0;
  let planStreamed = false;

  // start streaming
  const processStream = async (stream) => {
    try {
      for await (const event of stream) {
        processEvent(event);
      }
    } catch (error) {
      console.log("Error:", error);
      throw error;
    }
  }

  const processEvent = (event) => {
    const { event: eventType, data, name } = event;

    processThoughts();

    if (eventType === 'on_chat_model_stream') {
      processTokens(data);
    } 
    else if (eventType === 'on_chain_stream') {
      processPlan(data);
    }
    else if (eventType === 'on_tool_start') {
      processToolStart(name);
    }
    else if (eventType === 'on_tool_end') {
      processToolEnd(name);
    }
  }

  const processThoughts = () => {
    const capturedThoughts = peekThoughts(sessionId);
    for (; streamedThoughts < capturedThoughts.length; streamedThoughts++) {
      onEvent('chunk', { text: `\n\n💭 *${capturedThoughts[streamedThoughts]}*` });
    }
  }

  const processTokens = (data) => {
    const chunk = data.chunk;
    if (chunk.content && (!chunk.tool_call_chunks || chunk.tool_call_chunks.length === 0)) {
      const text = typeof chunk.content === 'string' 
        ? chunk.content 
        : chunk.content.map(p => p.text || '').join('');
      
      if (text) {
        onEvent('chunk', { text });
        lastAgentContent = (lastAgentContent || '') + text;
      }
    }
  }

  const processPlan = (data) => {
    if (data.chunk && data.chunk.todos) {
      todos = data.chunk.todos;
      if (!planStreamed) {
        planStreamed = true;
        const planText = extractPlan(todos);
        if (planText) onEvent('chunk', { text: '\n\n' + planText });
      }
    }
  }

  const processToolStart = (name) => {
    if (name !== 'write_todos') {
      onEvent('chunk', { text: `\n\n🔧 *Calling \`${name}\`...*` });
    }
  }

  const processToolEnd = (name) => {
    if (name !== 'write_todos') {
      onEvent('chunk', { text: ` (${name}) ✔️` });
    }
  }

  // begin processStream();
  await processStream(stream);

  const reply = extractText(lastAgentContent) || '(no reply)';
  const plan = extractPlan(todos);
  const chart = takeChartConfig(sessionId);
  const thoughts = takeThoughts(sessionId);

  await history.addUserMessage(input.input);
  await history.addAIChatMessage(reply, chart);

  return { reply, chart, plan, thoughts };
}

module.exports = { runAgentStream };