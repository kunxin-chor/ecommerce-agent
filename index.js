const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require("./database");

const app = express();

// Middleware

app.use(cors());

// require in the routes
const productRouter = require("./routes/products");
const userRouter = require("./routes/users");
const cartRouter = require('./routes/cart');
const checkoutRouter = require('./routes/checkout');
const stripeRouter = require('./routes/stripe');

// register the router
app.use('/api/products', [express.json()], productRouter);
app.use('/api/users', [express.json()], userRouter);
app.use('/api/cart', [express.json()], cartRouter);
app.use('/api/checkout', [express.json()], checkoutRouter);
app.use('/api/stripe', stripeRouter);


// Routes
app.get('/', (req, res) => {
  res.json({ message: "Welcome to the API" });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});