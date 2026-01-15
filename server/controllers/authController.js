const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const [existingUser] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) return res.status(400).json({ msg: "Tên tài khoản đã tồn tại" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await db.execute(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );

        res.status(201).json({ msg: "Đăng ký thành công!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) return res.status(400).json({ msg: "Tài khoản không tồn tại" });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Mật khẩu không chính xác" });

        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                elo: user.elo,
                wins: user.wins,
                losses: user.losses,
                draws: user.draws,
                total_matches: user.total_matches
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.me = async (req, res) => {
    try {
        const userId = req.user.id;
        const [[user]] = await db.execute(
            'SELECT id, username, avatar, elo, wins, losses, draws, total_matches FROM users WHERE id = ?',
            [userId]
        );

        if (!user) return res.status(404).json({ msg: 'Không tìm thấy người dùng' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateAvatar = async (req, res) => {
    const { avatarUrl } = req.body;
    const userId = req.user.id;

    try {
        await db.execute('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, userId]);
        res.json({ msg: "Cập nhật avatar thành công!", avatar: avatarUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- HÀM MỚI: XỬ LÝ UPLOAD FILE ---
exports.uploadAvatarFile = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ msg: "Chưa chọn file" });

        const userId = req.user.id;
        // Tạo URL đầy đủ cho ảnh
        // Lưu ý: Port 5000 là port của server. 
        const fileUrl = `http://localhost:5000/uploads/${req.file.filename}`;

        await db.execute('UPDATE users SET avatar = ? WHERE id = ?', [fileUrl, userId]);
        res.json({ msg: "Upload thành công!", avatar: fileUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};