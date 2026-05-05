const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');

// All admin routes are protected by auth and adminAuth middlewares
router.use(auth, adminAuth);

router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUser);
router.patch('/users/:id', adminController.updateUser);
router.post('/users/:id/reset-password', adminController.resetPassword);
router.post('/users/:id/ban', adminController.banUser);

module.exports = router;
