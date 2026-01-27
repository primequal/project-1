const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./config/db');
const path = require('path'); // Thêm thư viện path
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');
const friendRoutes = require('./routes/friendRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { calculateNewElo } = require('./utils/eloCalculator');
const { createEloNotification, createGameInviteNotification } = require('./controllers/notificationController');
const caroAI = require('./utils/aiEngine');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CẤU HÌNH CHO PHÉP TRUY CẬP ẢNH TĨNH ---
// Bất kỳ đường dẫn nào bắt đầu bằng /uploads sẽ trỏ vào folder uploads của server
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// --------------------------------------------

app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/notifications', notificationRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "http://localhost:3000" } });

let pvpQueue = [];
let activeGames = {};
let userToRoom = {};
let userToSocket = {};
let onlineUsers = new Set(); // Track online user IDs

const generateRoomId = () => Math.floor(10000 + Math.random() * 90000).toString();

// Update user online status in database
const setUserOnlineStatus = async (userId, isOnline) => {
    try {
        if (isOnline) {
            await db.execute('UPDATE users SET is_online = TRUE WHERE id = ?', [userId]);
        } else {
            await db.execute('UPDATE users SET is_online = FALSE, last_online = NOW() WHERE id = ?', [userId]);
        }
    } catch (err) {
        // Ignore error if columns don't exist yet
        if (!err.message.includes('Unknown column')) {
            console.error('Update online status error:', err);
        }
    }
};

const handlePlayerForfeit = async (leavingUserId) => {
    const roomId = userToRoom[leavingUserId];
    if (!roomId) return;
    
    const game = activeGames[roomId];
    if (!game || game.isOver) return;
    
    if (game.type !== 'pvp' && game.type !== 'pvf') return;
    
    // If game hasn't started yet (no p2), just clean up the room without forfeit logic
    if (!game.p2) {
        delete activeGames[roomId];
        delete userToRoom[leavingUserId];
        return;
    }
    
    game.isOver = true;
    
    const winnerId = (game.p1.userId === leavingUserId) ? game.p2.userId : game.p1.userId;
    if (!winnerId) return;

    const p1Id = game.p1.userId;
    const p2Id = game.p2.userId;
    
    try {
        const [[u1]] = await db.execute('SELECT elo FROM users WHERE id = ?', [p1Id]);
        const [[u2]] = await db.execute('SELECT elo FROM users WHERE id = ?', [p2Id]);
        
        // Check if this is a rated game
        const shouldUpdateElo = game.type === 'pvp' || (game.type === 'pvf' && game.isRated !== false);
        
        let p1Diff = 0;
        let p2Diff = 0;
        
        if (shouldUpdateElo) {
            let eloChange = calculateNewElo(u1.elo, u2.elo, false);
            if (winnerId === p2Id) {
                const temp = calculateNewElo(u2.elo, u1.elo, false);
                eloChange = { newRatingA: temp.newRatingB, newRatingB: temp.newRatingA };
            }

            p1Diff = eloChange.newRatingA - u1.elo;
            p2Diff = eloChange.newRatingB - u2.elo;
            
            const updateStat = (id, elo, field) => db.execute(
                `UPDATE users SET elo = ?, total_matches = total_matches + 1, ${field} = ${field} + 1 WHERE id = ?`, 
                [elo, id]
            );
            
            await updateStat(p1Id, eloChange.newRatingA, winnerId === p1Id ? 'wins' : 'losses');
            await updateStat(p2Id, eloChange.newRatingB, winnerId === p2Id ? 'wins' : 'losses');
        } else {
            // Unrated game - only update match count
            const updateStatNoElo = (id, field) => db.execute(
                `UPDATE users SET total_matches = total_matches + 1, ${field} = ${field} + 1 WHERE id = ?`, 
                [id]
            );
            
            await updateStatNoElo(p1Id, winnerId === p1Id ? 'wins' : 'losses');
            await updateStatNoElo(p2Id, winnerId === p2Id ? 'wins' : 'losses');
        }
        
        const [gameRes] = await db.execute(
            'INSERT INTO games (player1_id, player2_id, winner_id, game_type, end_time, p1_elo_change, p2_elo_change) VALUES (?, ?, ?, ?, NOW(), ?, ?)', 
            [p1Id, p2Id, winnerId, game.type, p1Diff, p2Diff]
        );
        
        // Save game moves for replay
        if (game.moves && game.moves.length > 0) {
            for (let i = 0; i < game.moves.length; i++) {
                const m = game.moves[i];
                await db.execute(
                    'INSERT INTO game_moves (game_id, player_id, x_coord, y_coord, move_order) VALUES (?, ?, ?, ?, ?)', 
                    [gameRes.insertId, m.userId === 'AI_BOT' ? 0 : m.userId, m.r, m.c, i + 1]
                );
            }
        }
        
        // Create ELO notifications for rated games (forfeit)
        if (shouldUpdateElo) {
            console.log('=== Creating ELO notifications (forfeit) ===');
            console.log('P1:', p1Id, 'diff:', p1Diff, 'opponent:', game.p2.user.username);
            console.log('P2:', p2Id, 'diff:', p2Diff, 'opponent:', game.p1.user.username);
            await createEloNotification(p1Id, p1Diff, game.p2.user.username, winnerId === p1Id);
            await createEloNotification(p2Id, p2Diff, game.p1.user.username, winnerId === p2Id);
            console.log('=== ELO notifications created (forfeit) ===');
        }
        
        const [[up1]] = await db.execute('SELECT id, username, avatar, elo, wins, losses, draws, total_matches FROM users WHERE id = ?', [p1Id]);
        const [[up2]] = await db.execute('SELECT id, username, avatar, elo, wins, losses, draws, total_matches FROM users WHERE id = ?', [p2Id]);
        
        // Include eloChanges in result data for forfeit
        let eloChanges = null;
        if (shouldUpdateElo) {
            eloChanges = {
                winner: winnerId === p1Id ? p1Diff : p2Diff,
                loser: winnerId === p1Id ? p2Diff : p1Diff
            };
        }
        
        const resultData = { winnerId, user1: up1, user2: up2, forfeit: true, forfeitUserId: leavingUserId, eloChanges, isRated: shouldUpdateElo };
        const winnerSocket = userToSocket[winnerId];
        if (winnerSocket) {
            io.to(winnerSocket).emit('game_result', resultData);
        }
        
        // Notify spectators about forfeit
        if (game.spectators && game.spectators.length > 0) {
            const winnerName = winnerId === p1Id ? up1.username : up2.username;
            game.spectators.forEach(specSocketId => {
                io.to(specSocketId).emit('spectate_game_end', { 
                    winnerId, 
                    winnerName,
                    user1: up1, 
                    user2: up2,
                    forfeit: true
                });
            });
        }
    } catch (err) {
        console.error('Forfeit error:', err);
    }
    
    delete activeGames[roomId];
    delete userToRoom[p1Id];
    delete userToRoom[p2Id];
};

io.on('connection', (socket) => {
    // Handle user coming online
    socket.on('user_online', async ({ userId }) => {
        if (userId) {
            onlineUsers.add(userId);
            userToSocket[userId] = socket.id;
            await setUserOnlineStatus(userId, true);
            // Broadcast to all clients that this user is online
            io.emit('user_status_change', { userId, isOnline: true });
        }
    });

    // Handle invite friend to PvF
    socket.on('invite_to_pvf', async ({ fromUser, toUserId, roomId }) => {
        // Create notification for the invited user
        await createGameInviteNotification(toUserId, fromUser.username, roomId);
        
        // If user is online, send real-time notification
        const toUserSocketId = userToSocket[toUserId];
        if (toUserSocketId) {
            io.to(toUserSocketId).emit('game_invite_received', {
                fromUser,
                roomId
            });
        }
    });

    socket.on('create_pvf', ({ user, isRated = true, timeControl = 60 }) => {
        const rawId = generateRoomId();
        const roomId = `pvf_${rawId}`;
        const tc = parseInt(timeControl) || 0;
        activeGames[roomId] = {
            p1: { userId: user.id, user: user },
            p2: null,
            board: Array(15).fill(null).map(() => Array(15).fill(null)),
            currentTurn: user.id,
            moves: [],
            type: 'pvf',
            isOver: false,
            isRated: isRated,
            timeControl: tc,
            p1Time: tc,
            p2Time: tc,
            spectators: [] // Array of spectator socket IDs
        };
        userToRoom[user.id] = roomId;
        userToSocket[user.id] = socket.id;
        socket.join(roomId);
        socket.emit('pvf_created', { roomId: rawId, isRated: isRated, timeControl: tc });
    });

    socket.on('join_pvf', ({ user, roomId }) => {
        const fullRoomId = `pvf_${roomId}`;
        const game = activeGames[fullRoomId];
        if (!game) return socket.emit('pvf_error', "Phòng không tồn tại hoặc chủ phòng đã thoát.");
        
        // Room is full - ask if user wants to spectate
        if (game.p2) {
            return socket.emit('pvf_full', { 
                roomId: fullRoomId,
                rawRoomId: roomId,
                player1: game.p1.user,
                player2: game.p2.user,
                isRated: game.isRated,
                isOver: game.isOver
            });
        }

        game.p2 = { userId: user.id, user: user };
        userToRoom[user.id] = fullRoomId;
        userToSocket[user.id] = socket.id;
        
        const p1SocketId = userToSocket[game.p1.userId];
        const p1Socket = io.sockets.sockets.get(p1SocketId);
        
        socket.join(fullRoomId);
        if (p1Socket) p1Socket.join(fullRoomId);

        // Send room info including isRated and timeControl to both players
        io.to(p1SocketId).emit('room_info', { isRated: game.isRated, timeControl: game.timeControl });
        io.to(socket.id).emit('room_info', { isRated: game.isRated, timeControl: game.timeControl });

        io.to(p1SocketId).emit('role_assigned', { roomId: fullRoomId, piece: 'X', turn: true, opponent: game.p2.user, board: game.board, timeControl: game.timeControl });
        io.to(socket.id).emit('role_assigned', { roomId: fullRoomId, piece: 'O', turn: false, opponent: game.p1.user, board: game.board, timeControl: game.timeControl });
        
        // Notify spectators that game has started
        if (game.spectators && game.spectators.length > 0) {
            game.spectators.forEach(specSocketId => {
                io.to(specSocketId).emit('spectate_game_started', {
                    player1: game.p1.user,
                    player2: game.p2.user
                });
            });
        }
    });

    // Spectate a PvF game
    socket.on('spectate_pvf', ({ user, roomId }) => {
        const fullRoomId = roomId.startsWith('pvf_') ? roomId : `pvf_${roomId}`;
        const game = activeGames[fullRoomId];
        
        if (!game) return socket.emit('pvf_error', "Phòng không tồn tại.");
        if (game.isOver) return socket.emit('pvf_error', "Ván đấu đã kết thúc.");
        
        // Add to spectators list
        if (!game.spectators) game.spectators = [];
        if (!game.spectators.includes(socket.id)) {
            game.spectators.push(socket.id);
        }
        
        socket.join(fullRoomId);
        
        // Send current game state to spectator
        socket.emit('spectate_joined', {
            roomId: fullRoomId,
            player1: game.p1.user,
            player2: game.p2 ? game.p2.user : null,
            board: game.board,
            currentTurn: game.currentTurn,
            isRated: game.isRated,
            spectatorCount: game.spectators.length
        });
        
        // Notify players about new spectator
        const p1SocketId = userToSocket[game.p1.userId];
        if (p1SocketId) io.to(p1SocketId).emit('spectator_update', { count: game.spectators.length });
        if (game.p2) {
            const p2SocketId = userToSocket[game.p2.userId];
            if (p2SocketId) io.to(p2SocketId).emit('spectator_update', { count: game.spectators.length });
        }
    });

    // Leave spectating
    socket.on('leave_spectate', ({ roomId }) => {
        const fullRoomId = roomId.startsWith('pvf_') ? roomId : `pvf_${roomId}`;
        const game = activeGames[fullRoomId];
        
        if (game && game.spectators) {
            game.spectators = game.spectators.filter(id => id !== socket.id);
            socket.leave(fullRoomId);
            
            // Notify players
            const p1SocketId = userToSocket[game.p1.userId];
            if (p1SocketId) io.to(p1SocketId).emit('spectator_update', { count: game.spectators.length });
            if (game.p2) {
                const p2SocketId = userToSocket[game.p2.userId];
                if (p2SocketId) io.to(p2SocketId).emit('spectator_update', { count: game.spectators.length });
            }
        }
    });

    socket.on('join_game', ({ type, user, aiDifficulty, timeControl }) => {
        if (!user) return;
        const userId = user.id;
        userToSocket[userId] = socket.id;

        if (userToRoom[userId]) {
            const oldRoomId = userToRoom[userId];
            if (!oldRoomId.startsWith(type)) {
                if (activeGames[oldRoomId]) delete activeGames[oldRoomId];
                delete userToRoom[userId];
                socket.leave(oldRoomId);
            } else {
                const game = activeGames[oldRoomId];
                if (game && game.p2) {
                    socket.join(oldRoomId);
                    socket.emit('game_ready', {
                        roomId: oldRoomId,
                        piece: game.p1.userId === userId ? 'X' : 'O',
                        turn: game.currentTurn === userId,
                        opponent: game.p1.userId === userId ? game.p2.user : game.p1.user,
                        board: game.board,
                        timeControl: game.timeControl || 0
                    });
                    return;
                }
            }
        }

        // Map AI difficulty to depth
        const difficultyToDepth = { easy: 3, medium: 5, hard: 6 };
        const aiDepth = difficultyToDepth[aiDifficulty] || 3;

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
                isOver: false,
                aiDepth: aiDepth, // Store AI depth
                timeControl: 0 // PvE has no time limit
            };
            userToRoom[userId] = roomId;
            socket.emit('game_ready', { 
                roomId, piece: 'X', turn: true, 
                opponent: { username: `Máy (AI) - ${aiDifficulty === 'hard' ? 'Khó' : aiDifficulty === 'medium' ? 'Trung bình' : 'Dễ'}` }, 
                board: activeGames[roomId].board,
                timeControl: 0
            });
        } 
        else if (type === 'pvp') {
            if (pvpQueue.find(p => p.user.id === userId)) return;
            const tc = parseInt(timeControl) || 30;
            pvpQueue.push({ socketId: socket.id, user, timeControl: tc });

            // Find matching player with same time control
            const matchIndex = pvpQueue.findIndex((p, i) => p.user.id !== userId && p.timeControl === tc);
            
            if (matchIndex !== -1) {
                const currentPlayerIndex = pvpQueue.findIndex(p => p.user.id === userId);
                const p1 = pvpQueue.splice(Math.min(currentPlayerIndex, matchIndex), 1)[0];
                const p2Index = pvpQueue.findIndex(p => p.user.id !== p1.user.id && p.timeControl === tc);
                const p2 = pvpQueue.splice(p2Index !== -1 ? p2Index : 0, 1)[0];
                
                const roomId = `pvp_${p1.user.id}_${p2.user.id}`;

                activeGames[roomId] = {
                    p1: { userId: p1.user.id, user: p1.user },
                    p2: { userId: p2.user.id, user: p2.user },
                    board: Array(15).fill(null).map(() => Array(15).fill(null)),
                    currentTurn: p1.user.id,
                    moves: [],
                    type: 'pvp',
                    isOver: false,
                    timeControl: tc,
                    p1Time: tc,
                    p2Time: tc
                };
                userToRoom[p1.user.id] = roomId;
                userToRoom[p2.user.id] = roomId;

                const s1 = io.sockets.sockets.get(p1.socketId);
                const s2 = io.sockets.sockets.get(p2.socketId);
                if (s1) s1.join(roomId);
                if (s2) s2.join(roomId);

                io.to(p1.socketId).emit('role_assigned', { roomId, piece: 'X', turn: true, opponent: p2.user, board: activeGames[roomId].board, timeControl: tc });
                io.to(p2.socketId).emit('role_assigned', { roomId, piece: 'O', turn: false, opponent: p1.user, board: activeGames[roomId].board, timeControl: tc });
            }
        }
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
            const depth = game.aiDepth || 3; // Use stored AI depth
            const aiMove = caroAI.minimax(game.board, depth, -Infinity, Infinity, true);
            if (aiMove.r !== -1) {
                game.board[aiMove.r][aiMove.c] = 'O';
                game.moves.push({ r: aiMove.r, c: aiMove.c, piece: 'O', userId: 'AI_BOT' });
                socket.emit('receive_move', { r: aiMove.r, c: aiMove.c, piece: 'O' });
            }
        } else {
            const opponentId = (game.p1.userId === userId) ? game.p2.userId : game.p1.userId;
            game.currentTurn = opponentId;
            
            // Reset time for the player who just moved and send timer update
            if (game.timeControl && game.timeControl > 0) {
                if (game.p1.userId === userId) {
                    game.p1Time = game.timeControl;
                } else {
                    game.p2Time = game.timeControl;
                }
                // Emit timer data to both players
                io.to(roomId).emit('turn_timer', {
                    currentTurn: opponentId,
                    p1Time: game.p1Time,
                    p2Time: game.p2Time,
                    timeControl: game.timeControl
                });
            }
            
            io.to(roomId).emit('receive_move', { r, c, piece });
            
            // Notify spectators with next turn info
            if (game.spectators && game.spectators.length > 0) {
                game.spectators.forEach(specSocketId => {
                    io.to(specSocketId).emit('spectate_move', { r, c, piece, nextTurn: opponentId });
                });
            }
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
            
            // Track ELO changes for the result
            let p1Diff = 0;
            let p2Diff = 0;
            let shouldUpdateElo = false;

            if (game.type === 'pvp' || game.type === 'pvf') {
                const [[u1]] = await db.execute('SELECT elo FROM users WHERE id = ?', [p1Id]);
                const [[u2]] = await db.execute('SELECT elo FROM users WHERE id = ?', [p2Id]);
                
                // Check if this is a rated game (PvP is always rated, PvF depends on isRated flag)
                shouldUpdateElo = game.type === 'pvp' || (game.type === 'pvf' && game.isRated !== false);
                
                let newP1Elo = u1.elo;
                let newP2Elo = u2.elo;
                
                if (shouldUpdateElo) {
                    let eloChange = calculateNewElo(u1.elo, u2.elo, isDraw);
                    if (winnerId === p2Id) {
                        const temp = calculateNewElo(u2.elo, u1.elo, isDraw);
                        eloChange = { newRatingA: temp.newRatingB, newRatingB: temp.newRatingA };
                    }

                    p1Diff = eloChange.newRatingA - u1.elo;
                    p2Diff = eloChange.newRatingB - u2.elo;
                    newP1Elo = eloChange.newRatingA;
                    newP2Elo = eloChange.newRatingB;

                    const updateStat = (id, elo, field) => db.execute(`UPDATE users SET elo = ?, total_matches = total_matches + 1, ${field} = ${field} + 1 WHERE id = ?`, [elo, id]);

                    await updateStat(p1Id, newP1Elo, isDraw ? 'draws' : (winnerId === p1Id ? 'wins' : 'losses'));
                    await updateStat(p2Id, newP2Elo, isDraw ? 'draws' : (winnerId === p2Id ? 'wins' : 'losses'));
                } else {
                    // Unrated game - only update match count, not ELO
                    const updateStatNoElo = (id, field) => db.execute(`UPDATE users SET total_matches = total_matches + 1, ${field} = ${field} + 1 WHERE id = ?`, [id]);

                    await updateStatNoElo(p1Id, isDraw ? 'draws' : (winnerId === p1Id ? 'wins' : 'losses'));
                    await updateStatNoElo(p2Id, isDraw ? 'draws' : (winnerId === p2Id ? 'wins' : 'losses'));
                }

                const [gameRes] = await db.execute(
                    'INSERT INTO games (player1_id, player2_id, winner_id, game_type, end_time, p1_elo_change, p2_elo_change) VALUES (?, ?, ?, ?, NOW(), ?, ?)', 
                    [p1Id, p2Id, winnerId, game.type, p1Diff, p2Diff]
                );
                
                for (let i = 0; i < game.moves.length; i++) {
                    const m = game.moves[i];
                    await db.execute('INSERT INTO game_moves (game_id, player_id, x_coord, y_coord, move_order) VALUES (?, ?, ?, ?, ?)', [gameRes.insertId, m.userId === 'AI_BOT' ? 0 : m.userId, m.r, m.c, i + 1]);
                }
                
                // Create ELO notifications for rated games (always create when rated, even if draw)
                if (shouldUpdateElo) {
                    console.log('=== Creating ELO notifications ===');
                    console.log('P1:', p1Id, 'diff:', p1Diff, 'opponent:', game.p2.user.username);
                    console.log('P2:', p2Id, 'diff:', p2Diff, 'opponent:', game.p1.user.username);
                    await createEloNotification(p1Id, p1Diff, game.p2.user.username, winnerId === p1Id);
                    await createEloNotification(p2Id, p2Diff, game.p1.user.username, winnerId === p2Id);
                    console.log('=== ELO notifications created ===');
                } else {
                    console.log('=== Skipping ELO notifications (not rated) ===');
                    console.log('Game type:', game.type, 'isRated:', game.isRated);
                }
            }

            const [[up1]] = await db.execute('SELECT id, username, avatar, elo, wins, losses, draws, total_matches FROM users WHERE id = ?', [p1Id]);
            const [[up2]] = (p2Id !== 'AI_BOT') ? await db.execute('SELECT id, username, avatar, elo, wins, losses, draws, total_matches FROM users WHERE id = ?', [p2Id]) : [[{username: 'AI', id: 'AI'}]];

            // Calculate ELO changes for display
            let eloChanges = null;
            if (shouldUpdateElo) {
                eloChanges = {
                    winner: winnerId === p1Id ? p1Diff : p2Diff,
                    loser: winnerId === p1Id ? p2Diff : p1Diff
                };
            }

            const resultData = { winnerId, user1: up1, user2: up2, eloChanges, isRated: shouldUpdateElo };
            io.to(roomId).emit('game_result', resultData);
            
            // Notify spectators
            if (game.spectators && game.spectators.length > 0) {
                const winnerName = winnerId === p1Id ? up1.username : (winnerId === p2Id ? up2.username : null);
                game.spectators.forEach(specSocketId => {
                    io.to(specSocketId).emit('spectate_game_end', { 
                        winnerId, 
                        winnerName,
                        user1: up1, 
                        user2: up2 
                    });
                });
            }
            
            // Keep game active for potential rematch instead of deleting immediately
            // Mark as over but don't delete yet
            game.isOver = true;
            game.waitingForRematch = true;
            
            // Set timeout to delete the game if no rematch after 60 seconds
            setTimeout(() => {
                if (activeGames[roomId] && activeGames[roomId].waitingForRematch) {
                    delete activeGames[roomId];
                    delete userToRoom[p1Id];
                    if (p2Id !== 'AI_BOT') delete userToRoom[p2Id];
                }
            }, 60000);

        } catch (err) { console.error(err); }
    });

    // ========== REMATCH EVENTS ==========
    socket.on('request_rematch', ({ roomId }) => {
        const game = activeGames[roomId];
        if (!game) return;
        
        // Find opponent's socket
        const userId = Object.keys(userToSocket).find(id => userToSocket[id] === socket.id);
        const opponentId = game.p1.userId == userId ? game.p2?.userId : game.p1?.userId;
        
        if (opponentId) {
            const opponentSocketId = userToSocket[opponentId];
            if (opponentSocketId) {
                io.to(opponentSocketId).emit('rematch_request');
            }
        }
    });

    socket.on('accept_rematch', ({ roomId }) => {
        const game = activeGames[roomId];
        if (!game) return;
        
        // Reset game for rematch - swap pieces
        const oldP1 = game.p1;
        const oldP2 = game.p2;
        
        game.p1 = { userId: oldP2.userId, user: oldP2.user };
        game.p2 = { userId: oldP1.userId, user: oldP1.user };
        game.board = Array(15).fill(null).map(() => Array(15).fill(null));
        game.currentTurn = game.p1.userId; // X always goes first
        game.moves = [];
        game.isOver = false;
        game.waitingForRematch = false;
        
        // Reset timer
        if (game.timeControl && game.timeControl > 0) {
            game.p1Time = game.timeControl;
            game.p2Time = game.timeControl;
        }
        
        // Notify both players with swapped roles
        const p1SocketId = userToSocket[game.p1.userId];
        const p2SocketId = userToSocket[game.p2.userId];
        
        if (p1SocketId) {
            io.to(p1SocketId).emit('rematch_accepted', { 
                roomId, 
                piece: 'X', 
                turn: true, 
                opponent: game.p2.user,
                board: game.board,
                timeControl: game.timeControl || 0
            });
        }
        
        if (p2SocketId) {
            io.to(p2SocketId).emit('rematch_accepted', { 
                roomId, 
                piece: 'O', 
                turn: false, 
                opponent: game.p1.user,
                board: game.board,
                timeControl: game.timeControl || 0
            });
        }
    });

    socket.on('decline_rematch', ({ roomId }) => {
        const game = activeGames[roomId];
        if (!game) return;
        
        // Notify opponent that rematch was declined
        const userId = Object.keys(userToSocket).find(id => userToSocket[id] === socket.id);
        const opponentId = game.p1.userId == userId ? game.p2?.userId : game.p1?.userId;
        
        if (opponentId) {
            const opponentSocketId = userToSocket[opponentId];
            if (opponentSocketId) {
                io.to(opponentSocketId).emit('rematch_declined');
            }
        }
        
        // Clean up game
        delete activeGames[roomId];
        delete userToRoom[game.p1?.userId];
        delete userToRoom[game.p2?.userId];
    });

    socket.on('leave_rematch', ({ roomId }) => {
        const game = activeGames[roomId];
        if (!game) return;
        
        // Notify opponent that player left
        const userId = Object.keys(userToSocket).find(id => userToSocket[id] === socket.id);
        const opponentId = game.p1.userId == userId ? game.p2?.userId : game.p1?.userId;
        
        if (opponentId) {
            const opponentSocketId = userToSocket[opponentId];
            if (opponentSocketId) {
                io.to(opponentSocketId).emit('opponent_left_rematch');
            }
        }
        
        // Clean up
        delete activeGames[roomId];
        delete userToRoom[game.p1?.userId];
        delete userToRoom[game.p2?.userId];
    });
    // ====================================

    // Handle time up event (when player runs out of time)
    socket.on('time_up', async ({ roomId, loserId }) => {
        console.log('[TIME_UP] Received time_up event:', { roomId, loserId });
        
        const game = activeGames[roomId];
        if (!game) {
            console.log('[TIME_UP] Game not found for roomId:', roomId);
            return;
        }
        if (game.isOver) {
            console.log('[TIME_UP] Game already over');
            return;
        }

        game.isOver = true;
        
        // Ensure loserId is a number for comparison
        const loserIdNum = parseInt(loserId);
        const winnerId = game.p1.userId === loserIdNum ? game.p2.userId : game.p1.userId;
        
        console.log('[TIME_UP] Processing: winnerId=', winnerId, 'loserId=', loserIdNum);
        
        // Helper function to create ELO notification
        const createEloNotification = async (userId, eloChange, opponentName, isWin) => {
            try {
                const sign = eloChange >= 0 ? '+' : '';
                const emoji = eloChange >= 0 ? '📈' : '📉';
                const result = isWin ? 'thắng' : (eloChange === 0 ? 'hòa' : 'thua');
                
                const title = `${emoji} Biến động ELO: ${sign}${eloChange}`;
                const content = `Sau trận đấu với ${opponentName}, ELO của bạn ${eloChange >= 0 ? 'tăng' : 'giảm'} ${Math.abs(eloChange)} điểm`;
                
                await db.execute(
                    'INSERT INTO notifications (user_id, type, title, content, data) VALUES (?, ?, ?, ?, ?)',
                    [userId, 'elo_change', title, content, JSON.stringify({ eloChange, opponentName, result })]
                );
            } catch (err) {
                console.error("[TIME_UP] Create notification error:", err.message);
            }
        };
        
        // If rated game, update ELO, stats, and save game
        if ((game.type === 'pvp' || (game.type === 'pvf' && game.isRated)) && game.p1 && game.p2) {
            try {
                // Get both players' ELO
                const [winnerRows] = await db.execute('SELECT elo FROM users WHERE id = ?', [winnerId]);
                const [loserRows] = await db.execute('SELECT elo FROM users WHERE id = ?', [loserIdNum]);
                
                if (winnerRows.length > 0 && loserRows.length > 0) {
                    const winnerElo = winnerRows[0].elo;
                    const loserElo = loserRows[0].elo;
                    
                    // Use calculateNewElo - winner is ratingA, loser is ratingB
                    const { newRatingA: newWinnerElo, newRatingB: newLoserElo } = calculateNewElo(winnerElo, loserElo, false);
                    const winnerChange = newWinnerElo - winnerElo;
                    const loserChange = newLoserElo - loserElo;
                    
                    // Update ELO and stats in database
                    await db.execute('UPDATE users SET elo = ?, wins = wins + 1, total_matches = total_matches + 1 WHERE id = ?', [newWinnerElo, winnerId]);
                    await db.execute('UPDATE users SET elo = ?, losses = losses + 1, total_matches = total_matches + 1 WHERE id = ?', [newLoserElo, loserIdNum]);
                    
                    // Save game to database
                    const p1EloChange = game.p1.userId === winnerId ? winnerChange : loserChange;
                    const p2EloChange = game.p2.userId === winnerId ? winnerChange : loserChange;
                    
                    const [gameResult] = await db.execute(
                        'INSERT INTO games (player1_id, player2_id, winner_id, game_type, end_time, p1_elo_change, p2_elo_change) VALUES (?, ?, ?, ?, NOW(), ?, ?)',
                        [game.p1.userId, game.p2.userId, winnerId, game.type === 'pvf' ? 'PvF' : 'PvP', p1EloChange, p2EloChange]
                    );
                    
                    // Save moves
                    const gameId = gameResult.insertId;
                    for (let i = 0; i < game.moves.length; i++) {
                        const move = game.moves[i];
                        await db.execute(
                            'INSERT INTO game_moves (game_id, player_id, x_coord, y_coord, move_order) VALUES (?, ?, ?, ?, ?)',
                            [gameId, move.userId === 'AI_BOT' ? null : move.userId, move.r, move.c, i + 1]
                        );
                    }
                    
                    // Create ELO notifications with opponent names
                    const winnerName = winnerId === game.p1.userId ? game.p1.username : game.p2.username;
                    const loserName = loserIdNum === game.p1.userId ? game.p1.username : game.p2.username;
                    await createEloNotification(winnerId, winnerChange, loserName, true);
                    await createEloNotification(loserIdNum, loserChange, winnerName, false);
                    
                    // Get updated user data
                    const [updatedWinner] = await db.execute('SELECT id, username, email, avatar, elo, total_matches, wins, losses, draws FROM users WHERE id = ?', [winnerId]);
                    const [updatedLoser] = await db.execute('SELECT id, username, email, avatar, elo, total_matches, wins, losses, draws FROM users WHERE id = ?', [loserIdNum]);
                    
                    // Emit game_result to both players (same as normal game end)
                    const user1 = game.p1.userId === winnerId ? updatedWinner[0] : updatedLoser[0];
                    const user2 = game.p2.userId === winnerId ? updatedWinner[0] : updatedLoser[0];
                    
                    // Calculate eloChanges object (same format as normal game end)
                    const eloChanges = {
                        winner: winnerChange,
                        loser: loserChange
                    };
                    
                    io.to(roomId).emit('game_result', {
                        winnerId: winnerId,
                        user1: { ...user1, eloChange: p1EloChange },
                        user2: { ...user2, eloChange: p2EloChange },
                        eloChanges: eloChanges,
                        isRated: game.isRated !== false,
                        timeUp: true // Flag to indicate this was a time-up result
                    });
                }
            } catch (err) {
                console.error("[TIME_UP] Error:", err.message);
            }
        } else {
            // Unrated game - still update stats and save game, just no ELO changes
            try {
                const p1Id = game.p1.userId;
                const p2Id = game.p2.userId;
                
                // Update match count and win/loss stats (no ELO)
                await db.execute(
                    `UPDATE users SET total_matches = total_matches + 1, wins = wins + 1 WHERE id = ?`,
                    [winnerId]
                );
                await db.execute(
                    `UPDATE users SET total_matches = total_matches + 1, losses = losses + 1 WHERE id = ?`,
                    [loserIdNum]
                );
                
                // Save game to database
                const [gameResult] = await db.execute(
                    'INSERT INTO games (player1_id, player2_id, winner_id, game_type, end_time, p1_elo_change, p2_elo_change) VALUES (?, ?, ?, ?, NOW(), ?, ?)',
                    [p1Id, p2Id, winnerId, game.type === 'pvf' ? 'PvF' : 'PvP', 0, 0]
                );
                
                // Save moves for replay
                const gameId = gameResult.insertId;
                for (let i = 0; i < game.moves.length; i++) {
                    const move = game.moves[i];
                    await db.execute(
                        'INSERT INTO game_moves (game_id, player_id, x_coord, y_coord, move_order) VALUES (?, ?, ?, ?, ?)',
                        [gameId, move.userId === 'AI_BOT' ? null : move.userId, move.r, move.c, i + 1]
                    );
                }
                
                // Get updated user data
                const [updatedWinner] = await db.execute('SELECT id, username, email, avatar, elo, total_matches, wins, losses, draws FROM users WHERE id = ?', [winnerId]);
                const [updatedLoser] = await db.execute('SELECT id, username, email, avatar, elo, total_matches, wins, losses, draws FROM users WHERE id = ?', [loserIdNum]);
                
                io.to(roomId).emit('game_result', {
                    winnerId: winnerId,
                    user1: game.p1.userId === winnerId ? updatedWinner[0] : updatedLoser[0],
                    user2: game.p2.userId === winnerId ? updatedWinner[0] : updatedLoser[0],
                    isRated: false,
                    timeUp: true
                });
            } catch (err) {
                console.error("[TIME_UP] Unrated game error:", err.message);
                // Fallback - still emit result
                io.to(roomId).emit('game_result', {
                    winnerId: winnerId,
                    user1: game.p1.user,
                    user2: game.p2.user,
                    isRated: false,
                    timeUp: true
                });
            }
        }
        
        // Cleanup
        delete activeGames[roomId];
        delete userToRoom[game.p1?.userId];
        delete userToRoom[game.p2?.userId];
    });

    socket.on('leave_game', async (userId) => {
        await handlePlayerForfeit(userId);
        const roomId = userToRoom[userId];
        if (roomId) {
            socket.leave(roomId);
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
            
            // Update online status
            onlineUsers.delete(parseInt(disconnectedUserId));
            await setUserOnlineStatus(parseInt(disconnectedUserId), false);
            io.emit('user_status_change', { userId: parseInt(disconnectedUserId), isOnline: false });
            
            delete userToSocket[disconnectedUserId];
            delete userToRoom[disconnectedUserId];
        }
        pvpQueue = pvpQueue.filter(p => p.socketId !== socket.id);
    });
});

const PORT = 5000;

// Reset all users to offline status when server starts
// This fixes the bug where users remain marked as online after server restart
const resetAllUsersOffline = async () => {
    try {
        await db.execute('UPDATE users SET is_online = FALSE');
        console.log('✅ Reset tất cả users về trạng thái offline');
    } catch (err) {
        // Ignore error if column doesn't exist
        if (!err.message.includes('Unknown column')) {
            console.error('Lỗi reset online status:', err);
        }
    }
};

server.listen(PORT, async () => {
    await resetAllUsersOffline();
    console.log(`Server chạy tại port ${PORT}`);
});