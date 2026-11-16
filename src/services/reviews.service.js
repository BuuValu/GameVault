const reviewsRepository = require('../repositories/reviews.repository');
const purchasesRepository = require('../repositories/purchases.repository');
const videoGamesRepository = require('../repositories/video-games.repository');
const tagsService = require('./tags.service');
const { httpError } = require('../utils/errors');
const { isAdmin } = require('../utils/permissions');
const {
    requestBody,
    parseRouteId,
    requireInteger,
    optionalText,
    nonNegativeDecimal,
    parseIdList,
    parsePagination,
    paginatedResponse
} = require('../utils/validations');

const MAX_HOURS_PLAYED = 99999.99;


async function validateReviewContent(data) {
    const content = {
        rating: requireInteger(data.rating, 'rating', { min: 1, max: 5 }),
        comment: optionalText(data.comment, 'comment', 2000),
        hours_played: data.hours_played === undefined || data.hours_played === null
            ? null
            : nonNegativeDecimal(data.hours_played, 'hours_played', MAX_HOURS_PLAYED)
    };

    let tags;

    if (data.tags !== undefined) {
        tags = parseIdList(data.tags, 'tags', 10);
        await tagsService.requireExistingIds(tags, 'tags');
    }

    return { content, tags };
}

async function list(query) {
    const filters = parsePagination(query);

    if (query.video_game_id !== undefined) {
        filters.videoGameId = parseRouteId(query.video_game_id, 'video_game_id');
    }

    if (query.user_id !== undefined) {
        filters.userId = parseRouteId(query.user_id, 'user_id');
    }

    if (query.rating !== undefined) {
        filters.rating = requireInteger(
            Number(query.rating),
            'rating',
            { min: 1, max: 5 }
        );
    }

    const { total, reviews } = await reviewsRepository.list(filters);

    return paginatedResponse(reviews, total, filters);
}

async function listByVideoGame(videoGameId, query) {
    const id = parseRouteId(videoGameId);

    if (!(await videoGamesRepository.findById(id))) {
        throw httpError('Videojuego no encontrado.', 404);
    }

    return list({ ...query, video_game_id: id });
}

async function getById(id) {
    const review = await reviewsRepository.findById(parseRouteId(id));

    if (!review) {
        throw httpError('Reseña no encontrada.', 404);
    }

    return review;
}

async function create(user, body) {
    const data = requestBody(body);
    const videoGameId = requireInteger(data.video_game_id, 'video_game_id');
    const userId = Number(user.user_id);
    const { content, tags } = await validateReviewContent(data);

    if (!(await videoGamesRepository.findById(videoGameId))) {
        throw httpError('El videojuego indicado no existe.', 400);
    }

    const purchase = await purchasesRepository.findByUserAndVideoGame(
        userId,
        videoGameId
    );

    if (!purchase) {
        throw httpError('Debes comprar el videojuego antes de reseñarlo.', 403);
    }

    if (purchase.status !== 'confirmed') {
        throw httpError(
            `Tu compra debe estar confirmada para reseñar (status: ${purchase.status}).`,
            403
        );
    }

    if (await reviewsRepository.findByUserAndVideoGame(userId, videoGameId)) {
        throw httpError('Ya reseñaste este videojuego. Edita tu reseña existente.', 409);
    }

    return reviewsRepository.create(
        { ...content, user_id: userId, video_game_id: videoGameId },
        tags || []
    );
}

async function update(id, user, body) {
    const review = await getById(id);

    if (review.user_id !== Number(user.user_id)) {
        throw httpError('Solo el autor puede editar su reseña.', 403);
    }

    const { content, tags } = await validateReviewContent(requestBody(body));

    return reviewsRepository.update(review.review_id, content, tags);
}

async function remove(id, user) {
    const review = await getById(id);

    if (!isAdmin(user) && review.user_id !== Number(user.user_id)) {
        throw httpError('No tienes permiso para eliminar esta reseña.', 403);
    }

    await reviewsRepository.remove(review.review_id);

    return { message: 'Reseña eliminada correctamente.' };
}

module.exports = {
    list,
    listByVideoGame,
    getById,
    create,
    update,
    remove
};
