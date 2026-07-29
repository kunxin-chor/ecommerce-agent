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

  // check if there are any interruption to handle
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