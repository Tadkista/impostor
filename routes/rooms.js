const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

const Category = require('../models/Category');

router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find({});
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

router.post('/create', roomController.createRoom);
router.post('/join', roomController.joinRoom);
router.post('/leave', roomController.leaveRoom);
router.get('/available', roomController.getAvailableRooms);
router.get('/:code', roomController.getRoomState);

module.exports = router;
