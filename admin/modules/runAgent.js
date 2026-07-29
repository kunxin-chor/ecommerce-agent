const { HumanMessage } = require('@langchain/core/messages');
const { agent, thinkingAgent } = require('../../gemini');
const { MariaDBChatHistory } = require('./MariaDBHistory');
const { takeChartConfig } = require('../tools/chartTools');
const { takeThoughts } = require('./thoughts');
const { extractText, extractPlan, isRecursionLimitError } = require('./agentHelpers');

// admin/modules/runAgent.js, at the top
const { Command } = require('@langchain/langgraph');
const { setPendingApproval, takePendingApproval, approvalReply } = require('./approval');
const { randomUUID } = require('crypto');





// Shared by runAgent and resumeAgent: format the final payload and save the
// exchange to the chat history. Note this is the ONLY place we save - a run
// that is still waiting for approval has not touched the history at all.
async function finalizeRun(sessionId, userInput, response) {
  const history = new MariaDBChatHistory(sessionId);

  // The chart config was stored by the chart tool during the run -
  // the model itself never sees it
  const chart = takeChartConfig(sessionId);

  const lastMessage = response.messages[response.messages.length - 1];
  const reply = extractText(lastMessage.content) || '(no reply)';

  // extract out the plan from the agent state
  const plan = extractPlan(response.todos);

  // Thoughts are display-only: drain them from the store, but do NOT save them to history
  const thoughts = takeThoughts(sessionId);

  await history.addUserMessage(userInput);
  await history.addAIChatMessage(reply, chart);

  return { reply, chart, plan, thoughts };
}

async function runAgent(input, config, thinking = false) {
  const { sessionId } = config.configurable;
  const history = new MariaDBChatHistory(sessionId);
  const pastMessages = await history.getMessages();
  let response;

  // switch between thinking agent or non-thinking agent
  const activeAgent = thinking ? thinkingAgent : agent;

  // A fresh thread per run. The checkpointer's only job is to let us pause
  // and resume WITHIN one run; the long-term memory is still our MariaDB
  // history, which we seed into every run ourselves.
  const threadId = randomUUID();
  const runConfig = {
    ...config,
    configurable: { ...config.configurable, thread_id: threadId },
    recursionLimit: 50
  };

  try {
    response = await activeAgent.invoke(
      { messages: [...pastMessages, new HumanMessage(input.input)] },
      runConfig
    );
  } catch (error) {
    if (isRecursionLimitError(error)) {
      console.error('Agent hit the recursion limit for input:', input.input);
      const reply = 'I was not able to finish that request — it needed more steps than I am allowed to take. Could you break it into smaller requests? For example, ask me to find the low-stock products first, then create the restock orders one product at a time.';
      await history.addUserMessage(input.input);
      await history.addAIChatMessage(reply);
      return { reply, chart: null, plan: null, thoughts: null };
    }
    throw error;
  }

  // If the agent paused to ask for approval, remember how to resume it and
  // ask the question as a normal reply
  if (response.__interrupt__) {
    setPendingApproval(sessionId, { threadId, thinking, input: input.input });
    return { reply: approvalReply(response.__interrupt__[0].value), chart: null, plan: null, thoughts: null };
  }

  return await finalizeRun(sessionId, input.input, response);
}

// Continues a run that is paused on an approval. decisions is an array like
// [{ type: 'approve' }] or [{ type: 'reject', message: '...' }].
async function resumeAgent(sessionId, decisions) {
  const pending = takePendingApproval(sessionId);
  if (!pending) {
    return { reply: 'Nothing is waiting for approval.', chart: null, plan: null, thoughts: null };
  }

  const activeAgent = pending.thinking ? thinkingAgent : agent;
  // LangGraph HITL expects an array of decisions, one for each action request
  const response = await activeAgent.invoke(
    new Command({ resume: { decisions: Array.isArray(decisions) ? decisions : [decisions] } }),
    { 
      configurable: { sessionId, thread_id: pending.threadId }, 
      recursionLimit: 50 
    }
  );

  // Approving one action can reveal the next one that needs approval
  // (for example: approve the plan, then the restock order pauses the run again)
  if (response.__interrupt__) {
    setPendingApproval(sessionId, pending);
    return { reply: approvalReply(response.__interrupt__[0].value), chart: null, plan: null, thoughts: null };
  }

  return await finalizeRun(sessionId, pending.input, response);
}

module.exports = { 
  runAgent,
  resumeAgent 
};

