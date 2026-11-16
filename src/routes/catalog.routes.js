const express = require('express');
const { authenticate, adminOnly } = require('../middleware/auth');

function createCatalogRoutes(controller) {
    const router = express.Router();

    router.get('/', controller.list);
    router.get('/:id', controller.getById);

    router.post('/', authenticate, adminOnly, controller.create);
    router.put('/:id', authenticate, adminOnly, controller.update);
    router.delete('/:id', authenticate, adminOnly, controller.remove);

    return router;
}

module.exports = { createCatalogRoutes };
