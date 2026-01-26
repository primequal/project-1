const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const auth = require('../middleware/auth');

// Tìm kiếm user theo username
router.get('/search', auth, friendController.searchUsers);

// Gửi lời mời kết bạn
router.post('/request', auth, friendController.sendFriendRequest);

// Lấy danh sách lời mời nhận được
router.get('/requests', auth, friendController.getFriendRequests);

// Chấp nhận lời mời
router.post('/accept/:requestId', auth, friendController.acceptFriendRequest);

// Từ chối lời mời
router.post('/reject/:requestId', auth, friendController.rejectFriendRequest);

// Lấy danh sách bạn bè
router.get('/', auth, friendController.getFriends);

// Xóa bạn bè
router.delete('/:friendId', auth, friendController.removeFriend);

// Hủy lời mời kết bạn đã gửi (Undo)
router.delete('/request/:toUserId', auth, friendController.undoFriendRequest);

module.exports = router;
