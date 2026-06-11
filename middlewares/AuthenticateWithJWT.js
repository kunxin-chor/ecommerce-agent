const jwt = require('jsonwebtoken');

function AuthenticateWithJWT(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            "message": "Authorization header not found or Bearer not found"
        })
    }

    // Usually, the authorization header will look like this:
    // Bearer <token>
    // get the token, we split the header by space and get index 1 from the array
    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId; // subsequent middlewares and routes will be able to access req.userId
        next();
    } catch (error) {
        console.error(error);
        return res.status(401).json({
            "message": error.message
        })
    }


}

module.exports = AuthenticateWithJWT;