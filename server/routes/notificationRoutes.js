const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');

// Lấy tất cả thông báo
router.get('/', auth, notificationController.getNotifications);

// Đánh dấu một thông báo đã đọc
router.put('/:notifId/read', auth, notificationController.markAsRead);

// Đánh dấu tất cả đã đọc
router.put('/read-all', auth, notificationController.markAllAsRead);

module.exports = router;
