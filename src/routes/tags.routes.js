const { createCatalogRoutes } = require('./catalog.routes');

module.exports = createCatalogRoutes(require('../controllers/tags.controller'));
