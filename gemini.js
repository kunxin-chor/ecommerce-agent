// migrating to LangChain v1 agent
const { createAgent, todoListMiddleware } = require('langchain');
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

const agent = createAgent({
  model,
  tools,
  prompt: 'You are a helpful admin assistant for an ecommerce store. Format your responses using markdown. When you generate a chart using the generate_apex_chart tool, do NOT include any chart URLs or image links in your text response — the chart will be rendered automatically by the frontend.',
  middleware: [todoListMiddleware()]
});
module.exports = { model, modelWithTools, agent };