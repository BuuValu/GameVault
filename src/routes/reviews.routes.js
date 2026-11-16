const express = require('express');
const controller = require('../controllers/reviews.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', authenticate, controller.create);
router.put('/:id', authenticate, controller.update);
router.delete('/:id', authenticate, controller.remove);

module.exports = router;
