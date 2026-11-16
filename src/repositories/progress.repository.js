const pool = require('../config/db');

const SELECT_BASE = `
    SELECT progress_record.user_id, progress_record.achievement_id, progress_record.progress, progress_record.is_unlocked,
           progress_record.unlock_date,
           achievement_record.video_game_id, achievement_record.name AS achievement_name, achievement_record.type, achievement_record.target
      FROM achievement_progress AS progress_record
      JOIN achievements AS achievement_record ON achievement_record.achievement_id = progress_record.achievement_id`;

function mapRow(row) {
    return {
        ...row,
        is_unlocked: Boolean(row.is_unlocked),
        target: row.target === null ? null : Number(row.target)
    };
}

async function listByUser(userId, videoGameId) {
    const params = [userId];
    let filter = '';

    if (videoGameId) {
        filter = 'AND achievement_record.video_game_id = ?';
        params.push(videoGameId);
    }

    const [rows] = await pool.execute(
        `${SELECT_BASE}
          WHERE progress_record.user_id = ? ${filter}
          ORDER BY achievement_record.video_game_id, progress_record.achievement_id`,
        params
    );

    return rows.map(mapRow);
}

async function findByUserAndAchievement(userId, achievementId) {
    const [rows] = await pool.execute(
        `${SELECT_BASE} WHERE progress_record.user_id = ? AND progress_record.achievement_id = ?`,
        [userId, achievementId]
    );

    return rows[0] ? mapRow(rows[0]) : null;
}

async function save({ userId, achievementId, progress, unlocked, unlockDate }) {
    await pool.execute(
        `INSERT INTO achievement_progress
            (user_id, achievement_id, progress, is_unlocked, unlock_date)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            progress = VALUES(progress),
            is_unlocked = VALUES(is_unlocked),
            unlock_date = VALUES(unlock_date)`,
        [userId, achievementId, progress, unlocked ? 1 : 0, unlockDate]
    );

    return findByUserAndAchievement(userId, achievementId);
}

async function remove(userId, achievementId) {
    const [result] = await pool.execute(
        'DELETE FROM achievement_progress WHERE user_id = ? AND achievement_id = ?',
        [userId, achievementId]
    );

    return result.affectedRows > 0;
}

async function countByAchievement(achievementId) {
    const [[{ total_count: totalCount }]] = await pool.execute(
        'SELECT COUNT(*) AS total_count FROM achievement_progress WHERE achievement_id = ?',
        [achievementId]
    );

    return Number(totalCount);
}

module.exports = {
    listByUser,
    findByUserAndAchievement,
    save,
    remove,
    countByAchievement
};
