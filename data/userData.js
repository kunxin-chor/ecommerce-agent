const pool = require("../database");

async function getUserByEmail(email) {
    const [rows] = await pool.query(
        "SELECT * FROM users WHERE email = ?", [email]
    )
    return rows[0];
}

async function getUserById(id) {
    const [rows] = await pool.execute("SELECT * FROM users WHERE id = ?", [id]);
    const [marketingPreferenceRows] = await pool.execute("SELECT preference_id FROM user_marketing_preferences WHERE user_id = ?", [id]);

    // marketingPreferenceRows will be an array of objects. Example
    //
    // [
    //   {
    //       "preference_id": 1
    //   },
    //   {
    //       "preference_id": 2
    //   }
    // ]
    //
    // but we want = [1,2]
    const marketingPreferenceIds = marketingPreferenceRows.map(row => row.preference_id);

    const user = rows[0];
    user.marketingPreference = marketingPreferenceIds;

    return user;
}

// marketingPrefernces will be an array of ids from the marketing_preferences table.
async function createUser(name, email, password, salutation, country, marketingPreferences) {

    const connection = await pool.getConnection();

    // begin a transaction
    // a transaction consists of 2 or more database operations
    // if any of the operation fails, we can rollback to before
    // the transaction begins
    try {
        await connection.beginTransaction();

        // SQL statements
        // 1. create the row in the users table
        const [userResult] = await connection.execute(
            "INSERT INTO users (name, email, password, salutation, country) VALUES (?, ?, ?, ?, ?)",
            [name, email, password, salutation, country]
        )

        // get the ID of the newly created user
        const newUserId = userResult.insertId;

        // 2. for each marketing preferences the user has selected,
        // add one row to the user_marketing_preferences table
        // assuming that marketingPreferences will be an array of ids 
        // each id is the marketing_preference_id
        for (let marketingPreferenceId of marketingPreferences) {
            await connection.execute("INSERT INTO user_marketing_preferences (user_id, preference_id) VALUES (?,?)", [newUserId, marketingPreferenceId])
        }

        await connection.commit(); // make the changes peramanet
    } catch (e) {
        console.error(e);
        await connection.rollback();
    } finally {
        await connection.release();
    }
}

async function updateUser(id, name, email, salutation, country, marketingPreferences) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // SQL statements
        await connection.execute("UPDATE users SET name=?, email=?, salutation=?, country=? WHERE id =?",
            [name, email, salutation, country, id]
        );

        // delete all the existing relationships
        await connection.execute("DELETE FROM user_marketing_preferences WHERE user_id = ?", [id]);

        // re-insert all the relationships
        for (let marketingPreferenceId of marketingPreferences) {
            await connection.execute("INSERT INTO user_marketing_preferences (user_id, preference_id) VALUES (?,?)", [id, marketingPreferenceId])
        }

        await connection.commit();
    } catch (e) {
        console.error(e);
        await connection.rollback();

    } finally {
        connection.release();
    }
}

async function deleteUserById(userId) {

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute("DELETE FROM user_marketing_preferences WHERE user_id = ?", [userId]);
        await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
        await connection.commit();
    } catch (e) {   
        await connection.rollback();
    } finally { 
        connection.release();
    }   

}

module.exports = {
    getUserByEmail,
    getUserById,
    createUser,
    updateUser,
    deleteUserById
}