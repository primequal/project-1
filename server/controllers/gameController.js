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

// ELO History for chart - returns ELO changes over time
exports.getEloHistory = async (req, res) => {
    const userId = req.user.id;
    const { period } = req.query; // 'week', 'month', 'year'

    try {
        let dateFilter;
        let dateFormat;
        
        switch (period) {
            case 'week':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 7 DAY)';
                dateFormat = '%d/%m'; // day/month
                break;
            case 'year':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 YEAR)';
                dateFormat = '%m/%Y'; // month/year
                break;
            case 'month':
            default:
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
                dateFormat = '%d/%m'; // day/month
                break;
        }

        // Get games with ELO changes for this user
        const [games] = await db.execute(`
            SELECT 
                g.end_time,
                DATE_FORMAT(g.end_time, '${dateFormat}') as label,
                CASE 
                    WHEN g.player1_id = ? THEN g.p1_elo_change
                    ELSE g.p2_elo_change
                END as elo_change
            FROM games g
            WHERE (g.player1_id = ? OR g.player2_id = ?)
                AND g.end_time >= ${dateFilter}
                AND g.game_type != 'pve'
            ORDER BY g.end_time ASC
        `, [userId, userId, userId]);

        // Get current user ELO
        const [[user]] = await db.execute('SELECT elo FROM users WHERE id = ?', [userId]);
        const currentElo = user?.elo || 1000;

        if (games.length === 0) {
            // Return just current ELO if no games
            return res.json([{ label: 'Hiện tại', elo: currentElo }]);
        }

        // Calculate ELO at each point by working backwards from current ELO
        let eloPoints = [];
        let runningElo = currentElo;
        
        // Work backwards to get starting ELO
        for (let i = games.length - 1; i >= 0; i--) {
            runningElo -= (games[i].elo_change || 0);
        }
        
        // Add starting point
        eloPoints.push({ label: 'Bắt đầu', elo: runningElo });
        
        // Now work forward to build the chart data
        for (let i = 0; i < games.length; i++) {
            runningElo += (games[i].elo_change || 0);
            eloPoints.push({
                label: games[i].label,
                elo: runningElo
            });
        }

        res.json(eloPoints);
    } catch (err) {
        console.error('ELO History error:', err);
        res.status(500).json({ error: err.message });
    }
};