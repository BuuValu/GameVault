const pool = require('../config/db');
const { withTransaction } = require('../utils/transaction');

const SELECT_BASE = `
    SELECT review_record.review_id, review_record.user_id, user_record.name AS user_name,
           review_record.video_game_id, video_game_record.name AS video_game_name,
           review_record.rating, review_record.comment, review_record.hours_played, review_record.review_date
      FROM reviews AS review_record
      JOIN users AS user_record ON user_record.user_id = review_record.user_id
      JOIN video_games AS video_game_record
        ON video_game_record.video_game_id = review_record.video_game_id`;

function mapRow(row) {
    return {
        ...row,
        hours_played: row.hours_played === null
            ? null
            : Number(row.hours_played)
    };
}

async function attachTags(reviews) {
    if (reviews.length === 0) {
        return reviews;
    }

    const [rows] = await pool.query(
        `SELECT review_tag_link.review_id, tag_record.tag_id, tag_record.name
           FROM review_tags AS review_tag_link
           JOIN tags AS tag_record ON tag_record.tag_id = review_tag_link.tag_id
          WHERE review_tag_link.review_id IN (?)
          ORDER BY tag_record.name`,
        [reviews.map((review) => review.review_id)]
    );

    return reviews.map((review) => ({
        ...review,
        tags: rows
            .filter((row) => row.review_id === review.review_id)
            .map(({ tag_id: tagId, name }) => ({
                tag_id: tagId,
                name
            }))
    }));
}

async function list(filters) {
    const conditions = [];
    const params = [];

    if (filters.videoGameId) {
        conditions.push('review_record.video_game_id = ?');
        params.push(filters.videoGameId);
    }

    if (filters.userId) {
        conditions.push('review_record.user_id = ?');
        params.push(filters.userId);
    }

    if (filters.rating) {
        conditions.push('review_record.rating = ?');
        params.push(filters.rating);
    }

    const where = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const [[{ total_count: totalCount }]] = await pool.query(
        `SELECT COUNT(*) AS total_count FROM reviews AS review_record ${where}`,
        params
    );

    const [rows] = await pool.query(
        `${SELECT_BASE} ${where}
         ORDER BY review_record.review_date DESC, review_record.review_id DESC
         LIMIT ? OFFSET ?`,
        [...params, filters.limit, filters.offset]
    );

    return {
        total: Number(totalCount),
        reviews: await attachTags(rows.map(mapRow))
    };
}

async function findById(id) {
    const [rows] = await pool.execute(
        `${SELECT_BASE} WHERE review_record.review_id = ?`,
        [id]
    );

    if (rows.length === 0) {
        return null;
    }

    const [review] = await attachTags([mapRow(rows[0])]);
    return review;
}

async function findByUserAndVideoGame(userId, videoGameId) {
    const [rows] = await pool.execute(
        `SELECT review_id FROM reviews
          WHERE user_id = ? AND video_game_id = ?`,
        [userId, videoGameId]
    );

    return rows[0] || null;
}

async function replaceTags(connection, reviewId, tags) {
    await connection.execute(
        'DELETE FROM review_tags WHERE review_id = ?',
        [reviewId]
    );

    if (tags.length > 0) {
        await connection.query(
            'INSERT INTO review_tags (review_id, tag_id) VALUES ?',
            [tags.map((tagId) => [reviewId, tagId])]
        );
    }
}

async function create(data, tags = []) {
    const id = await withTransaction(async (connection) => {
        const [result] = await connection.execute(
            `INSERT INTO reviews
                (user_id, video_game_id, rating,
                 comment, hours_played)
             VALUES (?, ?, ?, ?, ?)`,
            [
                data.user_id,
                data.video_game_id,
                data.rating,
                data.comment,
                data.hours_played
            ]
        );

        await replaceTags(connection, result.insertId, tags);

        return result.insertId;
    });

    return findById(id);
}

async function update(id, data, tags) {
    await withTransaction(async (connection) => {
        await connection.execute(
            `UPDATE reviews
                SET rating = ?, comment = ?, hours_played = ?
              WHERE review_id = ?`,
            [data.rating, data.comment, data.hours_played, id]
        );

        if (tags !== undefined) {
            await replaceTags(connection, id, tags);
        }
    });

    return findById(id);
}

async function remove(id) {
    const [result] = await pool.execute(
        'DELETE FROM reviews WHERE review_id = ?',
        [id]
    );

    return result.affectedRows > 0;
}

module.exports = {
    list,
    findById,
    findByUserAndVideoGame,
    create,
    update,
    remove
};
