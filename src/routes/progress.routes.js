const express = require('express');
const controller = require('../controllers/progress.controller');
const { authenticate, sameUserOrAdmin } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.use(authenticate, sameUserOrAdmin);

router.get('/', controller.list);
router.get('/:achievementId', controller.getById);
router.put('/:achievementId', controller.recordProgress);
router.delete('/:achievementId', controller.resetProgress);

module.exports = router;
