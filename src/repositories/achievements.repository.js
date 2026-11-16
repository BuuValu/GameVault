const pool = require('../config/db');

function mapRow(row) {
    return { ...row, target: row.target === null ? null : Number(row.target) };
}

async function listByVideoGame(videoGameId) {
    const [rows] = await pool.execute(
        `SELECT achievement_id, video_game_id, name, description, type, target
           FROM achievements
          WHERE video_game_id = ?
          ORDER BY achievement_id`,
        [videoGameId]
    );

    return rows.map(mapRow);
}

async function findById(id) {
    const [rows] = await pool.execute(
        `SELECT achievement_id, video_game_id, name, description, type, target
           FROM achievements
          WHERE achievement_id = ?`,
        [id]
    );

    return rows[0] ? mapRow(rows[0]) : null;
}

async function findByName(videoGameId, name) {
    const [rows] = await pool.execute(
        `SELECT achievement_id FROM achievements
          WHERE video_game_id = ? AND name = ?`,
        [videoGameId, name]
    );

    return rows[0] || null;
}

async function create(videoGameId, data) {
    const [result] = await pool.execute(
        `INSERT INTO achievements (video_game_id, name, description, type, target)
         VALUES (?, ?, ?, ?, ?)`,
        [videoGameId, data.name, data.description, data.type, data.target]
    );

    return findById(result.insertId);
}

async function update(id, data) {
    await pool.execute(
        `UPDATE achievements
            SET name = ?, description = ?, type = ?, target = ?
          WHERE achievement_id = ?`,
        [data.name, data.description, data.type, data.target, id]
    );

    return findById(id);
}

async function remove(id) {
    const [result] = await pool.execute(
        'DELETE FROM achievements WHERE achievement_id = ?',
        [id]
    );

    return result.affectedRows > 0;
}

module.exports = {
    listByVideoGame,
    findById,
    findByName,
    create,
    update,
    remove
};
