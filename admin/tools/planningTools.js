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
  async ({ orders }) => {
    try {
      const created = [];
      const failed = [];

      // Process each order one at a time so a bad product ID does not
      // abort the whole batch - we report the failures at the end instead
      for (const { productId, stockAmount } of orders) {
        const product = await productServices.getProductById(productId);

        if (!product) {
          failed.push({ productId, reason: `No product found with ID ${productId}.` });
          continue;
        }

        // Simulated only - we do not make real changes to the database
        const restockOrder = {
          orderId: `RESTOCK-${Date.now()}-${productId}`,
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
        created.push(restockOrder);
      }

      return JSON.stringify({
        success: failed.length === 0,
        message: `Created ${created.length} restock order(s)` +
          (failed.length > 0 ? `, ${failed.length} failed` : ''),
        created,
        failed
      });
    } catch (error) {
      console.error('createRestockOrders error:', error);
      return 'Error creating restock orders.';
    }
  },
  {
    name: 'create_restock_orders',
    description: 'Create restock orders for one or multiple products in a single call to replenish their inventory. This is a simulation and does not make real changes to the database. Use this when stock levels are low and restocking is needed. Prefer making batch calls over making separate restock calls for each product.',
    schema: z.object({
      orders: z.array(z.object({
        productId: z.number().describe('The ID of the product to restock'),
        stockAmount: z.number().describe('The amount of stock to order'),
      })).describe('The list of restock orders to create'),
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