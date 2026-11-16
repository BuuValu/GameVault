const express = require('express');
const controller = require('../controllers/video-games.controller');
const reviewsController = require('../controllers/reviews.controller');
const achievementsController = require('../controllers/achievements.controller');
const {
    authenticate,
    authenticateOptional,
    adminOnly
} = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateOptional, controller.list);
router.get('/:id', authenticateOptional, controller.getById);

router.post('/', authenticate, adminOnly, controller.create);
router.put('/:id', authenticate, adminOnly, controller.replace);
router.patch('/:id', authenticate, adminOnly, controller.partialUpdate);
router.delete('/:id', authenticate, adminOnly, controller.remove);

router.get('/:id/genres', authenticateOptional, controller.listGenres);
router.put(
    '/:id/genres/:genreId',
    authenticate,
    adminOnly,
    controller.addGenre
);
router.delete(
    '/:id/genres/:genreId',
    authenticate,
    adminOnly,
    controller.removeGenre
);

router.get('/:id/reviews', reviewsController.listByVideoGame);
router.get('/:id/achievements', achievementsController.listByVideoGame);
router.post(
    '/:id/achievements',
    authenticate,
    adminOnly,
    achievementsController.create
);

module.exports = router;
