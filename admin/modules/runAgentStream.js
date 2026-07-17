
const { MariaDBChatHistory } = require('./MariaDBHistory');
const { agent } = require('../../gemini');
const { HumanMessage } = require('@langchain/core/messages');


async function runAgentStream(input, config, onStep) {
  const { sessionId } = config.configurable;
  const history = new MariaDBChatHistory(sessionId);
  const pastMessages = await history.getMessages();

  const stream = await agent.stream({
    messages: [...pastMessages, new HumanMessage(input.input)]
  });

  let reply = '';
  let chart = null;
  let lastAgentContent = null;

  for await (const step of stream) {
    if (step.agent) {
      const agentMsg = step.agent.messages[0];
      if (agentMsg.tool_calls && agentMsg.tool_calls.length > 0) {
        for (const toolCall of agentMsg.tool_calls) {
          onStep('tool_call', { tool: toolCall.name, args: toolCall.args });
        }
      } else {
        lastAgentContent = agentMsg.content;
      }
    }

    if (step.tools) {
      for (const toolMsg of step.tools.messages) {
        onStep('tool_result', { tool: toolMsg.name, result: toolMsg.content.substring(0, 200) });
        try {
          const parsed = JSON.parse(toolMsg.content);
          if (parsed.chartConfig) chart = parsed.chartConfig;
        } catch (e) {}
      }
    }
  }

  if (Array.isArray(lastAgentContent)) {
    reply = lastAgentContent.map(part => typeof part === 'string' ? part : part.text || '').join('');
  } else {
    reply = lastAgentContent?.toString() || '(no reply)';
  }

  await history.addUserMessage(input.input);
  await history.addAIChatMessage(reply, chart);

  return { reply, chart };
}

module.exports = { MariaDBChatHistory, runAgentStream };