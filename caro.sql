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

-- Thêm Index để tìm kiếm nhanh hơn theo tên đối thủ và ngày tháng
CREATE INDEX idx_game_player1 ON games(player1_id);
CREATE INDEX idx_game_player2 ON games(player2_id);
CREATE INDEX idx_game_time ON games(start_time);

-- Index để load lịch sử chat nhanh
CREATE INDEX idx_message_game ON messages(game_id);

SELECT * FROM users;
SELECT * FROM games;
SELECT * FROM game_moves;
SELECT * FROM messages;

-- UPDATE users SET wins=0, losses=0, total_matches=0, elo=1000
-- WHERE id>0;

-- SET FOREIGN_KEY_CHECKS=0;
-- TRUNCATE TABLE games;
-- SET FOREIGN_KEY_CHECKS=1;

-- TRUNCATE TABLE game_moves;