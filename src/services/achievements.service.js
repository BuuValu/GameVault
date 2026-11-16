const achievementsRepository = require('../repositories/achievements.repository');
const progressRepository = require('../repositories/progress.repository');
const videoGamesRepository = require('../repositories/video-games.repository');
const { httpError } = require('../utils/errors');
const {
    requestBody,
    parseRouteId,
    requireInteger,
    requireText
} = require('../utils/validations');

const ACHIEVEMENT_TYPES = ['simple', 'progress', 'date'];

function validateAchievement(data) {
    const name = requireText(data.name, 'El nombre', 120);
    const description = requireText(data.description, 'La descripción', 1000);
    const type = data.type === undefined ? 'simple' : data.type;

    if (!ACHIEVEMENT_TYPES.includes(type)) {
        throw httpError(`tipo debe ser uno de: ${ACHIEVEMENT_TYPES.join(', ')}.`);
    }

    let target = null;

    if (type === 'progress') {
        if (data.target === undefined || data.target === null) {
            throw httpError('Los logros de tipo progreso requieren una meta.');
        }
        target = requireInteger(data.target, 'target', { min: 1, max: 1000000 });
    } else if (data.target !== undefined && data.target !== null) {
        throw httpError(`Los logros de tipo ${type} no admiten meta.`);
    }

    return { name, description, type, target };
}

async function listByVideoGame(videoGameId) {
    const id = parseRouteId(videoGameId);

    if (!(await videoGamesRepository.findById(id))) {
        throw httpError('Videojuego no encontrado.', 404);
    }

    return achievementsRepository.listByVideoGame(id);
}

async function getById(id) {
    const achievement = await achievementsRepository.findById(parseRouteId(id));

    if (!achievement) {
        throw httpError('Logro no encontrado.', 404);
    }

    return achievement;
}

async function create(videoGameId, body) {
    const id = parseRouteId(videoGameId);
    const data = validateAchievement(requestBody(body));

    if (!(await videoGamesRepository.findById(id))) {
        throw httpError('Videojuego no encontrado.', 404);
    }

    if (await achievementsRepository.findByName(id, data.name)) {
        throw httpError('Ese videojuego ya tiene un logro con ese nombre.', 409);
    }

    return achievementsRepository.create(id, data);
}

async function update(id, body) {
    const current = await getById(id);
    const data = validateAchievement(requestBody(body));

    const duplicate = await achievementsRepository.findByName(
        current.video_game_id,
        data.name
    );

    if (duplicate && duplicate.achievement_id !== current.achievement_id) {
        throw httpError('Ese videojuego ya tiene un logro con ese nombre.', 409);
    }

    const changesCondition = data.type !== current.type || data.target !== current.target;

    if (
        changesCondition &&
        (await progressRepository.countByAchievement(current.achievement_id)) > 0
    ) {
        throw httpError(
            'No se puede cambiar el tipo ni la meta de un logro que ya tiene progreso registrado.',
            409
        );
    }

    return achievementsRepository.update(current.achievement_id, data);
}

async function remove(id) {
    const achievement = await getById(id);

    await achievementsRepository.remove(achievement.achievement_id);

    return { message: 'Logro eliminado correctamente.' };
}

module.exports = {
    listByVideoGame,
    getById,
    create,
    update,
    remove
};
