const tagsRepository = require('../repositories/tags.repository');
const { createCatalogService } = require('./catalog.service');

module.exports = createCatalogService({
    repository: tagsRepository,
    maxNameLength: 50,
    labels: {
        primaryKey: 'tag_id',
        usageField: 'review_count',
        notFound: 'Etiqueta no encontrada.',
        duplicate: 'Ya existe una etiqueta con ese nombre.',
        inUse: 'No se puede eliminar la etiqueta porque hay reseñas que la usan.',
        deleted: 'Etiqueta eliminada correctamente.'
    }
});
