const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./config/db');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');
const { calculateNewElo } = require('./utils/eloCalculator');
const caroAI = require('./utils/aiEngine');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "http://localhost:3000" } });

let pvpQueue = [];
let activeGames = {};
let userToRoom = {};
let userToSocket = {}; 

// Helper: Tạo ID phòng ngẫu nhiên cho PvF (5 chữ số)
const generateRoomId = () => {
    return Math.floor(10000 + Math.random() * 90000).toString();
};

// Helper: Xử lý forfeit
const handlePlayerForfeit = async (leavingUserId) => {
    const roomId = userToRoom[leavingUserId];
    if (!roomId) return;
    
    const game = activeGames[roomId];
    if (!game || game.isOver) return;
    
    // Chỉ xử lý tính điểm nếu là PvP hoặc PvF
    if (game.type !== 'pvp' && game.type !== 'pvf') return;
    
    game.isOver = true;
    
    const winnerId = (game.p1.userId === leavingUserId) ? game.p2.userId : game.p1.userId;
    // Nếu phòng PvF chưa đủ 2 người mà chủ phòng thoát -> Không tính là forfeit, chỉ hủy phòng
    if (!winnerId) return;

    const p1Id = game.p1.userId;
    const p2Id = game.p2.userId;
    
    try {
        const [[u1]] = await db.execute('SELECT elo FROM users WHERE id = ?', [p1Id]);
        const [[u2]] = await db.execute('SELECT elo FROM users WHERE id = ?', [p2Id]);
        
        let eloChange = calculateNewElo(u1.elo, u2.elo, false);
        if (winnerId === p2Id) {
            const temp = calculateNewElo(u2.elo, u1.elo, false);
            eloChange = { newRatingA: temp.newRatingB, newRatingB: temp.newRatingA };
        }
        
        const updateStat = (id, elo, field) => db.execute(
            `UPDATE users SET elo = ?, total_matches = total_matches + 1, ${field} = ${field} + 1 WHERE id = ?`, 
            [elo, id]
        );
        
        await updateStat(p1Id, eloChange.newRatingA, winnerId === p1Id ? 'wins' : 'losses');
        await updateStat(p2Id, eloChange.newRatingB, winnerId === p2Id ? 'wins' : 'losses');
        
        const [gameRes] = await db.execute(
            'INSERT INTO games (player1_id, player2_id, winner_id, game_type, end_time) VALUES (?, ?, ?, ?, NOW())', 
            [p1Id, p2Id, winnerId, game.type] // Lưu đúng type (PvP hoặc PvF)
        );
        
        const [[up1]] = await db.execute('SELECT id, username, elo, wins, losses, draws, total_matches FROM users WHERE id = ?', [p1Id]);
        const [[up2]] = await db.execute('SELECT id, username, elo, wins, losses, draws, total_matches FROM users WHERE id = ?', [p2Id]);
        
        const resultData = { winnerId, user1: up1, user2: up2, forfeit: true, forfeitUserId: leavingUserId };
        const winnerSocket = userToSocket[winnerId];
        if (winnerSocket) {
            io.to(winnerSocket).emit('game_result', resultData);
        }
    } catch (err) {
        console.error('Forfeit error:', err);
    }
    
    delete activeGames[roomId];
    delete userToRoom[p1Id];
    delete userToRoom[p2Id];
};

