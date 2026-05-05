const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware); // Protect all friend routes

router.post('/add', friendController.addFriend);
router.get('/', friendController.getFriends);

module.exports = router;
