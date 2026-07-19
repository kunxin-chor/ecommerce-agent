const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const documentServices = require(
  '../services/documentServices'
);
const {
  generateEmbedding
} = require('../services/embeddingServices');

const searchProductBySemanticTool = tool(
  async ({ terms }) => {
    try {
      const queryEmbedding = await generateEmbedding(terms);

      const products =
        await documentServices.searchDistinctProducts(
          queryEmbedding,
          5
        );

      if (products.length === 0) {
        return { results: [] };
      }

      return {
        results: products.map(product => ({
          productId: product.product_id,
          name: product.product_name,
          brand: product.brand,
          distance: product.distance
        }))
      };
    } catch (error) {
      console.error(
        'Semantic product search error:',
        error
      );

      return { error: 'Error searching the product knowledge base.' };
    }
  },
  {
    name: 'search_product_by_semantic',
    description:
      `Search embedded product documentation and return 
      distinct matching products. Use this when the user 
      describes a product but its ID is unknown. Each product 
      is returned only once.

      Returns JSON matching one of these shapes:
      - Success: { "results": [{ "productId": number, "name": string, "brand": string, "distance": number }] }
        ("results" is an empty array when no matches are found)
      - Failure: { "error": string }`,
    schema: z.object({
      terms: z.string().describe(
        `Natural-language description of the product, 
        feature, ingredient, use case, or topic to search for`
      ),
    }),
  }
);

const answerProductQuestionTool = tool(
  async ({ productId, question }) => {
    try {
      const document =
        await documentServices.getByProductId(productId);

      if (!document) {
        return {
          error: `No product documentation was found for product ID ${productId}. The product may not have a PDF.`
        };
      }

      const queryEmbedding =
        await generateEmbedding(question);

      const chunks = await documentServices.searchChunks(
        document.id,
        queryEmbedding,
        5
      );

      if (chunks.length === 0) {
        return {
          error: 'No relevant document chunks were found. The PDF may not have been chunked and embedded yet.'
        };
      }

      return {
        productId,
        chunks: chunks.map(chunk => chunk.chunk_text)
      };
    } catch (error) {
      console.error(
        'Product question retrieval error:',
        error
      );

      return { error: 'Error retrieving product documentation.' };
    }
  },
  {
    name: 'answer_product_question',
    description:
      `Retrieve relevant documentation for a question about a known product. If the product ID is unknown, call search_product_by_semantic first.

      Returns JSON matching one of these shapes:
      - Success: { "productId": number, "chunks": string[] }
      - Failure: { "error": string }`,
    schema: z.object({
      productId: z.number()
        .int()
        .min(1)
        .describe(
          'ID of the product whose documentation should be searched'
        ),
      question: z.string().describe(
        'Question to answer using the product documentation'
      ),
    }),
  }
);

module.exports = {
  searchProductBySemanticTool,
  answerProductQuestionTool
};