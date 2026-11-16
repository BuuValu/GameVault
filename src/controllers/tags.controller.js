const tagsService = require('../services/tags.service');
const { createCatalogController } = require('./catalog.controller');

module.exports = createCatalogController(tagsService, {
    created: 'Etiqueta creada correctamente.',
    updated: 'Etiqueta actualizada correctamente.'
});
