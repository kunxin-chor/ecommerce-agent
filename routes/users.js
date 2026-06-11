const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const userServices = require('../services/userServices');
const AuthenticateWithJWT = require('../middlewares/AuthenticateWithJWT');

// POST register a new user
router.post("/", async function (req, res) {
    try {
        const user = await userServices.registerUser(req.body.name,
            req.body.email,
            req.body.password,
            req.body.salutation,
            req.body.marketingPreferences,
            req.body.country
        )
        res.json({
            "message": "Registering a new user"
        })
    } catch (error) {
        console.error(error);
        res.json({
            "error": error
        })
    }

})

router.get('/me', AuthenticateWithJWT, async function(req,res){
    try {
        const user = await userServices.getUserDetailsById(req.userId);
        res.json({
            user
        })

    } catch (e) {
        console.error(e);
        res.status(500).json({
            message:"Error getting user"
        })
    }
})

// PUT /me  Update the currently logged in user identified by the JWT
router.put('/me', AuthenticateWithJWT, async function (req, res) {
    const userId = req.userId;

    try {
        await userServices.updateUser(userId, req.body);
        res.json({
            "message": "Successfully updated user"
        })
    } catch (e) {
        console.error(e);
        res.status(401).json({
            error: e
        })
    }
})

router.delete('/me', AuthenticateWithJWT, async function(req,res){
    try {
        await userServices.deleteUserById(req.userId);
        res.json({
            'message':'User has been deleted'
        })
    } catch (e) {
        console.error(e);
        res.status(400).json({
            error: e
        })
    }
})

router.put('/:id', async function (req, res) {
    try {
        await userServices.updateUser(req.params.id, req.body);
        res.json({
            "message": "Successfully updated user"
        })
    } catch (e) {
        console.error(e);
        res.status(401).json({
            error: e
        })
    }
})

// POST login a user
router.post("/login", async function (req, res) {

    try {
        // 1. extract email and password from req.body
        // const email = req.body.email;
        // const password = req.body.password;
        const { email, password } = req.body;

        // 2. use the user service to log in
        const user = await userServices.loginUser(email, password);

        // 3. create the JWT
        const token = jwt.sign(
            {
                userId: user.id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '2w'
            }
        )

        res.json({
            message: "Login is successful",
            token: token
        })

    } catch (e) {
        console.error(e);
        res.status(400).json({
            'error': e
        })
    }
})

// GET get details of a user
router.get("/me", AuthenticateWithJWT, async function (req, res) {
    const user = await userServices.getUserDetailsById(req.userId);
    res.json({
        user
    })
})



module.exports = router;