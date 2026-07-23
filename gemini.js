// migrating to LangChain v1 agent
const { createAgent, todoListMiddleware, humanInTheLoopMiddleware } = require('langchain');
const { MemorySaver } = require('@langchain/langgraph');
const { ChatGoogle } = require('@langchain/google/node');

const {
  getCompletedOrdersTool,
  getCompletedOrdersForProductTool,
  tabulateSalesTool,
  getLowStockTool
} = require('./admin/tools/salesTools.js');
const { generateApexChartTool } = require('./admin/tools/chartTools');
const { searchProductBySemanticTool, answerProductQuestionTool } = require('./admin/tools/ragTools');
const {
  getProductReviewsTool,
  searchProductReviewsTool,
  getReviewSentimentPolesTool
} = require('./admin/tools/reviewTools');
const {
  getProductDetailsTool,
  createRestockOrderTool,
  getCurrentDateTimeTool
} = require('./admin/tools/planningTools');

const model = new ChatGoogle({
  model: 'gemini-3.1-flash-lite',
  apiKey: process.env.GEMINI_API_KEY,
});

const tools = [
  getCompletedOrdersTool,
  getCompletedOrdersForProductTool,
  tabulateSalesTool,
  getLowStockTool,
  generateApexChartTool,
  searchProductBySemanticTool,
  answerProductQuestionTool,
  getProductReviewsTool,
  searchProductReviewsTool,
  getReviewSentimentPolesTool,
  getProductDetailsTool,
  createRestockOrderTool,
  getCurrentDateTimeTool
];

const modelWithTools = new ChatGoogle({
  model: 'gemini-3.1-flash-lite',
  apiKey: process.env.GEMINI_API_KEY,
}).bindTools(tools);

const checkpointer = new MemorySaver();

const agent = createAgent({
  model,
  tools,
  prompt: 'You are a helpful admin assistant for an ecommerce store. Format your responses using markdown. When you generate a chart using the generate_apex_chart tool, do NOT include any chart URLs, image links, or raw chart configuration JSON in your text response — the chart will be rendered automatically by the frontend. Do not describe the chart config JSON in your reply.',
  middleware: [
    todoListMiddleware(),
    humanInTheLoopMiddleware({
      interruptOn: {
        create_restock_orders: {
          allowedDecisions: ['approve', 'reject'],
          description: (toolCall) => {
            const lines = toolCall.args.orders.map(
              (order, index) => `${index + 1}. Product ID **${order.productId}** — **${order.stockAmount}** units`
            );
            return '⚠️ **Restock Order' + (lines.length > 1 ? 's' : '') + ' Require Approval**\n\n'
              + lines.join('\n')
              + '\n\nType **yes** to approve or **no** to reject.';
          }
        },
        write_todos: {
          allowedDecisions: ['approve', 'reject'],
          description: (toolCall) => {
            const todos = toolCall.args.todos || [];
            const lines = todos.map((todo, index) => {
              const icon = todo.status === 'completed' ? '✅' : todo.status === 'in_progress' ? '⏳' : '⏸️';
              return `${index + 1}. ${icon} ${todo.content}`;
            });
            return '📋 **Review Plan**\n\n'
              + (lines.length ? lines.join('\n') : '(no plan items)')
              + '\n\nType **yes** to approve this plan, or type your feedback to revise it.';
          },
          when: (request) => {
            // Only pause on the initial plan creation, not later progress updates
            return !request.state.todos || request.state.todos.length === 0;
          }
        }
      }
    })
  ],
  checkpointer
});
module.exports = { model, modelWithTools, agent };