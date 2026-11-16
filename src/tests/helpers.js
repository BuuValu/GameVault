process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto_de_prueba';

const jwt = require('jsonwebtoken');

function signToken(payload) {
    return `Bearer ${jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
}

const tokens = {
    admin: signToken({ user_id: 1, role: 'administrator' }),
    ana: signToken({ user_id: 2, role: 'user' }),
    beto: signToken({ user_id: 3, role: 'user' }),
    invalid: 'Bearer token.falso.xyz'
};

const videoGame = {
    video_game_id: 1,
    name: 'Zelda',
    image_url: null,
    description: 'Aventura épica',
    price: 59.99,
    age_rating: '12+',
    is_active: true,
    average_rating: null,
    review_count: 0,
    genres: [{ genre_id: 1, name: 'Acción' }]
};

const purchase = {
    purchase_id: 10,
    user_id: 2,
    video_game_id: 1,
    purchase_date: '2026-10-01T10:00:00.000Z',
    price_paid: 59.99,
    status: 'confirmed',
    video_game_name: 'Zelda',
    user_name: 'Ana'
};

const review = {
    review_id: 5,
    user_id: 2,
    user_name: 'Ana',
    video_game_id: 1,
    video_game_name: 'Zelda',
    rating: 4,
    comment: 'Muy bueno',
    hours_played: 12.5,
    review_date: '2026-10-02T10:00:00.000Z',
    tags: [{ tag_id: 1, name: 'Divertido' }]
};

const achievement = {
    achievement_id: 7,
    video_game_id: 1,
    name: 'Coleccionista',
    description: 'Reúne 10 objetos',
    type: 'progress',
    target: 10
};

const simpleAchievement = {
    achievement_id: 8,
    video_game_id: 1,
    name: 'Primer paso',
    description: 'Empieza el juego',
    type: 'simple',
    target: null
};

function mysqlError(code, message = code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

module.exports = {
    tokens,
    videoGame,
    purchase,
    review,
    achievement,
    simpleAchievement,
    mysqlError
};
