const pool = require('../config/db');

async function findByEmail(email) {
    const [rows] = await pool.execute(
        `SELECT user_id, name, email, password, role,
                accepted_terms, registration_date
         FROM users
         WHERE email = ?`,
        [email]
    );

    return rows[0] || null;
}

async function findById(id) {
    const [rows] = await pool.execute(
        `SELECT user_id, name, email, role,
                accepted_terms, registration_date
         FROM users
         WHERE user_id = ?`,
        [id]
    );

    return rows[0] || null;
}

async function list() {
    const [rows] = await pool.execute(
        `SELECT user_id, name, email, role,
                accepted_terms, registration_date
         FROM users
         ORDER BY user_id DESC`
    );

    return rows;
}

async function create(data) {
    const [result] = await pool.execute(
        `INSERT INTO users
            (name, email, password, role, accepted_terms)
         VALUES (?, ?, ?, 'user', ?)`,
        [
            data.name,
            data.email,
            data.password,
            data.accepted_terms
        ]
    );

    return findById(result.insertId);
}

async function update(id, data) {
    await pool.execute(
        `UPDATE users
         SET name = ?, email = ?
         WHERE user_id = ?`,
        [data.name, data.email, id]
    );

    return findById(id);
}

async function updatePassword(id, password) {
    await pool.execute(
        `UPDATE users
         SET password = ?
         WHERE user_id = ?`,
        [password, id]
    );

    return findById(id);
}

async function remove(id) {
    const [result] = await pool.execute(
        'DELETE FROM users WHERE user_id = ?',
        [id]
    );

    return result.affectedRows > 0;
}

module.exports = {
    findByEmail,
    findById,
    list,
    create,
    update,
    updatePassword,
    remove
};
