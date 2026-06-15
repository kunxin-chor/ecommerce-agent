const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();
const orderServices = require('../services/orderServices');

router.post('/webhook', express.raw({ type: "application/json" }), async (req, res) => {
    let event = null;
    try {
        // verify the webhook signature
        const sig = req.headers["stripe-signature"];
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (e) {
        console.error(e.message);
        return res.status(400).json({
            "error": e.message
        })
    };
    if (event.type == "checkout.session.completed") {
        const session = event.data.object;
        if (session.metadata && session.metadata.orderId) {
            // get the orderId that the payment is for
            console.log("order id =" + session.metadata.orderId);
            orderServices.updateOrderStatus(session.metadata.orderId, "completed");
        }
    }

    res.json({
        received: true
    })
})

module.exports = router;