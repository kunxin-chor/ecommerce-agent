const { HumanMessage } = require('@langchain/core/messages');
const { agent } = require('../../gemini');
const { MariaDBChatHistory } = require('./MariaDBHistory');

function extractText(content) {
  if (Array.isArray(content)) {
    return content.map(part => (typeof part === 'string' ? part : part.text || '')).join('');
  }
  return content ? content.toString() : '';
}

async function runAgent(input, config) {
  const { sessionId } = config.configurable;
  const history = new MariaDBChatHistory(sessionId);
  const pastMessages = await history.getMessages();

  // The agent runs the full tool-calling loop internally
  const response = await agent.invoke({
    messages: [...pastMessages, new HumanMessage(input.input)],
  });

  // Extract chart config from any chart tool results in the run
  let chart = null;
  for (const message of response.messages) {
    if (message._getType() === 'tool') {
      try {
        const parsed = JSON.parse(extractText(message.content));
        if (parsed.chartConfig) {
          chart = parsed.chartConfig;
        }
      } catch (e) {}
    }
  }

  const lastMessage = response.messages[response.messages.length - 1];
  const reply = extractText(lastMessage.content) || '(no reply)';

  await history.addUserMessage(input.input);
  await history.addAIChatMessage(reply, chart);

  return { reply, chart };
}

module.exports = { runAgent };
