const progressRepository = require('../repositories/progress.repository');
const achievementsRepository = require('../repositories/achievements.repository');
const purchasesRepository = require('../repositories/purchases.repository');
const usersRepository = require('../repositories/users.repository');
const { httpError } = require('../utils/errors');
const { requestBody, parseRouteId, requireInteger } = require('../utils/validations');

async function requireUser(id) {
    const validId = parseRouteId(id, 'El ID del usuario');

    if (!(await usersRepository.findById(validId))) {
        throw httpError('Usuario no encontrado.', 404);
    }

    return validId;
}

async function list(userId, query) {
    const id = await requireUser(userId);
    const videoGameId = query.video_game_id === undefined
        ? undefined
        : parseRouteId(query.video_game_id, 'video_game_id');

    return progressRepository.listByUser(id, videoGameId);
}

async function getById(userId, achievementId) {
    const id = await requireUser(userId);
    const validAchievementId = parseRouteId(achievementId, 'El ID del logro');

    if (!(await achievementsRepository.findById(validAchievementId))) {
        throw httpError('Logro no encontrado.', 404);
    }

    const progress = await progressRepository.findByUserAndAchievement(id, validAchievementId);

    if (!progress) {
        throw httpError('El usuario aún no tiene progreso en este logro.', 404);
    }

    return progress;
}

async function recordProgress(userId, achievementId, body) {
    const id = await requireUser(userId);
    const validAchievementId = parseRouteId(achievementId, 'El ID del logro');
    const progress = requireInteger(requestBody(body).progress, 'progress', {
        min: 0,
        max: 1000000
    });

    const achievement = await achievementsRepository.findById(validAchievementId);

    if (!achievement) {
        throw httpError('Logro no encontrado.', 404);
    }

    const purchase = await purchasesRepository.findByUserAndVideoGame(
        id,
        achievement.video_game_id
    );

    if (!purchase || purchase.status !== 'confirmed') {
        throw httpError(
            'El usuario necesita una compra confirmada del videojuego para avanzar en sus logros.',
            403
        );
    }

    const effectiveTarget = achievement.type === 'progress' ? achievement.target : 1;

    if (progress > effectiveTarget) {
        throw httpError(`El progreso no puede superar la meta (${effectiveTarget}).`);
    }

    const current = await progressRepository.findByUserAndAchievement(id, validAchievementId);

    if (current && progress < current.progress) {
        throw httpError(
            `El progreso no puede disminuir (actual: ${current.progress}).`,
            409
        );
    }

    const unlocked = progress >= effectiveTarget;
    const unlockDate = unlocked
        ? (current && current.is_unlocked ? current.unlock_date : new Date())
        : null;

    const saved = await progressRepository.save({
        userId: id,
        achievementId: validAchievementId,
        progress,
        unlocked,
        unlockDate
    });

    return { created: !current, progress: saved };
}

async function resetProgress(userId, achievementId) {
    const id = await requireUser(userId);
    const validAchievementId = parseRouteId(achievementId, 'El ID del logro');

    if (!(await progressRepository.remove(id, validAchievementId))) {
        throw httpError('El usuario no tiene progreso registrado en ese logro.', 404);
    }

    return { message: 'Progreso reiniciado correctamente.' };
}

module.exports = { list, getById, recordProgress, resetProgress };
