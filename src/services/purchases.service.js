const purchasesRepository = require('../repositories/purchases.repository');
const videoGamesRepository = require('../repositories/video-games.repository');
const usersRepository = require('../repositories/users.repository');
const { httpError } = require('../utils/errors');
const { isAdmin } = require('../utils/permissions');
const {
    requestBody,
    parseRouteId,
    requireInteger,
    parsePagination,
    paginatedResponse
} = require('../utils/validations');

const PURCHASE_STATUSES = ['pending', 'confirmed', 'failed'];
const TARGET_STATUSES = ['confirmed', 'failed'];


function canView(purchase, user) {
    return isAdmin(user) || purchase.user_id === Number(user.user_id);
}

function parseFilters(query) {
    const filters = parsePagination(query);

    if (query.status !== undefined) {
        if (!PURCHASE_STATUSES.includes(query.status)) {
            throw httpError(`estado debe ser uno de: ${PURCHASE_STATUSES.join(', ')}.`);
        }
        filters.status = query.status;
    }

    if (query.video_game_id !== undefined) {
        filters.videoGameId = parseRouteId(query.video_game_id, 'video_game_id');
    }

    return filters;
}

async function list(query) {
    const filters = parseFilters(query);

    if (query.user_id !== undefined) {
        filters.userId = parseRouteId(query.user_id, 'user_id');
    }

    const { total, purchases } = await purchasesRepository.list(filters);

    return paginatedResponse(purchases, total, filters);
}

async function listByUser(userId, query) {
    const validId = parseRouteId(userId, 'El ID del usuario');
    const filters = { ...parseFilters(query), userId: validId };

    if (!(await usersRepository.findById(validId))) {
        throw httpError('Usuario no encontrado.', 404);
    }

    const { total, purchases } = await purchasesRepository.list(filters);

    return paginatedResponse(purchases, total, filters);
}

async function getById(id, user) {
    const purchase = await purchasesRepository.findById(parseRouteId(id));

    if (!purchase) {
        throw httpError('Compra no encontrada.', 404);
    }

    if (!canView(purchase, user)) {
        throw httpError('No tienes permiso para ver esta compra.', 403);
    }

    return purchase;
}

async function create(user, body) {
    const videoGameId = requireInteger(requestBody(body).video_game_id, 'video_game_id');
    const userId = Number(user.user_id);

    const videoGame = await videoGamesRepository.findById(videoGameId);

    if (!videoGame) {
        throw httpError('El videojuego indicado no existe.', 400);
    }

    if (!videoGame.is_active) {
        throw httpError('El videojuego no está disponible para la compra.', 409);
    }

    const existing = await purchasesRepository.findByUserAndVideoGame(
        userId,
        videoGameId
    );

    if (!existing) {
        return purchasesRepository.create({
            userId,
            videoGameId,
            price: videoGame.price
        });
    }

    if (existing.status === 'failed') {
        const retried = await purchasesRepository.retryFailed(
            existing.purchase_id,
            videoGame.price
        );

        if (retried) {
            return retried;
        }
    }

    throw httpError(
        `Ya tienes una compra de este videojuego (status: ${existing.status}).`,
        409
    );
}

async function changeStatus(id, body) {
    const validId = parseRouteId(id);
    const { status } = requestBody(body);

    if (!TARGET_STATUSES.includes(status)) {
        throw httpError(`estado debe ser uno de: ${TARGET_STATUSES.join(', ')}.`);
    }

    const purchase = await purchasesRepository.findById(validId);

    if (!purchase) {
        throw httpError('Compra no encontrada.', 404);
    }

    if (purchase.status !== 'pending') {
        throw httpError(
            `Solo se puede cambiar el estado de una compra pendiente (actual: ${purchase.status}).`,
            409
        );
    }

    const updated = await purchasesRepository.changeStatus(
        validId,
        'pending',
        status
    );

    if (!updated) {
        throw httpError('La compra cambió de estado mientras se procesaba.', 409);
    }

    return updated;
}

async function cancel(id, user) {
    const purchase = await getById(id, user);

    if (purchase.status !== 'pending') {
        throw httpError(
            `Solo se puede cancelar una compra pendiente (actual: ${purchase.status}).`,
            409
        );
    }

    const deleted = await purchasesRepository.removePending(purchase.purchase_id);

    if (!deleted) {
        throw httpError('La compra cambió de estado mientras se procesaba.', 409);
    }

    return { message: 'Compra cancelada correctamente.' };
}

module.exports = {
    list,
    listByUser,
    getById,
    create,
    changeStatus,
    cancel
};
