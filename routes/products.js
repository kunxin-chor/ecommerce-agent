const express = require('express');
const router = express.Router();

const pool = require("../database");

const productServices = require('../services/productServices');

// GET all products
router.get('/', async function(req,res){
    const products = await productServices.getAllProducts();
    res.json({
        "products": products
    })
})

// GET a single product
router.get('/:id', async function(req,res){
    const product = await productServices.getProductById(req.params.id);
    res.json({
        "product": product
    })
})

module.exports = router;