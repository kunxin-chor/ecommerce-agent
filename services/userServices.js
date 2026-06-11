
const userData = require('../data/userData');
const bcrypt = require('bcrypt');

async function registerUser(name, email, password, salutation, marketingPreferences, country ) {

    // make sure that the email has not been used before
    const existingUser = await userData.getUserByEmail(email);
    if (existingUser) {
        throw new Error("Email is already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    return await userData.createUser(name, email, hashedPassword, salutation, country, marketingPreferences);
}

async function updateUser(id, {name, user, email, salutation, marketingPreferences, country}) {
    await userData.updateUser(id, name, email, salutation, country, marketingPreferences);
}

// the password parameter will be in plaintext
async function loginUser(email, password) {
    // 1. find user by their email
    const user = await userData.getUserByEmail(email);

    // 2. check if the password matches
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        throw new Error("Invalid email or password");
    }
    return user;

}

async function getUserDetailsById(userId) {
    return await userData.getUserById(userId)
}

async function deleteUserById(userId) {
    return await userData.deleteUserById(userId);
}

module.exports = {
    registerUser,
    updateUser,
    loginUser,
    getUserDetailsById,
    deleteUserById
}