const pool = require('../database');

async function getOrdersByUserId(userId) {
    const [rows] = await pool.execute("SELECT * FROM users WHERE user_id = ?", [userId]);
    return rows;
}

// orderItems is expected to be an array with objects
// each object has two keys: product_id, price and quantity
async function createOrder(userId, orderItems) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // calculate the total of the order
        let total = 0;
        for (let item of orderItems) {
            total += item.price * item.quantity;
        }

        // create the order
        const [orderResult] = await connection.execute(
            "INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)",
            [userId, total, "pending"]
        ) 

        // create the order items for the order
        for (let item of orderItems) {
            await connection.execute(
                "INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)",
                [orderResult.insertId, item.product_id, item.price]
            )
        }
        await connection.commit();
        return orderResult.insertId;
    } catch (e) {
        console.error(e);
        await connection.rollback();
        throw(e);
    } finally{
        await connection.release();
    }
}

async function updateOrderSessionId(orderId, sessionId) {
    await pool.execute(
        "UPDATE orders SET checkout_session_id = ? WHERE id = ?",
        [sessionId, orderId]
    )
}

async function updateOrderStatus(orderId, newStatus) {
    await pool.execute(
        "UPDATE orders SET status = ? WHERE id = ?",
        [newStatus, orderId]
    );
}

module.exports = {
    getOrdersByUserId, createOrder, updateOrderSessionId, updateOrderStatus
}