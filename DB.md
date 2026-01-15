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

-- Thêm Index để tìm kiếm nhanh hơn theo tên đối thủ và ngày tháng
CREATE INDEX idx_game_player1 ON games(player1_id);
CREATE INDEX idx_game_player2 ON games(player2_id);
CREATE INDEX idx_game_time ON games(start_time);





Lấy lịch sử đấu và tên đối thủ (PvP):
SELECT g.*, u2.username as opponent_name 
FROM games g
LEFT JOIN users u2 ON (g.player2_id = u2.id)
WHERE g.player1_id = [MY_ID] OR g.player2_id = [MY_ID]
ORDER BY g.start_time DESC;



Tìm kiếm theo ngày:
SELECT * FROM games 
WHERE (player1_id = [MY_ID] OR player2_id = [MY_ID])
AND DATE(start_time) = '2026-01-12';