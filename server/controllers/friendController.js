const db = require('../config/db');

// Tìm kiếm user theo username
exports.searchUsers = async (req, res) => {
    const { username } = req.query;
    const currentUserId = req.user.id;
    
    if (!username || username.trim().length < 2) {
        return res.status(400).json({ error: 'Tên người dùng phải có ít nhất 2 ký tự' });
    }
    
    try {
        const [users] = await db.execute(
            `SELECT id, username, avatar, elo 
             FROM users 
             WHERE username LIKE ? AND id != ?
             LIMIT 10`,
            [`%${username}%`, currentUserId]
        );
        
        // Check friendship status for each user
        const usersWithStatus = await Promise.all(users.map(async (user) => {
            // Check if already friends
            const [[friendship]] = await db.execute(
                `SELECT id FROM friendships 
                 WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
                [currentUserId, user.id, user.id, currentUserId]
            );
            
            // Check pending requests
            const [[sentRequest]] = await db.execute(
                `SELECT id, status FROM friend_requests 
                 WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
                [currentUserId, user.id]
            );
            
            const [[receivedRequest]] = await db.execute(
                `SELECT id, status FROM friend_requests 
                 WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
                [user.id, currentUserId]
            );
            
            let friendStatus = 'none';
            if (friendship) friendStatus = 'friend';
            else if (sentRequest) friendStatus = 'request_sent';
            else if (receivedRequest) friendStatus = 'request_received';
            
            return { ...user, friendStatus };
        }));
        
        res.json(usersWithStatus);
    } catch (err) {
        console.error('Search users error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Gửi lời mời kết bạn
exports.sendFriendRequest = async (req, res) => {
    const fromUserId = req.user.id;
    const { toUserId } = req.body;
    
    if (!toUserId || fromUserId === toUserId) {
        return res.status(400).json({ error: 'Không thể gửi lời mời cho chính mình' });
    }
    
    try {
        // Check if already friends
        const [[existingFriendship]] = await db.execute(
            `SELECT id FROM friendships 
             WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
            [fromUserId, toUserId, toUserId, fromUserId]
        );
        
        if (existingFriendship) {
            return res.status(400).json({ error: 'Đã là bạn bè rồi' });
        }
        
        // Check if request already exists
        const [[existingRequest]] = await db.execute(
            `SELECT id, status FROM friend_requests 
             WHERE from_user_id = ? AND to_user_id = ?`,
            [fromUserId, toUserId]
        );
        
        if (existingRequest) {
            if (existingRequest.status === 'pending') {
                return res.status(400).json({ error: 'Đã gửi lời mời trước đó' });
            }
            // Update rejected request to pending
            await db.execute(
                `UPDATE friend_requests SET status = 'pending', updated_at = NOW() 
                 WHERE id = ?`,
                [existingRequest.id]
            );
        } else {
            // Create new request
            await db.execute(
                `INSERT INTO friend_requests (from_user_id, to_user_id) VALUES (?, ?)`,
                [fromUserId, toUserId]
            );
        }
        
        // Get sender info for notification
        const [[sender]] = await db.execute(
            'SELECT username FROM users WHERE id = ?',
            [fromUserId]
        );
        
        // Create notification for recipient
        await db.execute(
            `INSERT INTO notifications (user_id, type, title, content, data) 
             VALUES (?, 'friend_request', ?, ?, ?)`,
            [
                toUserId,
                '📨 Lời mời kết bạn mới',
                `${sender.username} muốn kết bạn với bạn`,
                JSON.stringify({ fromUserId, fromUsername: sender.username })
            ]
        );
        
        res.json({ message: 'Đã gửi lời mời kết bạn' });
    } catch (err) {
        console.error('Send friend request error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Lấy danh sách lời mời kết bạn nhận được
exports.getFriendRequests = async (req, res) => {
    const userId = req.user.id;
    
    try {
        const [requests] = await db.execute(
            `SELECT fr.id, fr.from_user_id, fr.created_at,
                    u.username, u.avatar, u.elo
             FROM friend_requests fr
             JOIN users u ON fr.from_user_id = u.id
             WHERE fr.to_user_id = ? AND fr.status = 'pending'
             ORDER BY fr.created_at DESC`,
            [userId]
        );
        
        res.json(requests);
    } catch (err) {
        console.error('Get friend requests error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Chấp nhận lời mời kết bạn
exports.acceptFriendRequest = async (req, res) => {
    const userId = req.user.id;
    const { requestId } = req.params;
    
    try {
        // Get the request
        const [[request]] = await db.execute(
            `SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = 'pending'`,
            [requestId, userId]
        );
        
        if (!request) {
            return res.status(404).json({ error: 'Không tìm thấy lời mời' });
        }
        
        // Update request status
        await db.execute(
            `UPDATE friend_requests SET status = 'accepted', updated_at = NOW() WHERE id = ?`,
            [requestId]
        );
        
        // Create friendship (ensure user1_id < user2_id for consistency)
        const user1 = Math.min(request.from_user_id, userId);
        const user2 = Math.max(request.from_user_id, userId);
        
        await db.execute(
            `INSERT INTO friendships (user1_id, user2_id) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE created_at = created_at`,
            [user1, user2]
        );
        
        // Get acceptor info for notification
        const [[acceptor]] = await db.execute(
            'SELECT username FROM users WHERE id = ?',
            [userId]
        );
        
        // Create notification for the requester
        await db.execute(
            `INSERT INTO notifications (user_id, type, title, content, data) 
             VALUES (?, 'friend_accepted', ?, ?, ?)`,
            [
                request.from_user_id,
                '🎉 Lời mời được chấp nhận',
                `${acceptor.username} đã chấp nhận lời mời kết bạn`,
                JSON.stringify({ friendId: userId, friendUsername: acceptor.username })
            ]
        );
        
        res.json({ message: 'Đã chấp nhận lời mời kết bạn' });
    } catch (err) {
        console.error('Accept friend request error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Từ chối lời mời kết bạn
exports.rejectFriendRequest = async (req, res) => {
    const userId = req.user.id;
    const { requestId } = req.params;
    
    try {
        const [result] = await db.execute(
            `UPDATE friend_requests SET status = 'rejected', updated_at = NOW() 
             WHERE id = ? AND to_user_id = ? AND status = 'pending'`,
            [requestId, userId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Không tìm thấy lời mời' });
        }
        
        res.json({ message: 'Đã từ chối lời mời' });
    } catch (err) {
        console.error('Reject friend request error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Lấy danh sách bạn bè
exports.getFriends = async (req, res) => {
    const userId = req.user.id;
    
    try {
        const [friends] = await db.execute(
            `SELECT u.id, u.username, u.avatar, u.elo, f.created_at as friend_since
             FROM friendships f
             JOIN users u ON (
                 (f.user1_id = ? AND f.user2_id = u.id) OR 
                 (f.user2_id = ? AND f.user1_id = u.id)
             )
             ORDER BY u.username`,
            [userId, userId]
        );
        
        res.json(friends);
    } catch (err) {
        console.error('Get friends error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Xóa bạn bè
exports.removeFriend = async (req, res) => {
    const userId = req.user.id;
    const { friendId } = req.params;
    
    try {
        const [result] = await db.execute(
            `DELETE FROM friendships 
             WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
            [userId, friendId, friendId, userId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Không tìm thấy bạn bè này' });
        }
        
        res.json({ message: 'Đã xóa bạn bè' });
    } catch (err) {
        console.error('Remove friend error:', err);
        res.status(500).json({ error: err.message });
    }
};
