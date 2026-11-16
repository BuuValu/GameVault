const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const originalLoad = Module._load;
const executedQueries = [];

const mockRowsByTable = {
    video_games: [{ video_game_id: 5, name: 'Hollow Knight', image_url: null, description: 'Juego', price: '100', age_rating: 'TODOS', is_active: 1, average_rating: null, review_count: 0 }],
    video_game_genres: [{ video_game_id: 5, genre_id: 2, name: 'Acción' }],
    users: [{ user_id: 2, name: 'Usuario test', email: 'test@example.org', password: '123456', role: 'administrator', accepted_terms: 1, registration_date: '2026-01-01' }],
    purchases: [{ purchase_id: 3, user_id: 2, video_game_id: 5, purchase_date: '2026-01-01', price_paid: '100', status: 'confirmed', video_game_name: 'Hollow Knight', user_name: 'Usuario test' }],
    reviews: [{ review_id: 7, user_id: 2, user_name: 'Usuario test', video_game_id: 5, video_game_name: 'Hollow Knight', rating: 5, comment: 'Bien', hours_played: '5', review_date: '2026-01-01' }],
    review_tags: [{ review_id: 7, tag_id: 4, name: 'Increíble' }],
    achievements: [{ achievement_id: 8, video_game_id: 5, name: 'Primer paso', description: 'Completa misión', type: 'progress', target: 10 }],
    achievement_progress: [{ user_id: 2, achievement_id: 8, progress: 3, is_unlocked: 0, unlock_date: null, video_game_id: 5, achievement_name: 'Primer paso', type: 'progress', target: 10 }],
    genres: [{ genre_id: 2, name: 'Acción', video_game_count: 1 }],
    tags: [{ tag_id: 4, name: 'Increíble', review_count: 1 }]
};

const knownTables = new Set(Object.keys(mockRowsByTable));
const TABLE_REFERENCE = /\b(?:FROM|JOIN|UPDATE|INTO)\s+([\w]+)/gi;

function assertKnownTables(sql) {
    for (const match of sql.matchAll(TABLE_REFERENCE)) {
        if (!knownTables.has(match[1])) {
            throw new Error(`Tabla SQL inesperada: ${match[1]} SQL: ${sql}`);
        }
    }
}

let updatePurchaseParams = [];
let insertAchievementParams = [];

const mockPool = {
    async execute(sql, params) {
        return this.query(sql, params);
    },

    async query(sql, params) {
        executedQueries.push({ sql, params });
        assertKnownTables(sql);

        const firstTableMatch = sql.match(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([\w]+)/i);
        let table = firstTableMatch?.[1];


        if (/\bFROM video_games AS video_game_record\b/i.test(sql)) {
            table = 'video_games';
        }

        if (/^\s*SELECT COUNT\(/i.test(sql)) {
            return [[{ total_count: 1 }], []];
        }

        if (/^\s*SELECT 1\b/i.test(sql)) {
            return [[{ exists: 1 }], []];
        }

        if (/^\s*SELECT\b/i.test(sql)) {
            const rows = mockRowsByTable[table] || [];

            if (/\bIN\s*\(\?\)/i.test(sql)) {
                return [rows, []];
            }

            if (/\bWHERE\b/i.test(sql) && /id\s*=\s*\?/i.test(sql)) {
                return [rows.slice(0, 1), []];
            }

            return [rows, []];
        }

        if (/UPDATE purchases SET status/i.test(sql)) {
            updatePurchaseParams = params;
        }

        if (/INSERT INTO achievements/i.test(sql)) {
            insertAchievementParams = params;
        }

        return [{ affectedRows: 1, insertId: 10 }, []];
    }
};

Module._load = function (request, parent, isMain) {
    if (request === 'mysql2/promise') {
        return { createPool: () => mockPool };
    }

    if (request === 'dotenv') {
        return { config: () => {} };
    }

    return originalLoad.apply(this, arguments);
};

async function run() {
    const srcRoot = path.resolve(__dirname, '..', 'src');
    const loadRepository = (name) =>
        require(path.join(srcRoot, 'repositories', `${name}.repository.js`));

    const usersRepository = loadRepository('users');
    const user = await usersRepository.findByEmail('test@example.org');
    assert.equal(user.user_id, 2);
    assert.equal(user.name, 'Usuario test');
    assert.equal(user.role, 'administrator');
    assert.equal(user.password, '123456');

    const genresRepository = loadRepository('genres');
    assert.equal((await genresRepository.list())[0].genre_id, 2);
    assert.deepEqual(await genresRepository.findExistingIds([2]), [2]);

    const tagsRepository = loadRepository('tags');
    assert.deepEqual(await tagsRepository.findExistingIds([4]), [4]);

    const videoGamesRepository = loadRepository('video-games');
    const videoGamesResult = await videoGamesRepository.list({
        active: true,
        sortOrder: 'name',
        limit: 20,
        offset: 0
    });
    assert.equal(videoGamesResult.videoGames[0].video_game_id, 5);
    assert.equal(videoGamesResult.videoGames[0].name, 'Hollow Knight');
    assert.equal(videoGamesResult.videoGames[0].genres[0].name, 'Acción');

    const purchasesRepository = loadRepository('purchases');
    assert.equal((await purchasesRepository.findById(3)).status, 'confirmed');
    await purchasesRepository.changeStatus(3, 'pending', 'confirmed');
    assert.deepEqual(updatePurchaseParams, ['confirmed', 3, 'pending']);
    await purchasesRepository.list({ status: 'confirmed', limit: 20, offset: 0 });
    assert.ok(executedQueries.some((query) =>
        query.sql.includes('purchase_record.status = ?') && query.params.includes('confirmed')
    ));

    const achievementsRepository = loadRepository('achievements');
    assert.equal((await achievementsRepository.findById(8)).type, 'progress');
    await achievementsRepository.create(5, { name: 'Prueba', description: 'desc', type: 'progress', target: 10 });
    assert.equal(insertAchievementParams[3], 'progress');

    const progressRepository = loadRepository('progress');
    const progressRecord = await progressRepository.findByUserAndAchievement(2, 8);
    assert.equal(progressRecord.progress, 3);
    assert.equal(progressRecord.type, 'progress');

    const reviewsRepository = loadRepository('reviews');
    const review = await reviewsRepository.findById(7);
    assert.equal(review.review_id, 7);
    assert.equal(review.tags[0].tag_id, 4);

    console.log(`PASS: users, catalogs, video games, purchases/statuses, achievements/types, progress, reviews; ${executedQueries.length} simulated queries.`);
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
