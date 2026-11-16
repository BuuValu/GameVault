const express = require('express');

const router = express.Router();

const controller = require('../controllers/users.controller');

const {
    authenticate,
    adminOnly,
    sameUserOrAdmin
} = require('../middleware/auth');

router.post('/', controller.register);

router.get(
    '/',
    authenticate,
    adminOnly,
    controller.list
);

router.get(
    '/:id',
    authenticate,
    sameUserOrAdmin,
    controller.getById
);

router.put(
    '/:id',
    authenticate,
    sameUserOrAdmin,
    controller.update
);

router.patch(
    '/:id/password',
    authenticate,
    sameUserOrAdmin,
    controller.changePassword
);

router.delete(
    '/:id',
    authenticate,
    adminOnly,
    controller.remove
);

module.exports = router;
