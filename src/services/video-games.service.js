const videoGamesRepository = require('../repositories/video-games.repository');
const genresRepository = require('../repositories/genres.repository');
const genresService = require('./genres.service');
const { httpError } = require('../utils/errors');
const {
    requestBody,
    parseRouteId,
    requireText,
    optionalText,
    optionalUrl,
    nonNegativeDecimal,
    requireBoolean,
    parseIdList,
    parsePagination,
    paginatedResponse
} = require('../utils/validations');

const AGE_RATINGS = ['TODOS', '3+', '7+', '12+', '16+', '18+'];
const SORT_ORDERS = ['name', 'price_asc', 'price_desc', 'newest', 'top_rated'];
const UPDATABLE_FIELDS = [
    'name', 'image_url', 'description', 'price',
    'age_rating', 'is_active', 'genres'
];

const isAdmin = (user) => Boolean(user) && user.role === 'administrator';

function validateAgeRating(value) {
    const text = typeof value === 'string' ? value.trim().toUpperCase() : '';

    if (!AGE_RATINGS.includes(text)) {
        throw httpError(
            `age_rating debe ser una de: ${AGE_RATINGS.join(', ')}.`
        );
    }

    return text;
}

function validateVideoGame(data) {
    return {
        name: requireText(data.name, 'El nombre', 150),
        image_url: optionalUrl(data.image_url, 'image_url'),
        description: requireText(data.description, 'La descripción', 5000),
        price: nonNegativeDecimal(data.price, 'El precio'),
        age_rating: validateAgeRating(data.age_rating),
        is_active: data.is_active === undefined
            ? true
            : requireBoolean(data.is_active, 'is_active')
    };
}

async function validateGenres(data) {
    if (data.genres === undefined) {
        return undefined;
    }

    const ids = parseIdList(data.genres, 'genres');
    await genresService.requireExistingIds(ids, 'genres');

    return ids;
}

async function requireUniqueName(name, currentId) {
    const existing = await videoGamesRepository.findByName(name);

    if (existing && existing.video_game_id !== currentId) {
        throw httpError('Ya existe un videojuego con ese nombre.', 409);
    }
}

function parseFilters(query, user) {
    const { page, limit, offset } = parsePagination(query);
    const filters = { page, limit, offset };

    if (!isAdmin(user)) {
        filters.active = true;
    } else if (query.is_active !== undefined && query.is_active !== 'all') {
        if (!['true', 'false'].includes(query.is_active)) {
            throw httpError('activo debe ser true, false o todos.');
        }
        filters.active = query.is_active === 'true';
    }

    if (query.q !== undefined) {
        filters.search = optionalText(String(query.q), 'q', 100) || undefined;
    }

    if (query.genre !== undefined) {
        filters.genreId = parseRouteId(query.genre, 'genre');
    }

    for (const [key, field] of [['min_price', 'minPrice'], ['max_price', 'maxPrice']]) {
        if (query[key] !== undefined) {
            const number = Number(query[key]);

            if (query[key] === '' || !Number.isFinite(number) || number < 0) {
                throw httpError(`${key} debe ser un número mayor o igual a 0.`);
            }

            filters[field] = number;
        }
    }

    if (
        filters.minPrice !== undefined &&
        filters.maxPrice !== undefined &&
        filters.minPrice > filters.maxPrice
    ) {
        throw httpError('min_price no puede ser mayor que max_price.');
    }

    if (query.sort !== undefined) {
        if (!SORT_ORDERS.includes(query.sort)) {
            throw httpError(`orden debe ser uno de: ${SORT_ORDERS.join(', ')}.`);
        }
        filters.sortOrder = query.sort;
    }

    return filters;
}

async function list(query, user) {
    const filters = parseFilters(query, user);
    const { total, videoGames } = await videoGamesRepository.list(filters);

    return paginatedResponse(videoGames, total, filters);
}

async function getById(id, user) {
    const videoGame = await videoGamesRepository.findById(parseRouteId(id));

    if (!videoGame || (!videoGame.is_active && !isAdmin(user))) {
        throw httpError('Videojuego no encontrado.', 404);
    }

    return videoGame;
}

async function create(body) {
    const data = requestBody(body);
    const videoGame = validateVideoGame(data);
    const genres = await validateGenres(data);

    await requireUniqueName(videoGame.name);

    return videoGamesRepository.create(videoGame, genres || []);
}

async function replace(id, body) {
    const validId = parseRouteId(id);
    const data = requestBody(body);
    const current = await videoGamesRepository.findById(validId);

    if (!current) {
        throw httpError('Videojuego no encontrado.', 404);
    }

    const videoGame = validateVideoGame({
        ...data,
        is_active: data.is_active === undefined ? current.is_active : data.is_active
    });
    const genres = await validateGenres(data);

    await requireUniqueName(videoGame.name, validId);

    return videoGamesRepository.update(validId, videoGame, genres);
}

async function partialUpdate(id, body) {
    const validId = parseRouteId(id);
    const data = requestBody(body);

    if (!UPDATABLE_FIELDS.some((field) => data[field] !== undefined)) {
        throw httpError(`Debes enviar al menos uno de: ${UPDATABLE_FIELDS.join(', ')}.`);
    }

    const current = await videoGamesRepository.findById(validId);

    if (!current) {
        throw httpError('Videojuego no encontrado.', 404);
    }

    const videoGame = validateVideoGame({ ...current, ...data });
    const genres = await validateGenres(data);

    await requireUniqueName(videoGame.name, validId);

    return videoGamesRepository.update(validId, videoGame, genres);
}

async function remove(id) {
    const validId = parseRouteId(id);

    if (!(await videoGamesRepository.findById(validId))) {
        throw httpError('Videojuego no encontrado.', 404);
    }

    if (await videoGamesRepository.hasPurchases(validId)) {
        throw httpError(
            'No se puede eliminar un videojuego con compras registradas. Desactívalo con PATCH (is_active: false).',
            409
        );
    }

    await videoGamesRepository.remove(validId);

    return { message: 'Videojuego eliminado correctamente.' };
}

async function listGenres(id, user) {
    const videoGame = await getById(id, user);
    return videoGame.genres;
}

async function addGenre(id, genreId) {
    const videoGameId = parseRouteId(id);
    const validGenreId = parseRouteId(genreId, 'El ID del género');

    if (!(await videoGamesRepository.findById(videoGameId))) {
        throw httpError('Videojuego no encontrado.', 404);
    }

    if (!(await genresRepository.findById(validGenreId))) {
        throw httpError('Género no encontrado.', 404);
    }

    const created = await videoGamesRepository.addGenre(
        videoGameId,
        validGenreId
    );
    const videoGame = await videoGamesRepository.findById(videoGameId);

    return { created, genres: videoGame.genres };
}

async function removeGenre(id, genreId) {
    const videoGameId = parseRouteId(id);
    const validGenreId = parseRouteId(genreId, 'El ID del género');

    if (!(await videoGamesRepository.findById(videoGameId))) {
        throw httpError('Videojuego no encontrado.', 404);
    }

    const removed = await videoGamesRepository.removeGenre(
        videoGameId,
        validGenreId
    );

    if (!removed) {
        throw httpError('El videojuego no tiene asociado ese género.', 404);
    }

    return { message: 'Género quitado del videojuego.' };
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
