const genresRepository = require('../repositories/genres.repository');
const { createCatalogService } = require('./catalog.service');

module.exports = createCatalogService({
    repository: genresRepository,
    maxNameLength: 60,
    labels: {
        primaryKey: 'genre_id',
        usageField: 'video_game_count',
        notFound: 'Género no encontrado.',
        duplicate: 'Ya existe un género con ese nombre.',
        inUse: 'No se puede eliminar el género porque hay videojuegos asociados. Quítalo primero de esos videojuegos.',
        deleted: 'Género eliminado correctamente.'
    }
});
