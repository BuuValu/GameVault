const pool = require('../config/db');

async function withTransaction(task) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        const result = await task(connection);
        await connection.commit();
        return result;
    } catch (error) {
        try {
            await connection.rollback();
        } catch {
        }
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { withTransaction };
