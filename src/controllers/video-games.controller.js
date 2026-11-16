const videoGamesService = require('../services/video-games.service');

async function list(req, res) {
    res.status(200).json(
        await videoGamesService.list(req.query, req.user)
    );
}

async function getById(req, res) {
    res.status(200).json(
        await videoGamesService.getById(req.params.id, req.user)
    );
}

async function create(req, res) {
    const videoGame = await videoGamesService.create(req.body);

    res.status(201)
        .location(`/api/video-games/${videoGame.video_game_id}`)
        .json({ message: 'Videojuego creado correctamente.', video_game: videoGame });
}

async function replace(req, res) {
    const videoGame = await videoGamesService.replace(
        req.params.id,
        req.body
    );

    res.status(200).json({
        message: 'Videojuego actualizado correctamente.',
        video_game: videoGame
    });
}

async function partialUpdate(req, res) {
    const videoGame = await videoGamesService.partialUpdate(
        req.params.id,
        req.body
    );

    res.status(200).json({
        message: 'Videojuego actualizado correctamente.',
        video_game: videoGame
    });
}

async function remove(req, res) {
    res.status(200).json(await videoGamesService.remove(req.params.id));
}

async function listGenres(req, res) {
    res.status(200).json(
        await videoGamesService.listGenres(req.params.id, req.user)
    );
}

async function addGenre(req, res) {
    const { created, genres } = await videoGamesService.addGenre(
        req.params.id,
        req.params.genreId
    );

    res.status(created ? 201 : 200).json({
        message: created
            ? 'Género asociado al videojuego.'
            : 'El videojuego ya tenía ese género.',
        genres
    });
}

async function removeGenre(req, res) {
    res.status(200).json(
        await videoGamesService.removeGenre(
            req.params.id,
            req.params.genreId
        )
    );
}

module.exports = {
    list,
    getById,
    create,
    replace,
    partialUpdate,
    remove,
    listGenres,
    addGenre,
    removeGenre
};
