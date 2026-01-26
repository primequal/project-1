CREATE DATABASE IF NOT EXISTS caro;
USE caro;

-- 1. Bảng người dùng (Users)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Lưu mật khẩu đã hash (bcrypt)
    email VARCHAR(100) NOT NULL UNIQUE,
    avatar VARCHAR(255) DEFAULT 'default_avatar.png',
    elo INT DEFAULT 1000,
    total_matches INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    draws INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng quản lý ván đấu (Games)
CREATE TABLE IF NOT EXISTS games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player1_id INT NOT NULL, -- Luôn là User ID
    player2_id INT DEFAULT NULL, -- NULL nếu đánh với máy (PvE)
    winner_id INT DEFAULT NULL, -- NULL nếu hòa hoặc chưa kết thúc
    game_type ENUM('PvP', 'PvE', 'PvF') NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    
    FOREIGN KEY (player1_id) REFERENCES users(id),
    FOREIGN KEY (player2_id) REFERENCES users(id),
    FOREIGN KEY (winner_id) REFERENCES users(id)
);

-- 3. Bảng lưu chi tiết từng nước đi (Game Moves) để Replay
CREATE TABLE IF NOT EXISTS game_moves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    player_id INT DEFAULT NULL, -- NULL nếu là máy đánh
    x_coord INT NOT NULL, -- Tọa độ hàng
    y_coord INT NOT NULL, -- Tọa độ cột
    move_order INT NOT NULL, -- Nước đi thứ mấy (1, 2, 3...)
    move_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- 4. Bảng lưu tin nhắn chat trong game
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT DEFAULT NULL,    -- Chat thuộc ván đấu nào (có thể NULL nếu chat sảnh chờ - nâng cao)
    user_id INT NOT NULL,        -- Ai chat
    content TEXT NOT NULL,       -- Nội dung
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- Thêm cột lưu biến động Elo cho Player 1 và Player 2
ALTER TABLE games ADD COLUMN p1_elo_change INT DEFAULT 0;
ALTER TABLE games ADD COLUMN p2_elo_change INT DEFAULT 0;

-- Thêm Index để tìm kiếm nhanh hơn theo tên đối thủ và ngày tháng
CREATE INDEX idx_game_player1 ON games(player1_id);
CREATE INDEX idx_game_player2 ON games(player2_id);
CREATE INDEX idx_game_time ON games(start_time);

-- Index để load lịch sử chat nhanh
CREATE INDEX idx_message_game ON messages(game_id);

-- 5. Bảng lời mời kết bạn (Friend Requests)
CREATE TABLE IF NOT EXISTS friend_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_user_id INT NOT NULL,
    to_user_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_request (from_user_id, to_user_id)
);

-- 6. Bảng bạn bè (Friendships)
CREATE TABLE IF NOT EXISTS friendships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user1_id INT NOT NULL,
    user2_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_friendship (user1_id, user2_id)
);

-- 7. Bảng thông báo (Notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('elo_change', 'friend_request', 'friend_accepted', 'game_invite') NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    data JSON DEFAULT NULL, -- Lưu thêm dữ liệu như elo_change amount, friend_id, etc.
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index cho friend_requests
CREATE INDEX idx_friend_req_from ON friend_requests(from_user_id);
CREATE INDEX idx_friend_req_to ON friend_requests(to_user_id);
CREATE INDEX idx_friend_req_status ON friend_requests(status);

-- Index cho friendships
CREATE INDEX idx_friendship_user1 ON friendships(user1_id);
CREATE INDEX idx_friendship_user2 ON friendships(user2_id);

-- Index cho notifications
CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_read ON notifications(is_read);
CREATE INDEX idx_notif_created ON notifications(created_at);

SELECT * FROM users;
SELECT * FROM games;
SELECT * FROM game_moves;
SELECT * FROM messages;
SELECT * FROM friend_requests;
SELECT * FROM friendships;
SELECT * FROM notifications;

-- UPDATE users SET wins=0, losses=0, total_matches=0, elo=1000
-- WHERE id>0;

-- SET FOREIGN_KEY_CHECKS=0;
-- TRUNCATE TABLE games;
-- SET FOREIGN_KEY_CHECKS=1;

-- TRUNCATE TABLE game_moves;