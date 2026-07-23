const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const productServices = require('../services/productServices');

const getProductDetailsTool = tool(
  async ({ productId }) => {
    try {
      const product = await productServices.getProductById(productId);
      if (!product) return `No product found with ID ${productId}.`;

      const reviews = await productServices.getReviewsByProductId(productId);
      const reviewText = reviews.length > 0
        ? reviews.map(r => `- [${r.rating}/5] ${r.title}: ${r.review_text}`).join('\n')
        : 'No reviews yet.';

      return JSON.stringify({
        id: product.id,
        name: product.name,
        brand: product.brand,
        price: product.price,
        category: product.category_name,
        stock: product.stock,
        description: product.description,
        reviews: reviewText
      });
    } catch (error) {
      console.error('getProductDetails error:', error);
      return 'Error retrieving product details.';
    }
  },
  {
    name: 'get_product_details',
    description: 'Get full details of a product including its description, price, stock level, category, and customer reviews. Use this when you need comprehensive information about a specific product.',
    schema: z.object({
      productId: z.number().describe('The ID of the product to retrieve details for'),
    }),
  }
);

const createRestockOrderTool = tool(
  async ({ productId, stockAmount }) => {
    try {
      const product = await productServices.getProductById(productId);
      if (!product) return `No product found with ID ${productId}.`;

      // Simulated only - we do not make real changes to the database
      const restockOrder = {
        orderId: `RESTOCK-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        brand: product.brand,
        currentStock: product.stock,
        restockAmount: stockAmount,
        projectedStock: product.stock + stockAmount,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      console.log('[RESTOCK ORDER CREATED]', JSON.stringify(restockOrder, null, 2));

      return JSON.stringify({
        success: true,
        message: `Restock order created for ${product.name} (${product.brand})`,
        order: restockOrder
      });
    } catch (error) {
      console.error('createRestockOrder error:', error);
      return 'Error creating restock order.';
    }
  },
  {
    name: 'create_restock_order',
    description: 'Create a restock order for a product to replenish its inventory. This is a simulation and does not make real changes to the database. Use this when stock levels are low and restocking is needed.',
    schema: z.object({
      productId: z.number().describe('The ID of the product to restock'),
      stockAmount: z.number().describe('The amount of stock to order'),
    }),
  }
);

const getCurrentDateTimeTool = tool(
  async () => {
    const now = new Date();
    return JSON.stringify({
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      datetime: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  },
  {
    name: 'get_current_datetime',
    description: 'Get the current date and time. Use this when you need to know today\'s date for queries, reports, or any time-sensitive operations.',
    schema: z.object({})
  }
);

module.exports = { getProductDetailsTool, createRestockOrderTool, getCurrentDateTimeTool };