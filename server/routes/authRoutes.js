const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Cấu hình Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Lưu vào folder uploads ở root
    },
    filename: (req, file, cb) => {
        // Đặt tên file: timestamp-tên-gốc (để tránh trùng)
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Giới hạn 5MB
});

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', auth, authController.me);
router.put('/avatar', auth, authController.updateAvatar); 

// Route Upload File mới
router.post('/avatar-upload', auth, upload.single('avatar'), authController.uploadAvatarFile);

module.exports = router;