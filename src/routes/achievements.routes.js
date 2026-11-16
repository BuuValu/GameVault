const express = require('express');
const controller = require('../controllers/achievements.controller');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/:id', controller.getById);
router.put('/:id', authenticate, adminOnly, controller.update);
router.delete('/:id', authenticate, adminOnly, controller.remove);

module.exports = router;
