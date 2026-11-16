const pool = require('../config/db');

const SELECT_BASE = `
    SELECT purchase_record.purchase_id, purchase_record.user_id, purchase_record.video_game_id, purchase_record.purchase_date,
           purchase_record.price_paid, purchase_record.status,
           video_game_record.name AS video_game_name,
           user_record.name AS user_name
      FROM purchases AS purchase_record
      JOIN video_games AS video_game_record ON video_game_record.video_game_id = purchase_record.video_game_id
      JOIN users AS user_record ON user_record.user_id = purchase_record.user_id`;

function mapRow(row) {
    return { ...row, price_paid: Number(row.price_paid) };
}

async function list(filters) {
    const conditions = [];
    const params = [];

    if (filters.userId) {
        conditions.push('purchase_record.user_id = ?');
        params.push(filters.userId);
    }

    if (filters.videoGameId) {
        conditions.push('purchase_record.video_game_id = ?');
        params.push(filters.videoGameId);
    }

    if (filters.status) {
        conditions.push('purchase_record.status = ?');
        params.push(filters.status);
    }

    const where = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const [[{ total_count: totalCount }]] = await pool.query(
        `SELECT COUNT(*) AS total_count FROM purchases AS purchase_record ${where}`,
        params
    );

    const [rows] = await pool.query(
        `${SELECT_BASE} ${where}
         ORDER BY purchase_record.purchase_date DESC, purchase_record.purchase_id DESC
         LIMIT ? OFFSET ?`,
        [...params, filters.limit, filters.offset]
    );

    return { total: Number(totalCount), purchases: rows.map(mapRow) };
}

async function findById(id) {
    const [rows] = await pool.execute(
        `${SELECT_BASE} WHERE purchase_record.purchase_id = ?`,
        [id]
    );

    return rows[0] ? mapRow(rows[0]) : null;
}

async function findByUserAndVideoGame(userId, videoGameId) {
    const [rows] = await pool.execute(
        `${SELECT_BASE} WHERE purchase_record.user_id = ? AND purchase_record.video_game_id = ?`,
        [userId, videoGameId]
    );

    return rows[0] ? mapRow(rows[0]) : null;
}

async function create({ userId, videoGameId, price }) {
    const [result] = await pool.execute(
        `INSERT INTO purchases (user_id, video_game_id, price_paid)
         VALUES (?, ?, ?)`,
        [userId, videoGameId, price]
    );

    return findById(result.insertId);
}

async function retryFailed(id, price) {
    const [result] = await pool.execute(
        `UPDATE purchases
            SET status = 'pending', price_paid = ?, purchase_date = NOW()
          WHERE purchase_id = ? AND status = 'failed'`,
        [price, id]
    );

    return result.affectedRows > 0 ? findById(id) : null;
}

async function changeStatus(id, currentStatus, newStatus) {
    const [result] = await pool.execute(
        `UPDATE purchases SET status = ?
          WHERE purchase_id = ? AND status = ?`,
        [newStatus, id, currentStatus]
    );

    return result.affectedRows > 0 ? findById(id) : null;
}

async function removePending(id) {
    const [result] = await pool.execute(
        `DELETE FROM purchases WHERE purchase_id = ? AND status = 'pending'`,
        [id]
    );

    return result.affectedRows > 0;
}

module.exports = {
    list,
    findById,
    findByUserAndVideoGame,
    create,
    retryFailed,
    changeStatus,
    removePending
};
