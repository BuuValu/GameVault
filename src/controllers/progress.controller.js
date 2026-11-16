const progressService = require('../services/progress.service');

async function list(req, res) {
    res.status(200).json(
        await progressService.list(req.params.id, req.query)
    );
}

async function getById(req, res) {
    res.status(200).json(
        await progressService.getById(req.params.id, req.params.achievementId)
    );
}

async function recordProgress(req, res) {
    const { created, progress } = await progressService.recordProgress(
        req.params.id,
        req.params.achievementId,
        req.body
    );

    res.status(created ? 201 : 200).json({
        message: progress.is_unlocked
            ? 'Progreso guardado. ¡Logro desbloqueado!'
            : 'Progreso guardado correctamente.',
        progress
    });
}

async function resetProgress(req, res) {
    res.status(200).json(
        await progressService.resetProgress(req.params.id, req.params.achievementId)
    );
}

module.exports = { list, getById, recordProgress, resetProgress };
