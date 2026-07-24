// migrating to LangChain v1 agent
const { createAgent, todoListMiddleware } = require('langchain');
const { ChatGoogle } = require('@langchain/google/node');

const { thoughtMiddleware, takeThoughts} = require('./admin/modules/thoughts.js')

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
  includeThoughts: true
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
  prompt: `You are a helpful admin assistant for an ecommerce store. Format your responses using markdown. 
  When you generate a chart using the generate_apex_chart tool, do NOT include any chart URLs, image links, or raw chart configuration JSON in your text response. 
  The chart will be rendered automatically by the frontend. 
  Do not describe the chart config JSON in your reply.
  For any request that involves two or more distinct actions, you MUST call write_todos to create a plan before calling any other tool — even if you already know what you will do.
  `,
  middleware: [todoListMiddleware(), thoughtMiddleware]
});
module.exports = { model, modelWithTools, agent };