io.on('connection', (socket) => {
    // --- LOGIC MỚI: TẠO PHÒNG PVF ---
    socket.on('create_pvf', ({ user }) => {
        const rawId = generateRoomId();
        const roomId = `pvf_${rawId}`; // Prefix pvf_ để phân biệt
        
        // Tạo game mới với 1 người chơi
        activeGames[roomId] = {
            p1: { userId: user.id, user: user },
            p2: null, // Chưa có người thứ 2
            board: Array(15).fill(null).map(() => Array(15).fill(null)),
            currentTurn: user.id, // Chủ phòng đi trước
            moves: [],
            type: 'pvf',
            isOver: false
        };
        
        userToRoom[user.id] = roomId;
        userToSocket[user.id] = socket.id;
        socket.join(roomId);

        // Gửi mã phòng (chỉ lấy phần số) về cho client hiển thị
        socket.emit('pvf_created', { roomId: rawId });
    });

    // --- LOGIC MỚI: THAM GIA PHÒNG PVF ---
    socket.on('join_pvf', ({ user, roomId }) => {
        const fullRoomId = `pvf_${roomId}`;
        const game = activeGames[fullRoomId];

        // 2.2.1. Room không tồn tại
        if (!game) {
            return socket.emit('pvf_error', "Phòng không tồn tại hoặc chủ phòng đã thoát.");
        }

        // 2.2.3. Room đã đầy (đã có p2)
        if (game.p2) {
            return socket.emit('pvf_error', "Phòng đã đầy người chơi.");
        }

        // 2.2.2. Ghép cặp thành công
        game.p2 = { userId: user.id, user: user };
        userToRoom[user.id] = fullRoomId;
        userToSocket[user.id] = socket.id;
        
        const p1SocketId = userToSocket[game.p1.userId];
        const p1Socket = io.sockets.sockets.get(p1SocketId);
        
        socket.join(fullRoomId);
        if (p1Socket) p1Socket.join(fullRoomId);

        // Phát sự kiện bắt đầu game (Reuse logic của PvP)
        io.to(p1SocketId).emit('role_assigned', { roomId: fullRoomId, piece: 'X', turn: true, opponent: game.p2.user, board: game.board });
        io.to(socket.id).emit('role_assigned', { roomId: fullRoomId, piece: 'O', turn: false, opponent: game.p1.user, board: game.board });
    });


    socket.on('join_game', ({ type, user }) => {
        if (!user) return;
        const userId = user.id;
        userToSocket[userId] = socket.id;

        // Xử lý reconnect hoặc dọn dẹp phòng cũ
        if (userToRoom[userId]) {
            const oldRoomId = userToRoom[userId];
            if (!oldRoomId.startsWith(type)) {
                // Nếu đang ở phòng PvF mà chuyển sang PvP -> Xóa phòng PvF
                if (activeGames[oldRoomId]) delete activeGames[oldRoomId];
                delete userToRoom[userId];
                socket.leave(oldRoomId);
            } else {
                // Reconnect (Chỉ áp dụng nếu game đã bắt đầu)
                const game = activeGames[oldRoomId];
                if (game && game.p2) { // Chỉ reconnect nếu đã đủ 2 người (với PvF/PvP)
                    socket.join(oldRoomId);
                    socket.emit('game_ready', {
                        roomId: oldRoomId,
                        piece: game.p1.userId === userId ? 'X' : 'O',
                        turn: game.currentTurn === userId,
                        opponent: game.p1.userId === userId ? game.p2.user : game.p1.user,
                        board: game.board
                    });
                    return;
                }
            }
        }

        if (type === 'pve') {
            const roomId = `pve_${userId}`;
            socket.join(roomId);
            activeGames[roomId] = {
                p1: { userId: userId, user: user },
                p2: { userId: 'AI_BOT', user: { username: 'Máy (AI)' } },
                board: Array(15).fill(null).map(() => Array(15).fill(null)),
                currentTurn: userId,
                moves: [],
                type: 'pve',
                isOver: false
            };
            userToRoom[userId] = roomId;
            socket.emit('game_ready', { 
                roomId, piece: 'X', turn: true, 
                opponent: { username: 'Máy (AI)' }, 
                board: activeGames[roomId].board 
            });
        } 
        else if (type === 'pvp') {
            if (pvpQueue.find(p => p.user.id === userId)) return;
            pvpQueue.push({ socketId: socket.id, user });

            if (pvpQueue.length >= 2) {
                const p1 = pvpQueue.shift();
                const p2 = pvpQueue.shift();
                const roomId = `pvp_${p1.user.id}_${p2.user.id}`;

                activeGames[roomId] = {
                    p1: { userId: p1.user.id, user: p1.user },
                    p2: { userId: p2.user.id, user: p2.user },
                    board: Array(15).fill(null).map(() => Array(15).fill(null)),
                    currentTurn: p1.user.id,
                    moves: [],
                    type: 'pvp',
                    isOver: false
                };
                userToRoom[p1.user.id] = roomId;
                userToRoom[p2.user.id] = roomId;

                const s1 = io.sockets.sockets.get(p1.socketId);
                const s2 = io.sockets.sockets.get(p2.socketId);
                if (s1) s1.join(roomId);
                if (s2) s2.join(roomId);

                io.to(p1.socketId).emit('role_assigned', { roomId, piece: 'X', turn: true, opponent: p2.user, board: activeGames[roomId].board });
                io.to(p2.socketId).emit('role_assigned', { roomId, piece: 'O', turn: false, opponent: p1.user, board: activeGames[roomId].board });
            }
        }
        // Lưu ý: PvF không dùng logic auto-join ở đây, mà dùng event riêng ở trên
    });

    socket.on('send_message', async (data) => {
        const { roomId, userId, content, username } = data;
        if (!roomId || !content.trim()) return;
        io.to(roomId).emit('receive_message', { userId, username, content });
        try {
            const uid = parseInt(userId);
            if (!isNaN(uid)) {
                await db.execute('INSERT INTO messages (user_id, content, created_at) VALUES (?, ?, NOW())', [uid, content]);
            }
        } catch (err) { console.error("[CHAT] DB Error:", err.message); }
    });

    socket.on('make_move', (data) => {
        const { roomId, r, c, piece, userId, type } = data;
        const game = activeGames[roomId];
        if (!game || game.isOver) return; 

        game.board[r][c] = piece;
        game.moves.push({ r, c, piece, userId });

        if (type === 'pve') {
            const aiMove = caroAI.minimax(game.board, 3, -Infinity, Infinity, true);
            if (aiMove.r !== -1) {
                game.board[aiMove.r][aiMove.c] = 'O';
                game.moves.push({ r: aiMove.r, c: aiMove.c, piece: 'O', userId: 'AI_BOT' });
                socket.emit('receive_move', { r: aiMove.r, c: aiMove.c, piece: 'O' });
            }
        } else {
            const opponentId = (game.p1.userId === userId) ? game.p2.userId : game.p1.userId;
            game.currentTurn = opponentId;
            io.to(roomId).emit('receive_move', { r, c, piece });
        }
    });

    socket.on('game_over', async (data) => {
        const { roomId, winnerId, isDraw } = data;
        const game = activeGames[roomId];
        if (!game || game.isOver) return;

        game.isOver = true;

        try {
            const p1Id = game.p1.userId;
            const p2Id = game.p2.userId;

            // Tính điểm cho cả PvP và PvF
            if (game.type === 'pvp' || game.type === 'pvf') {
                const [[u1]] = await db.execute('SELECT elo FROM users WHERE id = ?', [p1Id]);
                const [[u2]] = await db.execute('SELECT elo FROM users WHERE id = ?', [p2Id]);
                
                let eloChange = calculateNewElo(u1.elo, u2.elo, isDraw);
                if (winnerId === p2Id) {
                    const temp = calculateNewElo(u2.elo, u1.elo, isDraw);
                    eloChange = { newRatingA: temp.newRatingB, newRatingB: temp.newRatingA };
                }

                const updateStat = (id, elo, field) => db.execute(`UPDATE users SET elo = ?, total_matches = total_matches + 1, ${field} = ${field} + 1 WHERE id = ?`, [elo, id]);

                await updateStat(p1Id, eloChange.newRatingA, isDraw ? 'draws' : (winnerId === p1Id ? 'wins' : 'losses'));
                await updateStat(p2Id, eloChange.newRatingB, isDraw ? 'draws' : (winnerId === p2Id ? 'wins' : 'losses'));

                const [gameRes] = await db.execute('INSERT INTO games (player1_id, player2_id, winner_id, game_type, end_time) VALUES (?, ?, ?, ?, NOW())', [p1Id, p2Id, winnerId, game.type]);
                
                for (let i = 0; i < game.moves.length; i++) {
                    const m = game.moves[i];
                    await db.execute('INSERT INTO game_moves (game_id, player_id, x_coord, y_coord, move_order) VALUES (?, ?, ?, ?, ?)', [gameRes.insertId, m.userId === 'AI_BOT' ? 0 : m.userId, m.r, m.c, i + 1]);
                }
            }

            const [[up1]] = await db.execute('SELECT id, username, elo, wins, losses, draws, total_matches FROM users WHERE id = ?', [p1Id]);
            const [[up2]] = (p2Id !== 'AI_BOT') ? await db.execute('SELECT id, username, elo, wins, losses, draws, total_matches FROM users WHERE id = ?', [p2Id]) : [[{username: 'AI', id: 'AI'}]];

            const resultData = { winnerId, user1: up1, user2: up2 };
            io.to(roomId).emit('game_result', resultData);
            
            delete activeGames[roomId];
            delete userToRoom[p1Id];
            if (p2Id !== 'AI_BOT') delete userToRoom[p2Id];

        } catch (err) { console.error(err); }
    });

    socket.on('leave_game', async (userId) => {
        await handlePlayerForfeit(userId);
        const roomId = userToRoom[userId];
        if (roomId) {
            socket.leave(roomId);
            // Nếu là phòng PvF đang chờ (chưa có người thứ 2) -> Xóa phòng luôn
            if (activeGames[roomId] && activeGames[roomId].type === 'pvf' && !activeGames[roomId].p2) {
                delete activeGames[roomId];
            }
        }
        delete userToSocket[userId];
        delete userToRoom[userId];
        pvpQueue = pvpQueue.filter(p => p.user.id !== userId);
    });

    socket.on('disconnect', async () => {
        let disconnectedUserId = null;
        for (const [uId, sId] of Object.entries(userToSocket)) {
            if (sId === socket.id) {
                disconnectedUserId = uId;
                break;
            }
        }
        if (disconnectedUserId) {
            await handlePlayerForfeit(parseInt(disconnectedUserId));
            delete userToSocket[disconnectedUserId];
            delete userToRoom[disconnectedUserId];
        }
        pvpQueue = pvpQueue.filter(p => p.socketId !== socket.id);
    });
});

const PORT = 5000;
server.listen(PORT, () => console.log(`Server chạy tại port ${PORT}`));