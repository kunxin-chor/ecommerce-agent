const orderData = require('../data/orderData');

async function createOrder(userId, orderItems) {
    return await orderData.createOrder(userId, orderItems);
}

async function updateOrderSessionId(orderId, sessionId) {
    await orderData.updateOrderSessionId(orderId, sessionId);
}

async function updateOrderStatus(orderId, newStatus) {
    await orderData.updateOrderStatus(orderId, newStatus);
}

module.exports = {
    createOrder, updateOrderSessionId, updateOrderStatus
}