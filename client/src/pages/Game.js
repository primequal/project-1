import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';
import CaroBoard from '../CaroBoard';
import '../styles.css';

const Game = () => {
    const { type } = useParams();
    const navigate = useNavigate();
    const [gameState, setGameState] = useState({ 
        roomId: null, myPiece: null, isMyTurn: false, opponent: null, initialBoard: null 
    });
    
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [pvfRoomIdInput, setPvfRoomIdInput] = useState("");
    const [createdRoomId, setCreatedRoomId] = useState(null);
    const [isRated, setIsRated] = useState(true); // Rated/Unrated for PvF
    const [roomIsRated, setRoomIsRated] = useState(true); // Track if current room is rated
    
    // Spectator states
    const [isSpectator, setIsSpectator] = useState(false);
    const [spectatorData, setSpectatorData] = useState(null);
    const [showSpectateDialog, setShowSpectateDialog] = useState(false);
    const [pendingSpectateRoom, setPendingSpectateRoom] = useState(null);
    const [spectatorCount, setSpectatorCount] = useState(0);

    const messagesEndRef = useRef(null);
    const userRef = useRef(JSON.parse(localStorage.getItem('user')));
    const hasJoinedRef = useRef(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => { scrollToBottom(); }, [messages]);

    useEffect(() => {
        const user = userRef.current;
        if (!user) return navigate('/login');

        if (!hasJoinedRef.current) {
            if (type !== 'pvf') {
                hasJoinedRef.current = true;
                socket.emit('join_game', { type, user });
            }
        }

        const onReady = (data) => {
            setGameState({ 
                roomId: data.roomId, myPiece: data.piece, isMyTurn: data.turn, 
                opponent: data.opponent, initialBoard: data.board 
            });
            setMessages([]);
            setCreatedRoomId(null);
        };

        const onRole = (data) => setGameState(prev => ({ 
            ...prev, roomId: data.roomId, myPiece: data.piece, 
            isMyTurn: data.turn, opponent: data.opponent,
            initialBoard: data.board || Array(15).fill(null).map(() => Array(15).fill(null))
        }));
        
        const onResult = (data) => {
            const user = userRef.current;
            const myUpdatedData = (data.user1.id === user.id) ? data.user1 : data.user2;
            if (myUpdatedData.id) localStorage.setItem('user', JSON.stringify(myUpdatedData));
            
            let message;
            if (data.forfeit) {
                message = data.winnerId === user.id ? "🎉 ĐỐI THỦ ĐÃ THOÁT! BẠN THẮNG!" : "Bạn đã thoát game và bị xử thua.";
            } else {
                message = data.winnerId === user.id ? "🎉 CHÚC MỪNG! BẠN ĐÃ THẮNG!" : (data.winnerId === null ? "🤝 HÒA!" : "😢 BẠN ĐÃ THUA!");
            }
            alert(message);
            navigate('/dashboard');
        };

        const onPvfCreated = (data) => {
            setCreatedRoomId(data.roomId);
            setRoomIsRated(data.isRated !== false);
        };
        const onPvfError = (msg) => {
            alert(msg);
        };
        
        const onRoomInfo = (data) => {
            setRoomIsRated(data.isRated !== false);
        };

        // Handle room full - ask to spectate
        const onPvfFull = (data) => {
            setPendingSpectateRoom(data);
            setShowSpectateDialog(true);
        };

        // Spectator joined successfully
        const onSpectateJoined = (data) => {
            setIsSpectator(true);
            setSpectatorData({
                roomId: data.roomId,
                player1: data.player1,
                player2: data.player2,
                board: data.board,
                currentTurn: data.currentTurn,
                isRated: data.isRated
            });
            setSpectatorCount(data.spectatorCount);
            setShowSpectateDialog(false);
        };

        // Receive moves as spectator
        const onSpectateMove = (data) => {
            setSpectatorData(prev => {
                if (!prev) return prev;
                const newBoard = [...prev.board.map(row => [...row])];
                newBoard[data.r][data.c] = data.piece;
                return { ...prev, board: newBoard, currentTurn: data.nextTurn };
            });
        };

        // Game ended for spectators
        const onSpectateGameEnd = (data) => {
            let message = data.winnerId 
                ? `🏆 ${data.winnerName} đã thắng!` 
                : "🤝 Ván đấu kết thúc hòa!";
            alert(message);
            navigate('/dashboard');
        };
        
        // Game started (for spectators waiting)
        const onSpectateGameStarted = (data) => {
            setSpectatorData(prev => prev ? {
                ...prev,
                player1: data.player1,
                player2: data.player2
            } : prev);
        };

        // Spectator count update (for players)
        const onSpectatorUpdate = (data) => {
            setSpectatorCount(data.count);
        };

        socket.on('game_ready', onReady);
        socket.on('role_assigned', onRole);
        socket.on('game_result', onResult);
        socket.on('pvf_created', onPvfCreated);
        socket.on('pvf_error', onPvfError);
        socket.on('room_info', onRoomInfo);
        socket.on('pvf_full', onPvfFull);
        socket.on('spectate_joined', onSpectateJoined);
        socket.on('spectate_move', onSpectateMove);
        socket.on('spectate_game_end', onSpectateGameEnd);
        socket.on('spectate_game_started', onSpectateGameStarted);
        socket.on('spectator_update', onSpectatorUpdate);

        return () => {
            socket.off('game_ready', onReady);
            socket.off('role_assigned', onRole);
            socket.off('game_result', onResult);
            socket.off('pvf_created', onPvfCreated);
            socket.off('pvf_error', onPvfError);
            socket.off('room_info', onRoomInfo);
            socket.off('pvf_full', onPvfFull);
            socket.off('spectate_joined', onSpectateJoined);
            socket.off('spectate_move', onSpectateMove);
            socket.off('spectate_game_end', onSpectateGameEnd);
            socket.off('spectate_game_started', onSpectateGameStarted);
            socket.off('spectator_update', onSpectatorUpdate);
        };
    }, [type, navigate]);

    useEffect(() => {
        const onReceiveMessage = (data) => setMessages((prev) => [...prev, data]);
        socket.on('receive_message', onReceiveMessage);
        return () => socket.off('receive_message', onReceiveMessage);
    }, []);

    useEffect(() => {
        const user = userRef.current;
        const handleBeforeUnload = () => { if (user) socket.emit('leave_game', user.id); };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const handleLeaveGame = () => {
        const user = userRef.current;
        if (user) {
            if (isSpectator && spectatorData?.roomId) {
                socket.emit('leave_spectate', { roomId: spectatorData.roomId });
            } else {
                socket.emit('leave_game', user.id);
            }
            hasJoinedRef.current = false;
        }
        navigate('/dashboard');
    };

    const handleSpectateYes = () => {
        if (pendingSpectateRoom) {
            socket.emit('spectate_pvf', { 
                user: userRef.current, 
                roomId: pendingSpectateRoom.roomId 
            });
        }
    };

    const handleSpectateNo = () => {
        setShowSpectateDialog(false);
        setPendingSpectateRoom(null);
        navigate('/dashboard');
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (chatInput.trim() && gameState.roomId) {
            const user = userRef.current;
            socket.emit('send_message', {
                roomId: gameState.roomId, userId: user.id, username: user.username, content: chatInput
            });
            setChatInput("");
        }
    };

    const createRoom = () => {
        socket.emit('create_pvf', { user: userRef.current, isRated });
    };

    const joinRoom = () => {
        if (!pvfRoomIdInput.trim()) return alert("Vui lòng nhập mã phòng!");
        socket.emit('join_pvf', { user: userRef.current, roomId: pvfRoomIdInput.trim() });
    };

    const getGameModeName = (t) => {
        switch(t) {
            case 'pvp': return '⚔️ PvP - Đấu người chơi';
            case 'pve': return '🤖 PvE - Đấu với máy';
            case 'pvf': return '👥 PvF - Chơi với bạn bè';
            default: return t.toUpperCase();
        }
    };

    return (
        <div className="app-background">
            <div className="floating-shapes">
                <div className="shape"></div>
                <div className="shape"></div>
                <div className="shape"></div>
                <div className="shape"></div>
            </div>

            {/* Spectate Dialog */}
            {showSpectateDialog && pendingSpectateRoom && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div className="glass-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <h3 className="text-dark mb-md" style={{ fontSize: '1.4rem' }}>
                            🎮 Phòng đã đầy người chơi
                        </h3>
                        <p className="text-dark mb-md" style={{ opacity: 0.8 }}>
                            Trận đấu giữa:
                        </p>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            gap: '15px',
                            marginBottom: '20px'
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', color: '#e53e3e' }}>X</div>
                                <strong style={{ color: '#2d3748' }}>{pendingSpectateRoom.player1?.username}</strong>
                            </div>
                            <span style={{ fontSize: '20px', color: '#888' }}>vs</span>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', color: '#3182ce' }}>O</div>
                                <strong style={{ color: '#2d3748' }}>{pendingSpectateRoom.player2?.username}</strong>
                            </div>
                        </div>
                        <p style={{
                            padding: '8px 15px',
                            borderRadius: '20px',
                            display: 'inline-block',
                            fontSize: '13px',
                            fontWeight: '600',
                            background: pendingSpectateRoom.isRated 
                                ? 'linear-gradient(135deg, #11998e, #38ef7d)' 
                                : 'linear-gradient(135deg, #667eea, #764ba2)',
                            color: 'white',
                            marginBottom: '20px'
                        }}>
                            {pendingSpectateRoom.isRated ? '🏆 Rated Game' : '🎮 Unrated Game'}
                        </p>
                        <p className="text-dark mb-lg">
                            Bạn có muốn xem trực tiếp ván đấu này không?
                        </p>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button onClick={handleSpectateYes} className="glass-btn glass-btn-success">
                                🎬 Xem trận đấu
                            </button>
                            <button onClick={handleSpectateNo} className="glass-btn glass-btn-secondary">
                                ← Quay lại
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ padding: '30px', position: 'relative', zIndex: 1, minHeight: '100vh' }}>
                <div className="text-center">
                    <h2 className="glass-title" style={{ fontSize: '1.8rem', marginBottom: '15px' }}>
                        {isSpectator ? '🎬 Đang xem trực tiếp' : getGameModeName(type)}
                    </h2>
                    
                    <button onClick={handleLeaveGame} className="glass-btn glass-btn-outline mb-lg">
                        ← Thoát về Dashboard
                    </button>
                </div>

                {/* Spectator View */}
                {isSpectator && spectatorData ? (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
                        <div>
                            {/* Spectator Info */}
                            <div className="glass-game-info text-center">
                                <div style={{
                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                    color: 'white',
                                    padding: '8px 20px',
                                    borderRadius: '20px',
                                    display: 'inline-block',
                                    marginBottom: '15px',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                }}>
                                    🔴 LIVE - ĐANG XEM
                                </div>
                                
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'center', 
                                    alignItems: 'center', 
                                    gap: '20px',
                                    marginBottom: '15px'
                                }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '28px', color: '#e53e3e', fontWeight: 'bold' }}>X</div>
                                        <strong style={{ color: '#2d3748' }}>{spectatorData.player1?.username}</strong>
                                    </div>
                                    <span style={{ fontSize: '18px', color: '#888' }}>vs</span>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '28px', color: '#3182ce', fontWeight: 'bold' }}>O</div>
                                        <strong style={{ color: '#2d3748' }}>
                                            {spectatorData.player2?.username || 'Đang chờ...'}
                                        </strong>
                                    </div>
                                </div>
                                
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'center', 
                                    gap: '15px',
                                    marginBottom: '10px'
                                }}>
                                    <span style={{
                                        padding: '4px 12px',
                                        borderRadius: '15px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        background: spectatorData.isRated 
                                            ? 'linear-gradient(135deg, #11998e, #38ef7d)' 
                                            : 'linear-gradient(135deg, #718096, #4a5568)',
                                        color: 'white'
                                    }}>
                                        {spectatorData.isRated ? '🏆 Rated' : '🎮 Unrated'}
                                    </span>
                                </div>
                                
                                {spectatorData.player2 && (
                                    <div style={{ marginTop: '10px' }}>
                                        <span className={`glass-turn-indicator ${
                                            spectatorData.currentTurn === spectatorData.player1?.id 
                                                ? 'glass-turn-my' 
                                                : 'glass-turn-opponent'
                                        }`}>
                                            Lượt của: {spectatorData.currentTurn === spectatorData.player1?.id 
                                                ? spectatorData.player1?.username 
                                                : spectatorData.player2?.username}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Spectator Board - View only */}
                            <div className="glass-board" style={{ pointerEvents: 'none' }}>
                                {spectatorData.board.map((row, rowIndex) => row.map((cell, colIndex) => (
                                    <div
                                        key={`${rowIndex}-${colIndex}`}
                                        className={`glass-cell ${cell === 'X' ? 'glass-cell-x glass-cell-filled' : ''} ${cell === 'O' ? 'glass-cell-o glass-cell-filled' : ''}`}
                                    >
                                        {cell}
                                    </div>
                                )))}
                            </div>
                        </div>
                    </div>
                ) : gameState.roomId ? (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
                        <div>
                            {/* Game Info */}
                            <div className="glass-game-info text-center">
                                <p className="text-dark mb-sm">
                                    Đối thủ: <strong style={{ color: '#667eea' }}>{gameState.opponent?.username}</strong>
                                </p>
                                <p className="text-dark mb-sm">
                                    Bạn cầm quân: 
                                    <strong style={{ 
                                        color: gameState.myPiece === 'X' ? '#e53e3e' : '#3182ce', 
                                        fontSize: '24px',
                                        marginLeft: '8px'
                                    }}>
                                        {gameState.myPiece}
                                    </strong>
                                </p>
                                
                                {type === 'pvf' && (
                                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(100,100,150,0.3)' }}>
                                        <span className="text-dark">Mã phòng: </span>
                                        <span style={{ 
                                            fontWeight: 'bold', 
                                            color: '#667eea', 
                                            fontSize: '20px',
                                            letterSpacing: '2px'
                                        }}>
                                            {gameState.roomId.split('_')[1]}
                                        </span>
                                        {spectatorCount > 0 && (
                                            <span style={{
                                                marginLeft: '15px',
                                                padding: '4px 12px',
                                                borderRadius: '15px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                                color: 'white'
                                            }}>
                                                🎬 {spectatorCount} đang xem
                                            </span>
                                        )}
                                        <span style={{ 
                                            marginLeft: '15px',
                                            padding: '4px 12px',
                                            borderRadius: '15px',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            background: roomIsRated ? 'linear-gradient(135deg, #11998e, #38ef7d)' : 'linear-gradient(135deg, #718096, #4a5568)',
                                            color: 'white'
                                        }}>
                                            {roomIsRated ? '🏆 Rated' : '🎮 Unrated'}
                                        </span>
                                    </div>
                                )}
                                
                                <div style={{ marginTop: '15px' }}>
                                    <span className={`glass-turn-indicator ${gameState.isMyTurn ? 'glass-turn-my' : 'glass-turn-opponent'}`}>
                                        {gameState.isMyTurn ? "🔥 ĐẾN LƯỢT BẠN 🔥" : "⏳ Đối thủ đang suy nghĩ..."}
                                    </span>
                                </div>
                            </div>

                            <CaroBoard {...gameState} setIsMyTurn={(val) => setGameState(p => ({...p, isMyTurn: val}))} type={type} />
                        </div>

                        {/* Chat Box */}
                        {type !== 'pve' && (
                            <div className="glass-chat" style={{ width: '320px', height: '500px' }}>
                                <div className="glass-chat-header">💬 Trò chuyện</div>
                                <div className="glass-chat-body">
                                    {messages.map((msg, index) => {
                                        const isMe = msg.userId === userRef.current?.id;
                                        return (
                                            <div key={index} className="glass-chat-message" style={{ textAlign: isMe ? 'right' : 'left' }}>
                                                <div className="glass-chat-message-name">{msg.username}</div>
                                                <span className={`glass-chat-bubble ${isMe ? 'glass-chat-bubble-me' : 'glass-chat-bubble-other'}`}>
                                                    {msg.content}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>
                                <form onSubmit={handleSendMessage} className="glass-chat-input-container">
                                    <input 
                                        type="text" 
                                        placeholder="Nhập tin nhắn..." 
                                        value={chatInput} 
                                        onChange={(e) => setChatInput(e.target.value)} 
                                        className="glass-chat-input" 
                                    />
                                    <button type="submit" className="glass-chat-send">Gửi</button>
                                </form>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Chưa vào game */
                    <div className="text-center" style={{ marginTop: '30px' }}>
                        {type === 'pvf' ? (
                            <div className="glass-card" style={{ display: 'inline-block', maxWidth: '450px' }}>
                                {!createdRoomId ? (
                                    <>
                                        <h3 className="text-dark mb-lg" style={{ fontSize: '1.5rem' }}>
                                            👥 Chơi với Bạn Bè
                                        </h3>
                                        
                                        {/* Rated/Unrated Toggle */}
                                        <div className="glass-toggle-container mb-lg">
                                            <span className="glass-toggle-label">Chế độ:</span>
                                            <button 
                                                className={`glass-toggle-btn ${isRated ? 'active-success' : ''}`}
                                                onClick={() => setIsRated(true)}
                                            >
                                                🏆 Rated
                                            </button>
                                            <button 
                                                className={`glass-toggle-btn ${!isRated ? 'active' : ''}`}
                                                onClick={() => setIsRated(false)}
                                            >
                                                🎮 Unrated
                                            </button>
                                        </div>
                                        
                                        <p style={{ 
                                            color: isRated ? '#276749' : '#4a5568', 
                                            marginBottom: '20px',
                                            fontSize: '14px',
                                            background: isRated ? 'rgba(198, 246, 213, 0.8)' : 'rgba(200, 200, 220, 0.5)',
                                            padding: '10px 15px',
                                            borderRadius: '8px'
                                        }}>
                                            {isRated 
                                                ? '⚡ Kết quả sẽ ảnh hưởng đến ELO của cả 2 người'
                                                : '🎯 Kết quả không ảnh hưởng đến ELO'}
                                        </p>
                                        
                                        <button 
                                            onClick={createRoom} 
                                            className="glass-btn glass-btn-info glass-btn-full mb-lg"
                                        >
                                            ➕ Tạo Phòng Mới
                                        </button>
                                        
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '10px',
                                            background: 'rgba(200,200,220,0.3)',
                                            padding: '15px',
                                            borderRadius: '12px'
                                        }}>
                                            <input 
                                                type="text" 
                                                placeholder="Nhập mã phòng (VD: 12345)" 
                                                value={pvfRoomIdInput}
                                                onChange={(e) => setPvfRoomIdInput(e.target.value)}
                                                className="glass-input"
                                                style={{ flex: 1 }}
                                            />
                                            <button onClick={joinRoom} className="glass-btn glass-btn-success">
                                                Vào
                                            </button>
                                        </div>
                                        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                                            * Khi vào phòng có sẵn, chế độ Rated/Unrated sẽ do người tạo phòng quyết định
                                        </p>
                                    </>
                                ) : (
                                    <div className="text-center">
                                        <h3 className="text-dark" style={{ color: '#276749' }}>
                                            ✅ Phòng đã được tạo!
                                        </h3>
                                        <p style={{ 
                                            marginTop: '10px',
                                            padding: '8px 15px',
                                            borderRadius: '20px',
                                            display: 'inline-block',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            background: roomIsRated ? 'linear-gradient(135deg, #11998e, #38ef7d)' : 'linear-gradient(135deg, #667eea, #764ba2)',
                                            color: 'white'
                                        }}>
                                            {roomIsRated ? '🏆 Rated Game' : '🎮 Unrated Game'}
                                        </p>
                                        <p className="text-dark mt-md" style={{ opacity: 0.8 }}>
                                            Hãy gửi mã này cho bạn bè:
                                        </p>
                                        <div className="glass-room-code mt-md">
                                            {createdRoomId}
                                        </div>
                                        <p className="text-dark mt-lg" style={{ opacity: 0.7 }}>
                                            Đang chờ người chơi thứ 2...
                                        </p>
                                        <div className="glass-spinner"></div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="glass-card" style={{ display: 'inline-block' }}>
                                <div className="glass-spinner"></div>
                                <p className="text-dark mt-md">Đang tìm trận đấu mới...</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Game;