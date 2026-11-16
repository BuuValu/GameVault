const pool = require('../config/db');
const { withTransaction } = require('../utils/transaction');

const SELECT_BASE = `
    SELECT video_game_record.video_game_id, video_game_record.name, video_game_record.image_url,
           video_game_record.description, video_game_record.price, video_game_record.age_rating,
           video_game_record.is_active,
           (SELECT ROUND(AVG(review_record.rating), 2)
              FROM reviews AS review_record
             WHERE review_record.video_game_id = video_game_record.video_game_id) AS average_rating,
           (SELECT COUNT(*)
              FROM reviews AS review_record
             WHERE review_record.video_game_id = video_game_record.video_game_id) AS review_count
      FROM video_games AS video_game_record`;

const SORT_ORDERS = {
    name: 'video_game_record.name ASC',
    price_asc: 'video_game_record.price ASC, video_game_record.name ASC',
    price_desc: 'video_game_record.price DESC, video_game_record.name ASC',
    newest: 'video_game_record.video_game_id DESC',
    top_rated: 'average_rating DESC, review_count DESC, video_game_record.name ASC'
};

function mapRow(row) {
    return {
        video_game_id: row.video_game_id,
        name: row.name,
        image_url: row.image_url,
        description: row.description,
        price: Number(row.price),
        age_rating: row.age_rating,
        is_active: Boolean(row.is_active),
        average_rating: row.average_rating === null
            ? null
            : Number(row.average_rating),
        review_count: Number(row.review_count)
    };
}

async function attachGenres(videoGames) {
    if (videoGames.length === 0) {
        return videoGames;
    }

    const [rows] = await pool.query(
        `SELECT video_game_genre_link.video_game_id, genre_record.genre_id, genre_record.name
           FROM video_game_genres AS video_game_genre_link
           JOIN genres AS genre_record ON genre_record.genre_id = video_game_genre_link.genre_id
          WHERE video_game_genre_link.video_game_id IN (?)
          ORDER BY genre_record.name`,
        [videoGames.map((videoGame) => videoGame.video_game_id)]
    );

    return videoGames.map((videoGame) => ({
        ...videoGame,
        genres: rows
            .filter((row) => row.video_game_id === videoGame.video_game_id)
            .map(({ genre_id: genreId, name }) => ({
                genre_id: genreId,
                name
            }))
    }));
}

async function list(filters) {
    const conditions = [];
    const params = [];

    if (filters.active !== undefined) {
        conditions.push('video_game_record.is_active = ?');
        params.push(filters.active ? 1 : 0);
    }

    if (filters.search) {
        conditions.push('video_game_record.name LIKE ?');
        params.push(`%${filters.search.replace(/[\\%_]/g, '\\$&')}%`);
    }

    if (filters.genreId) {
        conditions.push(
            `EXISTS (SELECT 1 FROM video_game_genres AS video_game_genre_link
                      WHERE video_game_genre_link.video_game_id = video_game_record.video_game_id
                        AND video_game_genre_link.genre_id = ?)`
        );
        params.push(filters.genreId);
    }

    if (filters.minPrice !== undefined) {
        conditions.push('video_game_record.price >= ?');
        params.push(filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
        conditions.push('video_game_record.price <= ?');
        params.push(filters.maxPrice);
    }

    const where = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const [[{ total_count: totalCount }]] = await pool.query(
        `SELECT COUNT(*) AS total_count FROM video_games AS video_game_record ${where}`,
        params
    );

    const [rows] = await pool.query(
        `${SELECT_BASE} ${where}
         ORDER BY ${SORT_ORDERS[filters.sortOrder] || SORT_ORDERS.name}
         LIMIT ? OFFSET ?`,
        [...params, filters.limit, filters.offset]
    );

    return {
        total: Number(totalCount),
        videoGames: await attachGenres(rows.map(mapRow))
    };
}

async function findById(id) {
    const [rows] = await pool.execute(
        `${SELECT_BASE} WHERE video_game_record.video_game_id = ?`,
        [id]
    );

    if (rows.length === 0) {
        return null;
    }

    const [videoGame] = await attachGenres([mapRow(rows[0])]);
    return videoGame;
}

async function findByName(name) {
    const [rows] = await pool.execute(
        'SELECT video_game_id, name FROM video_games WHERE name = ?',
        [name]
    );

    return rows[0] || null;
}

async function replaceGenres(connection, videoGameId, genres) {
    await connection.execute(
        'DELETE FROM video_game_genres WHERE video_game_id = ?',
        [videoGameId]
    );

    if (genres.length > 0) {
        await connection.query(
            'INSERT INTO video_game_genres (video_game_id, genre_id) VALUES ?',
            [genres.map((genreId) => [videoGameId, genreId])]
        );
    }
}

async function create(data, genres = []) {
    const id = await withTransaction(async (connection) => {
        const [result] = await connection.execute(
            `INSERT INTO video_games
                (name, image_url, description, price,
                 age_rating, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                data.name,
                data.image_url,
                data.description,
                data.price,
                data.age_rating,
                data.is_active ? 1 : 0
            ]
        );

        if (genres.length > 0) {
            await connection.query(
                'INSERT INTO video_game_genres (video_game_id, genre_id) VALUES ?',
                [genres.map((genreId) => [result.insertId, genreId])]
            );
        }

        return result.insertId;
    });

    return findById(id);
}

async function update(id, data, genres) {
    await withTransaction(async (connection) => {
        await connection.execute(
            `UPDATE video_games
                SET name = ?, image_url = ?, description = ?,
                    price = ?, age_rating = ?, is_active = ?
              WHERE video_game_id = ?`,
            [
                data.name,
                data.image_url,
                data.description,
                data.price,
                data.age_rating,
                data.is_active ? 1 : 0,
                id
            ]
        );

        if (genres !== undefined) {
            await replaceGenres(connection, id, genres);
        }
    });

    return findById(id);
}

async function remove(id) {
    const [result] = await pool.execute(
        'DELETE FROM video_games WHERE video_game_id = ?',
        [id]
    );

    return result.affectedRows > 0;
}

async function hasPurchases(id) {
    const [rows] = await pool.execute(
        'SELECT 1 FROM purchases WHERE video_game_id = ? LIMIT 1',
        [id]
    );

    return rows.length > 0;
}

async function addGenre(videoGameId, genreId) {
    const [result] = await pool.execute(
        `INSERT IGNORE INTO video_game_genres (video_game_id, genre_id)
         VALUES (?, ?)`,
        [videoGameId, genreId]
    );

    return result.affectedRows > 0;
}

async function removeGenre(videoGameId, genreId) {
    const [result] = await pool.execute(
        `DELETE FROM video_game_genres
          WHERE video_game_id = ? AND genre_id = ?`,
        [videoGameId, genreId]
    );

    return result.affectedRows > 0;
}

module.exports = {
    list,
    findById,
    findByName,
    create,
    update,
    remove,
    hasPurchases,
    addGenre,
    removeGenre
};
