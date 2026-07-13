const { ChatGoogle } = require('@langchain/google/node');

const model = new ChatGoogle({
    model: 'gemini-2.5-flash',
    apiKey: process.env.GEMINI_API_KEY,
});

const modelWithSearch = new ChatGoogle({
  model: 'gemini-2.5-flash',
  apiKey: process.env.GEMINI_API_KEY,
}).bindTools([
  { googleSearchRetrieval: {} }
]);


module.exports = { model, modelWithSearch };