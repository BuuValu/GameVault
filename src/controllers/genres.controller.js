const genresService = require('../services/genres.service');
const { createCatalogController } = require('./catalog.controller');

module.exports = createCatalogController(genresService, {
    created: 'Género creado correctamente.',
    updated: 'Género actualizado correctamente.'
});
