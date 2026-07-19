const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const productServices = require('../services/productServices');
const { generateEmbedding } = require('../services/embeddingServices');
const getPoleEmbeddings = require('../modules/getPoleEmbeddings');

const getProductReviewsTool = tool(
  async ({ productId }) => {
    try {
      const reviews = await productServices.getReviewsByProductId(productId);

      return {
        reviews: reviews.map(review => ({
          id: review.id,
          title: review.title,
          rating: review.rating,
          reviewDate: review.review_date,
          reviewText: review.review_text,
          hasEmbedding: !!review.has_embedding
        }))
      };
    } catch (error) {
      console.error('Get product reviews error:', error);

      return { error: 'Error retrieving reviews for this product.' };
    }
  },
  {
    name: 'get_product_reviews',
    description:
      `List all customer reviews for a known product, ordered by most 
      recent first. Use this to see the full raw set of reviews for a 
      product.

      Returns JSON matching one of these shapes:
      - Success: { "reviews": [{ "id": number, "title": string, "rating": number, "reviewDate": string, "reviewText": string, "hasEmbedding": boolean }] }
        ("reviews" is an empty array when the product has no reviews)
      - Failure: { "error": string }`,
    schema: z.object({
      productId: z.number()
        .int()
        .min(1)
        .describe('ID of the product whose reviews should be listed'),
    }),
  }
);

const searchProductReviewsTool = tool(
  async ({ productId, query, limit }) => {
    try {
      const queryEmbedding = await generateEmbedding(query);
      const effectiveLimit = limit || 10;

      const reviews = await productServices.searchReviewEmbeddings(
        productId,
        queryEmbedding,
        effectiveLimit
      );

      if (reviews.length === 0) {
        return {
          results: [],
          note: 'No processed reviews were found. Reviews may not have been embedded yet.'
        };
      }

      return {
        results: reviews.map(review => ({
          id: review.id,
          title: review.title,
          rating: review.rating,
          reviewText: review.review_text,
          distance: review.distance
        }))
      };
    } catch (error) {
      console.error('Search product reviews error:', error);

      return { error: 'Error searching reviews for this product.' };
    }
  },
  {
    name: 'search_product_reviews',
    description:
      `Semantically search a known product's processed (embedded) reviews 
      for the ones most relevant to a natural-language query, e.g. "battery 
      life complaints" or "praise for taste". Only reviews that have already 
      been embedded (hasEmbedding true from get_product_reviews) will be 
      searchable.

      Returns JSON matching one of these shapes:
      - Success: { "results": [{ "id": number, "title": string, "rating": number, "reviewText": string, "distance": number }] }
      - No processed reviews: { "results": [], "note": string }
      - Failure: { "error": string }`,
    schema: z.object({
      productId: z.number()
        .int()
        .min(1)
        .describe('ID of the product whose reviews should be searched'),
      query: z.string().describe(
        'Natural-language description of the kind of review content to find'
      ),
      limit: z.number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe('Maximum number of reviews to return (default 10)'),
    }),
  }
);

const getReviewSentimentPolesTool = tool(
  async ({ productId }) => {
    try {
      const { positive, negative } = await getPoleEmbeddings();

      const [positiveReviews, negativeReviews] = await Promise.all([
        productServices.searchReviewEmbeddings(productId, positive, 5),
        productServices.searchReviewEmbeddings(productId, negative, 5)
      ]);

      if (positiveReviews.length === 0 && negativeReviews.length === 0) {
        return {
          positives: [],
          negatives: [],
          note: 'No processed reviews were found. Reviews may not have been embedded yet.'
        };
      }

      const mapReview = review => ({
        id: review.id,
        title: review.title,
        rating: review.rating,
        reviewText: review.review_text
      });

      return {
        positives: positiveReviews.map(mapReview),
        negatives: negativeReviews.map(mapReview)
      };
    } catch (error) {
      console.error('Review sentiment poles error:', error);

      return { error: 'Error retrieving review sentiment poles for this product.' };
    }
  },
  {
    name: 'get_review_sentiment_poles',
    description:
      `Retrieve the most representative praise (positive pole) and 
      complaint (negative pole) reviews for a known product, based on 
      processed (embedded) reviews. Use this to summarize what customers 
      love versus dislike about a product.

      Returns JSON matching one of these shapes:
      - Success: { "positives": [{ "id": number, "title": string, "rating": number, "reviewText": string }], "negatives": [same shape] }
      - No processed reviews: { "positives": [], "negatives": [], "note": string }
      - Failure: { "error": string }`,
    schema: z.object({
      productId: z.number()
        .int()
        .min(1)
        .describe('ID of the product whose review sentiment poles should be retrieved'),
    }),
  }
);

module.exports = {
  getProductReviewsTool,
  searchProductReviewsTool,
  getReviewSentimentPolesTool
};
