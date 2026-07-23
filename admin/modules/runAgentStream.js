const { HumanMessage } = require('@langchain/core/messages');
const { agent } = require('../../gemini');
const { MariaDBChatHistory } = require('../modules/MariaDBHistory');
const { takeChartConfig } = require('../tools/chartTools');

function extractText(content) {
  if (Array.isArray(content)) {
    return content.map(part => (typeof part === 'string' ? part : part.text || '')).join('');
  }
  return content ? content.toString() : '';
}

// onStep(type, data) is called as the agent works, so the route can stream
// progress events to the browser while the run is still going.
async function runAgentStream(input, config, onStep) {
  const { sessionId } = config.configurable;
  const history = new MariaDBChatHistory(sessionId);
  const pastMessages = await history.getMessages();

  const stream = await agent.stream(
    { messages: [...pastMessages, new HumanMessage(input.input)] },
    { ...config, recursionLimit: 50 }
  );

  let planSent = false;
  let lastAgentContent = null;

  for await (const step of stream) {
    // The model_request node carries the model's output: either tool calls or the final text
    if (step.model_request) {
      const agentMsg = step.model_request.messages[0];
      if (agentMsg.tool_calls && agentMsg.tool_calls.length > 0) {
        for (const toolCall of agentMsg.tool_calls) {
          // write_todos is the agent's internal planner, so we don't show it as a tool call
          if (toolCall.name !== 'write_todos') {
            onStep('tool_call', { tool: toolCall.name, args: toolCall.args });
          }
        }
      } else {
        lastAgentContent = agentMsg.content;
      }
    }

    // The tools node carries the results of each tool call
    if (step.tools) {
      for (const toolMsg of step.tools.messages) {
        if (toolMsg.name === 'write_todos') {
          // Only send the plan once, the first time the agent writes it
          if (!planSent) {
            try {
              const todos = JSON.parse(toolMsg.content.replace('Updated todo list to ', ''));
              const plan = '📋 **Plan:**\n' + todos.map((t, i) => `${i + 1}. ${t.content}`).join('\n');
              onStep('plan', { plan });
              planSent = true;
            } catch (e) {}
          }
          continue;
        }

        onStep('tool_result', { tool: toolMsg.name, result: extractText(toolMsg.content).substring(0, 200) });
      }
    }
  }

  const reply = extractText(lastAgentContent) || '(no reply)';

  // Same as runAgent: the chart comes from the server-side store, not from parsing messages
  const chart = takeChartConfig(sessionId);

  await history.addUserMessage(input.input);
  await history.addAIChatMessage(reply, chart);

  return { reply, chart };
}

module.exports = { runAgentStream };