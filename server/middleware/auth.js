const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Lấy token từ header Authorization (Bearer <token>)
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ msg: "Không có token, quyền truy cập bị từ chối" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Gán thông tin user vào request (có chứa id)
        next();
    } catch (err) {
        res.status(401).json({ msg: "Token không hợp lệ" });
    }
};