function extractText(content) {
  if (Array.isArray(content)) {
    return content.map(part => (typeof part === 'string' ? part : part.text || '')).join('');
  }
  return content ? content.toString() : '';
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


module.exports = {extractText, extractPlan, isRecursionLimitError}