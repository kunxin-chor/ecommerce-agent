const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require("./database");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// require in the routes
const productRouter = require("./routes/products");
const userRouter = require("./routes/users");

// register the router
app.use('/api/products', productRouter);
app.use('/api/users', userRouter);

// Routes
app.get('/', (req, res) => {
  res.json({ message: "Welcome to the API" });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});