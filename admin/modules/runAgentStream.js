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

    if (eventType === 'on_chat_model_start') {
      processChatModelStart();
    }
    else if (eventType === 'on_chat_model_stream') {
      processTokens(data);
    } 
    else if (eventType === 'on_chain_stream') {
      if (data.chunk) {
        if (data.chunk.todos) processPlan(data.chunk.todos);
        if (data.chunk.messages) processStateMessages(data.chunk.messages);
      }
    }
    else if (eventType === 'on_chat_model_end') {
      processChatModelEnd(data);
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

  const processChatModelStart = () => {
    // Reset the accumulator for the new turn.
    // Like runAgentStreamFinal, we only want the content of the turn 
    // that eventually becomes the final human-readable reply.
    lastAgentContent = '';
  }

  const processTokens = (data) => {
    const chunk = data.chunk;
    // Gemini includeThoughts: true sends thoughts as content parts in the stream.
    if (chunk.content) {
      const hasToolCalls = chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0;
      let text = '';
      
      if (typeof chunk.content === 'string') {
        if (!hasToolCalls) text = chunk.content;
      } else if (Array.isArray(chunk.content)) {
        for (const part of chunk.content) {
          if (part.thought === true) {
            if (part.text) onEvent('chunk', { text: `\n\n💭 *${part.text}*` });
          } else if (!hasToolCalls) {
            text += (part.text || '');
          }
        }
      }
      
      if (text) {
        onEvent('chunk', { text });
        if (typeof lastAgentContent !== 'string') lastAgentContent = '';
        lastAgentContent += text;
      }
    }
  }

  const processPlan = (newTodos) => {
    todos = newTodos;
    if (!planStreamed) {
      planStreamed = true;
      const planText = extractPlan(todos);
      if (planText) onEvent('chunk', { text: '\n\n' + planText });
    }
  }

  const processStateMessages = (messages) => {
    // Find the last AI message that doesn't have tool calls. 
    // This is the most likely candidate for the final human response.
    const lastAiMsg = [...messages].reverse().find(m => 
      m._getType() === 'ai' && (!m.tool_calls || m.tool_calls.length === 0)
    );

    if (lastAiMsg) {
      const content = extractText(lastAiMsg.content);
      // If our token accumulator is significantly shorter than the state's content,
      // it means we missed some tokens during the stream.
      if (!lastAgentContent || content.length > lastAgentContent.length) {
        lastAgentContent = content;
      }
    }
  }

  const processChatModelEnd = (data) => {
    // This fires when a model turn completes. 
    // If the turn had no tool calls, it's a 'human' response part.
    const output = data.output;
    if (output && output.tool_calls?.length === 0) {
      const text = extractText(output.content);
      // We've already been accumulating tokens in processTokens, 
      // so we don't need to do anything here unless we want to 
      // 'correct' the accumulation with the final clean text.
      // But we must be careful not to overwrite the WHOLE conversation 
      // if this was just one turn of many.
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