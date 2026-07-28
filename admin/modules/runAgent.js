const { HumanMessage } = require('@langchain/core/messages');
const { agent, thinkingAgent } = require('../../gemini');
const { MariaDBChatHistory } = require('./MariaDBHistory');
const { takeChartConfig } = require('../tools/chartTools');
const { takeThoughts } = require('./thoughts');
const { extractText, extractPlan, isRecursionLimitError } = require('./agentHelpers');

async function runAgent(input, config, thinking = false) {
  const { sessionId } = config.configurable;
  const history = new MariaDBChatHistory(sessionId);
  const pastMessages = await history.getMessages();
  let response;

  // switch between thinking agent or non-thinking agent
  const activeAgent = thinking ? thinkingAgent : agent;

  try {
    // The agent runs the full tool-calling loop internally.
    // 25 steps (the default) is not enough once planning is involved.
    response = await activeAgent.invoke(
      { messages: [...pastMessages, new HumanMessage(input.input)] },
      { ...config, recursionLimit: 50 }
    );
  } catch (error) {
    if (isRecursionLimitError(error)) {
      // The agent looped too many times. Instead of crashing, apologise in
      // character, save the exchange to history, and let the chat carry on.
      console.error('Agent hit the recursion limit for input:', input.input);
      const reply = 'I was not able to finish that request — it needed more steps than I am allowed to take. Could you break it into smaller requests? For example, ask me to find the low-stock products first, then create the restock orders one product at a time.';
      await history.addUserMessage(input.input);
      await history.addAIChatMessage(reply);
      return { reply, chart: null, plan: null };
    }
    throw error;  // Some other error — let the route's error handler deal with it
  }

  const buildAgentResponse = async () => {
    // The chart config was stored by the chart tool during the run -
    // the model itself never sees it
    const chart = takeChartConfig(sessionId);

    const lastMessage = response.messages[response.messages.length - 1];
    const reply = extractText(lastMessage.content) || '(no reply)';

    // extract out the plan from the agent state
    const plan = extractPlan(response.todos);
    console.log("plan =", plan);

    // Thoughts are display-only: drain them from the store, but do NOT save them to history
    const thoughts = takeThoughts(sessionId);

    await history.addUserMessage(input.input);
    await history.addAIChatMessage(reply, chart);

    return { reply, chart, plan, thoughts };
  }

  return await buildAgentResponse();


}

module.exports = { runAgent };
