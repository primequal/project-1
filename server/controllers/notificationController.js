const db = require('../config/db');

// Lấy tất cả thông báo của user
exports.getNotifications = async (req, res) => {
    const userId = req.user.id;
    
    try {
        const [notifications] = await db.execute(
            `SELECT id, type, title, content, data, is_read, created_at
             FROM notifications
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 50`,
            [userId]
        );
        
        // Parse JSON data field and convert is_read to boolean
        const parsed = notifications.map(n => ({
            ...n,
            data: n.data ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data) : null,
            is_read: Boolean(n.is_read) // Convert 0/1 to false/true
        }));
        
        res.json(parsed);
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Đánh dấu thông báo đã đọc
exports.markAsRead = async (req, res) => {
    const userId = req.user.id;
    const { notifId } = req.params;
    
    try {
        await db.execute(
            `UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?`,
            [notifId, userId]
        );
        
        res.json({ message: 'Đã đánh dấu đã đọc' });
    } catch (err) {
        console.error('Mark notification read error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Đánh dấu tất cả thông báo đã đọc
exports.markAllAsRead = async (req, res) => {
    const userId = req.user.id;
    
    try {
        await db.execute(
            `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE`,
            [userId]
        );
        
        res.json({ message: 'Đã đánh dấu tất cả đã đọc' });
    } catch (err) {
        console.error('Mark all notifications read error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Helper function để tạo thông báo ELO (gọi từ server/index.js)
exports.createEloNotification = async (userId, eloChange, opponentName, isWin) => {
    try {
        const sign = eloChange >= 0 ? '+' : '';
        const emoji = eloChange >= 0 ? '📈' : '📉';
        const result = isWin ? 'thắng' : (eloChange === 0 ? 'hòa' : 'thua');
        
        await db.execute(
            `INSERT INTO notifications (user_id, type, title, content, data) 
             VALUES (?, 'elo_change', ?, ?, ?)`,
            [
                userId,
                `${emoji} Biến động ELO: ${sign}${eloChange}`,
                `Sau trận đấu với ${opponentName}, ELO của bạn ${eloChange >= 0 ? 'tăng' : 'giảm'} ${Math.abs(eloChange)} điểm`,
                JSON.stringify({ eloChange, opponentName, result })
            ]
        );
    } catch (err) {
        console.error('Create ELO notification error:', err);
    }
};

// Helper function để tạo thông báo mời chơi game (gọi từ server/index.js)
exports.createGameInviteNotification = async (toUserId, fromUsername, roomId) => {
    try {
        await db.execute(
            `INSERT INTO notifications (user_id, type, title, content, data) 
             VALUES (?, 'game_invite', ?, ?, ?)`,
            [
                toUserId,
                `🎮 ${fromUsername} mời bạn chơi!`,
                `${fromUsername} đã mời bạn vào phòng chơi. Nhấn để tham gia!`,
                JSON.stringify({ fromUsername, roomId })
            ]
        );
    } catch (err) {
        console.error('Create game invite notification error:', err);
    }
};
