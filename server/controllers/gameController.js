const db = require('../config/db');

exports.getHistory = async (req, res) => {
    const userId = req.user.id; // Lấy từ Middleware xác thực
    const { opponent, date } = req.query;

    try {
        let query = `
            SELECT g.*, 
            u1.username as p1_name, u2.username as p2_name,
            winner.username as winner_name
            FROM games g
            JOIN users u1 ON g.player1_id = u1.id
            LEFT JOIN users u2 ON g.player2_id = u2.id
            LEFT JOIN users winner ON g.winner_id = winner.id
            WHERE (g.player1_id = ? OR g.player2_id = ?)
        `;
        let params = [userId, userId];

        if (opponent) {
            query += ` AND (u1.username LIKE ? OR u2.username LIKE ?)`;
            params.push(`%${opponent}%`, `%${opponent}%`);
        }
        if (date) {
            query += ` AND DATE(g.end_time) = ?`;
            params.push(date);
        }
        query += ` ORDER BY g.end_time DESC`;

        const [rows] = await db.execute(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getGameMoves = async (req, res) => {
    try {
        const [moves] = await db.execute(
            'SELECT * FROM game_moves WHERE game_id = ? ORDER BY move_order ASC',
            [req.params.id]
        );
        res.json(moves);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};