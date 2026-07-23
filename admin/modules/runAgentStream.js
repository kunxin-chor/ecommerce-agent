const { HumanMessage } = require('@langchain/core/messages');
const { agent } = require('../../gemini');
const { MariaDBChatHistory } = require('../modules/MariaDBHistory');
const { takeChartConfig } = require('../tools/chartTools');
const {
  isThreadKnown,
  markThreadKnown,
  getAgentConfig,
  extractInterruptValue,
  buildApproval,
  buildResumeCommand
} = require('./hitl');

function extractText(content) {
  if (Array.isArray(content)) {
    return content.map(part => (typeof part === 'string' ? part : part.text || '')).join('');
  }
  return content ? content.toString() : '';
}

// Streams one agent run, calling onStep for each progress event. `input` is
// either { messages } for a fresh run or a resume Command after approval.
// Returns { interrupted, approval } if the run paused, otherwise { reply, chart }.
async function streamRun(input, sessionId, onStep) {
  const stream = await agent.stream(input, getAgentConfig(sessionId));

  let planSent = false;
  let lastAgentContent = null;

  for await (const step of stream) {
    // When the agent pauses for approval, the stream ends with an
    // __interrupt__ chunk instead of a final model message
    const interruptValue = extractInterruptValue(step);
    if (interruptValue) {
      const approval = buildApproval(interruptValue);
      onStep('needs_approval', approval);
      return { interrupted: true, approval };
    }

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

  return { interrupted: false, reply, chart };
}

// onStep(type, data) is called as the agent works, so the route can stream
// progress events to the browser while the run is still going.
async function runAgentStream(input, config, onStep) {
  const { sessionId } = config.configurable;
  const history = new MariaDBChatHistory(sessionId);
  const pastMessages = await history.getMessages();

  // Same rule as before: only send the full history the first time —
  // after that the checkpointer's thread already has the conversation.
  const messages = isThreadKnown(sessionId)
    ? [new HumanMessage(input.input)]
    : [...pastMessages, new HumanMessage(input.input)];

  const result = await streamRun({ messages }, sessionId, onStep);

  // Paused for approval: don't save anything yet
  if (result.interrupted) return result;

  markThreadKnown(sessionId);

  await history.addUserMessage(input.input);
  await history.addAIChatMessage(result.reply, result.chart);

  return result;
}

// Resume a paused run after the human approves or rejects the tool call.
// userText is the original message that triggered the run — we save it to
// the history only now, together with the final reply.
async function resumeAgentStream({ sessionId, approved, message, userText, actionCount }, onStep) {
  const history = new MariaDBChatHistory(sessionId);

  const result = await streamRun(
    buildResumeCommand(approved, actionCount, message),
    sessionId,
    onStep
  );

  // The agent can pause again if there are more tool calls to approve
  if (result.interrupted) return result;

  await history.addUserMessage(userText);
  await history.addAIChatMessage(result.reply, result.chart);

  return result;
}

module.exports = { runAgentStream, resumeAgentStream };
