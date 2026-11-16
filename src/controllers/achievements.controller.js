const achievementsService = require('../services/achievements.service');

async function listByVideoGame(req, res) {
    res.status(200).json(
        await achievementsService.listByVideoGame(req.params.id)
    );
}

async function getById(req, res) {
    res.status(200).json(await achievementsService.getById(req.params.id));
}

async function create(req, res) {
    const achievement = await achievementsService.create(req.params.id, req.body);

    res.status(201)
        .location(`/api/achievements/${achievement.achievement_id}`)
        .json({ message: 'Logro creado correctamente.', achievement });
}

async function update(req, res) {
    const achievement = await achievementsService.update(req.params.id, req.body);

    res.status(200).json({
        message: 'Logro actualizado correctamente.',
        achievement
    });
}

async function remove(req, res) {
    res.status(200).json(await achievementsService.remove(req.params.id));
}

module.exports = {
    listByVideoGame,
    getById,
    create,
    update,
    remove
};
