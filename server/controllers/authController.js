const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    const { username, email, password } = req.body;
    try {
        // 1. Kiểm tra user tồn tại chưa
        const [existingUser] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) return res.status(400).json({ msg: "Tên tài khoản đã tồn tại" });

        // 2. Hash mật khẩu (Mã hóa để admin cũng không xem được mật khẩu)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Lưu vào DB
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
    console.log("Headers:", req.headers['content-type']); // Kiểm tra client gửi gì lên
    console.log("Body nhận được:", req.body); // Xem nó có thực sự undefined không

    const { username, password } = req.body;
    try {
        // 1. Kiểm tra người dùng có tồn tại không
        const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) return res.status(400).json({ msg: "Tài khoản không tồn tại" });

        const user = users[0];

        // 2. Kiểm tra mật khẩu (so sánh mật khẩu nhập vào với mật khẩu đã mã hóa trong DB)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Mật khẩu không chính xác" });

        // 3. Tạo JWT Token (thời hạn 1 ngày)
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
            'SELECT id, username, elo, wins, losses, draws, total_matches FROM users WHERE id = ?',
            [userId]
        );

        if (!user) return res.status(404).json({ msg: 'Không tìm thấy người dùng' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};