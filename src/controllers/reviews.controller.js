const reviewsService = require('../services/reviews.service');

async function list(req, res) {
    res.status(200).json(await reviewsService.list(req.query));
}

async function listByVideoGame(req, res) {
    res.status(200).json(
        await reviewsService.listByVideoGame(req.params.id, req.query)
    );
}

async function getById(req, res) {
    res.status(200).json(await reviewsService.getById(req.params.id));
}

async function create(req, res) {
    const review = await reviewsService.create(req.user, req.body);

    res.status(201)
        .location(`/api/reviews/${review.review_id}`)
        .json({ message: 'Reseña publicada correctamente.', review });
}

async function update(req, res) {
    const review = await reviewsService.update(
        req.params.id,
        req.user,
        req.body
    );

    res.status(200).json({
        message: 'Reseña actualizada correctamente.',
        review
    });
}

async function remove(req, res) {
    res.status(200).json(
        await reviewsService.remove(req.params.id, req.user)
    );
}

module.exports = {
    list,
    listByVideoGame,
    getById,
    create,
    update,
    remove
};
