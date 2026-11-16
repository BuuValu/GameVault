const express = require('express');
const controller = require('../controllers/purchases.controller');
const {
    authenticate,
    adminOnly,
    sameUserOrAdmin
} = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, adminOnly, controller.list);
router.post('/', authenticate, controller.create);
router.get('/:id', authenticate, controller.getById);
router.patch(
    '/:id/status',
    authenticate,
    adminOnly,
    controller.changeStatus
);
router.delete('/:id', authenticate, controller.cancel);

const byUser = express.Router({ mergeParams: true });

byUser.get(
    '/',
    authenticate,
    sameUserOrAdmin,
    controller.listByUser
);

module.exports = { router, byUser };
