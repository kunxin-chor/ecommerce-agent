const { HumanMessage } = require('@langchain/core/messages');
const { agent } = require('../../gemini');
const { MariaDBChatHistory } = require('./MariaDBHistory');

function extractText(content) {
  if (Array.isArray(content)) {
    return content.map(part => (typeof part === 'string' ? part : part.text || '')).join('');
  }
  return content ? content.toString() : '';
}

function stripChartConfig(text) {
  if (typeof text !== 'string') return text;
  // Remove any fenced code block that leaks the raw chart configuration object
  return text.replace(/```(?:json)?\s*[\s\S]*?"chartConfig"[\s\S]*?```/gi, '');
}

// The todoListMiddleware stores the agent's plan in the state as an array of
// { content, status } objects. We format it as a markdown list for the chat bubble.
function extractPlan(todos) {
  if (!Array.isArray(todos) || todos.length === 0) return null;
  const lines = todos.map((todo, index) => `${index + 1}. ${todo.content}`);
  return '📋 **Plan:**\n' + lines.join('\n');
}

// LangGraph sets lc_error_code on its own errors, so we can detect this
// without matching on the error message text
function isRecursionLimitError(error) {
  return error && error.lc_error_code === 'GRAPH_RECURSION_LIMIT';
}

async function runAgent(input, config) {
  const { sessionId } = config.configurable;
  const history = new MariaDBChatHistory(sessionId);
  const pastMessages = await history.getMessages();

  try {
    // The agent runs the full tool-calling loop internally.
    // 25 steps (the default) is not enough once planning is involved.
    response = await agent.invoke(
      { messages: [...pastMessages, new HumanMessage(input.input)] },
      { recursionLimit: 50 }
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


  // Extract chart config from any chart tool results in the run
  let chart = null;
  for (const message of response.messages) {
    if (message._getType() === 'tool') {
      try {
        const parsed = JSON.parse(extractText(message.content));
        if (parsed.chartConfig) {
          chart = parsed.chartConfig;
        }
      } catch (e) { }
    }
  }

  const lastMessage = response.messages[response.messages.length - 1];
  const reply = stripChartConfig(extractText(lastMessage.content)) || '(no reply)';

  // extract out the plan from the agent state
  const plan = extractPlan(response.todos);
  console.log("plan =", plan);

  await history.addUserMessage(input.input);
  await history.addAIChatMessage(reply, chart);

  return { reply, chart, plan };
}

module.exports = { runAgent };
