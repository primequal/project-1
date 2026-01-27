import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';
import CaroBoard from '../CaroBoard';
import { useSound } from '../hooks/useSound';
import '../styles.css';

const Game = () => {
    const { type } = useParams();
    const navigate = useNavigate();
    const { playMoveSound, playWinSound, playLoseSound, playGameStartSound } = useSound();
    const [gameState, setGameState] = useState({ 
        roomId: null, myPiece: null, isMyTurn: false, opponent: null, initialBoard: null 
    });
    
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [pvfRoomIdInput, setPvfRoomIdInput] = useState("");
    const [createdRoomId, setCreatedRoomId] = useState(null);
    const [isRated, setIsRated] = useState(true); // Rated/Unrated for PvF
    const [roomIsRated, setRoomIsRated] = useState(true); // Track if current room is rated
    
    // AI Difficulty (PvE)
    const [aiDifficulty, setAiDifficulty] = useState('easy'); // easy/medium/hard
    
    // Time Control
    const [timeControl, setTimeControl] = useState(30); // seconds per turn (PvP: 30 or 60, PvE: 0 = unlimited, PvF: custom)
    const [myTime, setMyTime] = useState(null); // remaining time for my turn
    const [opponentTime, setOpponentTime] = useState(null);
    const timerRef = useRef(null);
    
    // Emoji picker
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const emojiPickerRef = useRef(null);
    const emojiButtonRef = useRef(null);
    
    // Settings selected before joining game
    const [hasSelectedSettings, setHasSelectedSettings] = useState(false);
    const [pvfTimeControlInput, setPvfTimeControlInput] = useState('60'); // Custom time for PvF
    
    // Spectator states
    const [isSpectator, setIsSpectator] = useState(false);
    const [spectatorData, setSpectatorData] = useState(null);
    const [showSpectateDialog, setShowSpectateDialog] = useState(false);
    const [pendingSpectateRoom, setPendingSpectateRoom] = useState(null);
    const [spectatorCount, setSpectatorCount] = useState(0);
    const [invitedFriend, setInvitedFriend] = useState(null); // Track if room was created via invite
    
    // Rematch states
    const [showRematchDialog, setShowRematchDialog] = useState(false);
    const [gameResult, setGameResult] = useState(null);
    const [rematchRequested, setRematchRequested] = useState(false);
    const [opponentRematchRequest, setOpponentRematchRequest] = useState(false);

    const messagesEndRef = useRef(null);
    const userRef = useRef(JSON.parse(localStorage.getItem('user')));
    const hasJoinedRef = useRef(false);
    const myPieceRef = useRef(null); // Track my piece for timer logic
    const isMyTurnRef = useRef(false); // Track turn for timer logic
    const roomIdRef = useRef(null); // Track roomId for timer logic

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => { scrollToBottom(); }, [messages]);
    
    // Click outside to close emoji picker
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showEmojiPicker && 
                emojiPickerRef.current && 
                !emojiPickerRef.current.contains(event.target) &&
                emojiButtonRef.current &&
                !emojiButtonRef.current.contains(event.target)) {
                setShowEmojiPicker(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEmojiPicker]);
    
    // Update refs when state changes
    useEffect(() => {
        isMyTurnRef.current = gameState.isMyTurn;
        roomIdRef.current = gameState.roomId;
    }, [gameState.isMyTurn, gameState.roomId]);

    // Timer effect for time control
    useEffect(() => {
        if (timeControl === 0 || !gameState.roomId || type === 'pve') return;
        
        if (timerRef.current) clearInterval(timerRef.current);
        
        timerRef.current = setInterval(() => {
            if (isMyTurnRef.current) {
                // My turn - countdown my time
                setMyTime(prev => {
                    if (prev !== null && prev <= 1) {
                        clearInterval(timerRef.current);
                        // Time's up - I lose
                        console.log('[TIMER] Time up! Emitting time_up event', { roomId: roomIdRef.current, loserId: userRef.current.id });
                        socket.emit('time_up', { roomId: roomIdRef.current, loserId: userRef.current.id });
                        return 0;
                    }
                    return prev !== null ? prev - 1 : prev;
                });
            } else {
                // Opponent's turn - countdown opponent time
                setOpponentTime(prev => {
                    if (prev !== null && prev <= 1) {
                        clearInterval(timerRef.current);
                        // Opponent time's up - they lose, I report it
                        // Server will dedupe if both clients send this
                        console.log('[TIMER] Opponent time up! Emitting time_up event for opponent');
                        const opponentId = gameState.opponent?.id;
                        if (opponentId) {
                            socket.emit('time_up', { roomId: roomIdRef.current, loserId: opponentId });
                        }
                        return 0;
                    }
                    return prev !== null && prev > 0 ? prev - 1 : prev;
                });
            }
        }, 1000);
        
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [timeControl, gameState.roomId, type, gameState.opponent]);

    // Common emojis for quick access
    const commonEmojis = ['😀', '😂', '😍', '🤔', '😎', '😢', '😡', '👍', '👎', '👏', '🎉', '❤️', '🔥', '💪', '🙏', '😱', '🤣', '😊', '🥳', '✌️'];

    // Function to start game after selecting settings
    const startGame = () => {
        const user = userRef.current;
        if (!hasJoinedRef.current) {
            hasJoinedRef.current = true;
            if (type === 'pve') {
                socket.emit('join_game', { type, user, aiDifficulty });
            } else if (type === 'pvp') {
                socket.emit('join_game', { type, user, timeControl });
            }
        }
        setHasSelectedSettings(true);
    };

    useEffect(() => {
        const user = userRef.current;
        if (!user) return navigate('/login');

        if (!hasJoinedRef.current && type === 'pvf') {
            // Check if coming from invite (room already created by inviter)
            const invitedRoom = sessionStorage.getItem('pvf_invited_room');
            if (invitedRoom) {
                const { roomId, invitedFriend: friendName } = JSON.parse(invitedRoom);
                setCreatedRoomId(roomId);
                setInvitedFriend(friendName);
                setRoomIsRated(true); // Invites are always rated
                setTimeControl(60); // Invites always use 60s time control
                sessionStorage.removeItem('pvf_invited_room');
                hasJoinedRef.current = true;
            }
            
            // Check if joining from notification (invited player)
            const joinRoomId = sessionStorage.getItem('pvf_join_room');
            if (joinRoomId) {
                sessionStorage.removeItem('pvf_join_room');
                setTimeControl(60); // Invites always use 60s time control
                // Auto join the room
                socket.emit('join_pvf', { user, roomId: joinRoomId });
                hasJoinedRef.current = true;
                setHasSelectedSettings(true);
            }
        }

        const onReady = (data) => {
            setGameState({ 
                roomId: data.roomId, myPiece: data.piece, isMyTurn: data.turn, 
                opponent: data.opponent, initialBoard: data.board 
            });
            myPieceRef.current = data.piece; // Track piece for timer
            setMessages([]);
            setCreatedRoomId(null);
            // Set initial time
            if (data.timeControl && data.timeControl > 0) {
                setTimeControl(data.timeControl);
                setMyTime(data.timeControl);
                setOpponentTime(data.timeControl);
            }
        };

        const onRole = (data) => {
            setGameState(prev => ({ 
                ...prev, roomId: data.roomId, myPiece: data.piece, 
                isMyTurn: data.turn, opponent: data.opponent,
                initialBoard: data.board || Array(15).fill(null).map(() => Array(15).fill(null))
            }));
            myPieceRef.current = data.piece; // Track piece for timer
            playGameStartSound();
            // Set initial time for role_assigned
            if (data.timeControl && data.timeControl > 0) {
                setTimeControl(data.timeControl);
                setMyTime(data.timeControl);
                setOpponentTime(data.timeControl);
            }
        };
        
        // Handle turn timer update from server
        const onTurnTimer = (data) => {
            // Update times based on my piece (using ref to avoid stale closure)
            const myPiece = myPieceRef.current;
            if (myPiece === 'X') {
                setMyTime(data.p1Time);
                setOpponentTime(data.p2Time);
            } else {
                setMyTime(data.p2Time);
                setOpponentTime(data.p1Time);
            }
        };
        
        // Handle time up - just play sound, game_result event will handle the rest
        const onPlayerTimeUp = (data) => {
            // This is now handled by game_result event with timeUp flag
            // Keep this for backwards compatibility but main logic is in onResult
        };

        const onResult = (data) => {
            // Clear timer immediately when game ends
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            
            const user = userRef.current;
            const myUpdatedData = (data.user1.id === user.id) ? data.user1 : data.user2;
            if (myUpdatedData.id) localStorage.setItem('user', JSON.stringify(myUpdatedData));
            
            const iWon = data.winnerId === user.id;
            const isDraw = data.winnerId === null;
            
            // Play sound based on result
            if (iWon) {
                playWinSound();
            } else if (!isDraw) {
                playLoseSound();
            }
            
            // For PvP/PvF, show rematch dialog instead of navigating away
            if (type === 'pvp' || type === 'pvf') {
                setGameResult({
                    ...data,
                    iWon,
                    isDraw,
                    myData: myUpdatedData,
                    opponentData: (data.user1.id === user.id) ? data.user2 : data.user1
                });
                setShowRematchDialog(true);
                setRematchRequested(false);
                setOpponentRematchRequest(false);
            } else {
                // PvE - just show alert
                let message;
                if (data.forfeit) {
                    message = iWon ? "🎉 ĐỐI THỦ ĐÃ THOÁT! BẠN THẮNG!" : "Bạn đã thoát game và bị xử thua.";
                } else if (data.timeUp) {
                    message = iWon ? "⏱️ Đối thủ hết giờ! Bạn thắng!" : "⏱️ Hết giờ! Bạn đã thua!";
                } else {
                    message = iWon ? "🎉 CHÚC MỪNG! BẠN ĐÃ THẮNG!" : (isDraw ? "🤝 HÒA!" : "😢 BẠN ĐÃ THUA!");
                }
                alert(message);
                navigate('/dashboard');
            }
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

        // Rematch events
        const onRematchRequest = () => {
            setOpponentRematchRequest(true);
        };

        const onRematchAccepted = (data) => {
            // Reset game state for new game
            setShowRematchDialog(false);
            setGameResult(null);
            setRematchRequested(false);
            setOpponentRematchRequest(false);
            playGameStartSound();
            
            // Reset timer for new game
            if (data.timeControl && data.timeControl > 0) {
                setMyTime(data.timeControl);
                setOpponentTime(data.timeControl);
            }
            
            // Update piece ref for timer logic
            myPieceRef.current = data.piece;
            
            setGameState({
                roomId: data.roomId,
                myPiece: data.piece,
                isMyTurn: data.turn,
                opponent: data.opponent,
                initialBoard: data.board
            });
        };

        const onRematchDeclined = () => {
            setOpponentRematchRequest(false);
            setRematchRequested(false);
            setShowRematchDialog(false);
            alert('Đối thủ đã từ chối rematch');
            navigate('/dashboard');
        };

        const onOpponentLeft = () => {
            setShowRematchDialog(false);
            alert('Đối thủ đã rời phòng');
            navigate('/dashboard');
        };
        
        // Handle ELO update from server (for time_up case)
        const onEloUpdate = (data) => {
            if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
            }
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
        socket.on('rematch_request', onRematchRequest);
        socket.on('rematch_accepted', onRematchAccepted);
        socket.on('rematch_declined', onRematchDeclined);
        socket.on('turn_timer', onTurnTimer);
        socket.on('player_time_up', onPlayerTimeUp);
        socket.on('opponent_left_rematch', onOpponentLeft);
        socket.on('elo_update', onEloUpdate);

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
            socket.off('rematch_request', onRematchRequest);
            socket.off('rematch_accepted', onRematchAccepted);
            socket.off('rematch_declined', onRematchDeclined);
            socket.off('opponent_left_rematch', onOpponentLeft);
            socket.off('turn_timer', onTurnTimer);
            socket.off('player_time_up', onPlayerTimeUp);
            socket.off('elo_update', onEloUpdate);
        };
    }, [type, navigate, playGameStartSound, aiDifficulty, timeControl]);

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
            setShowEmojiPicker(false);
        }
    };

    const addEmoji = (emoji) => {
        setChatInput(prev => prev + emoji);
    };

    const createRoom = () => {
        const tc = parseInt(pvfTimeControlInput) || 0;
        socket.emit('create_pvf', { user: userRef.current, isRated, timeControl: tc });
    };

    const joinRoom = () => {
        if (!pvfRoomIdInput.trim()) return alert("Vui lòng nhập mã phòng!");
        socket.emit('join_pvf', { user: userRef.current, roomId: pvfRoomIdInput.trim() });
    };

    const formatTime = (seconds) => {
        if (seconds === null || seconds === undefined) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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

            {/* Rematch Dialog */}
            {showRematchDialog && gameResult && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div className="glass-card" style={{ maxWidth: '450px', textAlign: 'center' }}>
                        {/* Result Header */}
                        <div style={{
                            fontSize: '60px',
                            marginBottom: '15px'
                        }}>
                            {gameResult.iWon ? '🏆' : (gameResult.isDraw ? '🤝' : '😢')}
                        </div>
                        <h2 style={{
                            color: gameResult.iWon ? '#38a169' : (gameResult.isDraw ? '#667eea' : '#e53e3e'),
                            marginBottom: '20px',
                            fontSize: '1.8rem'
                        }}>
                            {gameResult.iWon ? 'CHIẾN THẮNG!' : (gameResult.isDraw ? 'HÒA!' : 'THUA CUỘC!')}
                        </h2>

                        {gameResult.forfeit && (
                            <p style={{ color: '#666', marginBottom: '15px', fontStyle: 'italic' }}>
                                {gameResult.iWon ? 'Đối thủ đã thoát trận đấu' : 'Bạn đã thoát trận đấu'}
                            </p>
                        )}

                        {/* ELO Changes */}
                        {roomIsRated && gameResult.myData && gameResult.opponentData && (
                            <div style={{
                                background: 'rgba(100,100,150,0.1)',
                                borderRadius: '12px',
                                padding: '15px',
                                marginBottom: '20px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <strong style={{ color: '#2d3748' }}>{gameResult.myData.username}</strong>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                                            {gameResult.myData.elo_rating}
                                        </div>
                                        <span style={{
                                            color: gameResult.iWon ? '#38a169' : (gameResult.isDraw ? '#666' : '#e53e3e'),
                                            fontWeight: '600'
                                        }}>
                                            {gameResult.iWon ? '+' : ''}{gameResult.eloChanges?.winner || gameResult.eloChanges?.loser || 0}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '18px', color: '#888' }}>vs</span>
                                    <div style={{ textAlign: 'center' }}>
                                        <strong style={{ color: '#2d3748' }}>{gameResult.opponentData.username}</strong>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                                            {gameResult.opponentData.elo_rating}
                                        </div>
                                        <span style={{
                                            color: !gameResult.iWon && !gameResult.isDraw ? '#38a169' : (gameResult.isDraw ? '#666' : '#e53e3e'),
                                            fontWeight: '600'
                                        }}>
                                            {!gameResult.iWon && !gameResult.isDraw ? '+' : ''}{!gameResult.iWon && !gameResult.isDraw ? (gameResult.eloChanges?.winner || 0) : (gameResult.eloChanges?.loser || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Opponent wants rematch notification */}
                        {opponentRematchRequest && (
                            <div style={{
                                background: 'linear-gradient(135deg, #ffecd2, #fcb69f)',
                                padding: '12px 20px',
                                borderRadius: '10px',
                                marginBottom: '20px',
                                animation: 'pulse 1s infinite'
                            }}>
                                <span style={{ fontSize: '16px', fontWeight: '600', color: '#c05621' }}>
                                    🔥 Đối thủ muốn đấu lại!
                                </span>
                            </div>
                        )}

                        {/* Rematch requested notification */}
                        {rematchRequested && !opponentRematchRequest && (
                            <div style={{
                                background: 'rgba(102, 126, 234, 0.15)',
                                padding: '12px 20px',
                                borderRadius: '10px',
                                marginBottom: '20px'
                            }}>
                                <span style={{ color: '#667eea', fontWeight: '500' }}>
                                    ⏳ Đang chờ đối thủ đồng ý...
                                </span>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {opponentRematchRequest ? (
                                <>
                                    <button
                                        onClick={() => {
                                            socket.emit('accept_rematch', { roomId: gameState.roomId });
                                        }}
                                        className="glass-btn glass-btn-success"
                                        style={{ minWidth: '140px' }}
                                    >
                                        ✅ Đồng ý
                                    </button>
                                    <button
                                        onClick={() => {
                                            socket.emit('decline_rematch', { roomId: gameState.roomId });
                                            setShowRematchDialog(false);
                                            navigate('/dashboard');
                                        }}
                                        className="glass-btn glass-btn-danger"
                                        style={{ minWidth: '140px' }}
                                    >
                                        ❌ Từ chối
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => {
                                            if (!rematchRequested) {
                                                socket.emit('request_rematch', { roomId: gameState.roomId });
                                                setRematchRequested(true);
                                            }
                                        }}
                                        className="glass-btn glass-btn-info"
                                        style={{ minWidth: '140px' }}
                                        disabled={rematchRequested}
                                    >
                                        🔄 Đấu lại
                                    </button>
                                    <button
                                        onClick={() => {
                                            socket.emit('leave_rematch', { roomId: gameState.roomId });
                                            setShowRematchDialog(false);
                                            navigate('/dashboard');
                                        }}
                                        className="glass-btn glass-btn-secondary"
                                        style={{ minWidth: '140px' }}
                                    >
                                        🏠 Về trang chủ
                                    </button>
                                </>
                            )}
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
                                
                                {/* Time Control Display */}
                                {timeControl > 0 && type !== 'pve' && (
                                    <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'center', 
                                        gap: '20px', 
                                        marginTop: '15px',
                                        padding: '10px',
                                        background: 'rgba(100,100,150,0.1)',
                                        borderRadius: '10px'
                                    }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '12px', color: '#666' }}>Bạn</div>
                                            <div style={{ 
                                                fontSize: '24px', 
                                                fontWeight: 'bold',
                                                color: gameState.isMyTurn ? (myTime <= 10 ? '#e53e3e' : '#38a169') : '#666'
                                            }}>
                                                ⏱️ {formatTime(myTime)}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '12px', color: '#666' }}>Đối thủ</div>
                                            <div style={{ 
                                                fontSize: '24px', 
                                                fontWeight: 'bold',
                                                color: !gameState.isMyTurn ? (opponentTime <= 10 ? '#e53e3e' : '#38a169') : '#666'
                                            }}>
                                                ⏱️ {formatTime(opponentTime)}
                                            </div>
                                        </div>
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
                                
                                {/* Emoji Picker */}
                                {showEmojiPicker && (
                                    <div ref={emojiPickerRef} style={{
                                        position: 'absolute',
                                        bottom: '55px',
                                        left: '10px',
                                        right: '10px',
                                        background: 'white',
                                        borderRadius: '10px',
                                        padding: '10px',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '5px',
                                        justifyContent: 'center',
                                        maxHeight: '120px',
                                        overflowY: 'auto',
                                        zIndex: 100
                                    }}>
                                        {commonEmojis.map((emoji, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => addEmoji(emoji)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    fontSize: '20px',
                                                    cursor: 'pointer',
                                                    padding: '5px',
                                                    borderRadius: '5px',
                                                    transition: 'background 0.2s',
                                                    flexShrink: 0
                                                }}
                                                onMouseOver={(e) => e.target.style.background = 'rgba(0,0,0,0.1)'}
                                                onMouseOut={(e) => e.target.style.background = 'none'}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                <form onSubmit={handleSendMessage} className="glass-chat-input-container" style={{ 
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '8px'
                                }}>
                                    <button
                                        ref={emojiButtonRef}
                                        type="button"
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            fontSize: '20px',
                                            cursor: 'pointer',
                                            padding: '5px',
                                            flexShrink: 0
                                        }}
                                    >
                                        😊
                                    </button>
                                    <input 
                                        type="text" 
                                        placeholder="Nhập tin nhắn..." 
                                        value={chatInput} 
                                        onChange={(e) => setChatInput(e.target.value)} 
                                        className="glass-chat-input"
                                        style={{ flex: 1, minWidth: 0 }}
                                    />
                                    <button type="submit" className="glass-chat-send" style={{
                                        background: '#0084ff',
                                        color: 'white',
                                        flexShrink: 0,
                                        padding: '8px 15px',
                                        whiteSpace: 'nowrap'
                                    }}>Gửi</button>
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
                                        
                                        {/* Time Control for PvF */}
                                        <div style={{ 
                                            background: 'rgba(200,200,220,0.3)',
                                            padding: '15px',
                                            borderRadius: '12px',
                                            marginBottom: '20px'
                                        }}>
                                            <p className="text-dark" style={{ marginBottom: '10px', fontWeight: '500' }}>
                                                ⏱️ Thời gian mỗi lượt:
                                            </p>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
                                                <button 
                                                    className={`glass-btn ${pvfTimeControlInput === '30' ? 'glass-btn-success' : ''}`}
                                                    onClick={() => setPvfTimeControlInput('30')}
                                                    style={{ padding: '8px 16px', minWidth: '60px' }}
                                                >
                                                    30s
                                                </button>
                                                <button 
                                                    className={`glass-btn ${pvfTimeControlInput === '60' ? 'glass-btn-success' : ''}`}
                                                    onClick={() => setPvfTimeControlInput('60')}
                                                    style={{ padding: '8px 16px', minWidth: '60px' }}
                                                >
                                                    60s
                                                </button>
                                                <button 
                                                    className={`glass-btn ${pvfTimeControlInput === '0' ? 'glass-btn-success' : ''}`}
                                                    onClick={() => setPvfTimeControlInput('0')}
                                                    style={{ padding: '8px 16px', minWidth: '80px' }}
                                                >
                                                    Vô hạn
                                                </button>
                                                <span style={{ color: '#666' }}>hoặc</span>
                                                <input 
                                                    type="number" 
                                                    placeholder="Giây"
                                                    value={pvfTimeControlInput !== '30' && pvfTimeControlInput !== '60' && pvfTimeControlInput !== '0' ? pvfTimeControlInput : ''}
                                                    onChange={(e) => setPvfTimeControlInput(e.target.value)}
                                                    className="glass-input"
                                                    style={{ width: '70px', textAlign: 'center' }}
                                                    min="10"
                                                    max="300"
                                                />
                                            </div>
                                        </div>
                                        
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
                                        
                                        {invitedFriend ? (
                                            <p className="text-dark mt-md" style={{ 
                                                background: 'rgba(102, 126, 234, 0.1)',
                                                padding: '10px 15px',
                                                borderRadius: '10px',
                                                color: '#667eea'
                                            }}>
                                                📨 Đã gửi lời mời cho <strong>{invitedFriend}</strong>
                                            </p>
                                        ) : (
                                            <p className="text-dark mt-md" style={{ opacity: 0.8 }}>
                                                Hãy gửi mã này cho bạn bè:
                                            </p>
                                        )}
                                        
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
                        ) : type === 'pve' && !hasSelectedSettings ? (
                            /* PvE: Chọn độ khó AI */
                            <div className="glass-card" style={{ display: 'inline-block', maxWidth: '450px' }}>
                                <h3 className="text-dark mb-lg" style={{ fontSize: '1.5rem' }}>
                                    🤖 Chọn Độ Khó AI
                                </h3>
                                <p className="text-dark mb-lg" style={{ opacity: 0.8 }}>
                                    Chọn mức độ khó cho AI:
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                    <button 
                                        className={`glass-btn glass-btn-full ${aiDifficulty === 'easy' ? 'glass-btn-success' : ''}`}
                                        onClick={() => setAiDifficulty('easy')}
                                        style={{
                                            padding: '15px 20px',
                                            background: aiDifficulty === 'easy' ? 'linear-gradient(135deg, #38a169, #48bb78)' : 'rgba(200,200,220,0.3)',
                                            border: aiDifficulty === 'easy' ? '2px solid #38a169' : '2px solid transparent'
                                        }}
                                    >
                                        <span style={{ fontSize: '20px', marginRight: '10px' }}>🟢</span>
                                        <strong>Dễ</strong> - AI suy nghĩ 3 bước
                                    </button>
                                    <button 
                                        className={`glass-btn glass-btn-full ${aiDifficulty === 'medium' ? 'glass-btn-warning' : ''}`}
                                        onClick={() => setAiDifficulty('medium')}
                                        style={{
                                            padding: '15px 20px',
                                            background: aiDifficulty === 'medium' ? 'linear-gradient(135deg, #d69e2e, #ecc94b)' : 'rgba(200,200,220,0.3)',
                                            border: aiDifficulty === 'medium' ? '2px solid #d69e2e' : '2px solid transparent'
                                        }}
                                    >
                                        <span style={{ fontSize: '20px', marginRight: '10px' }}>🟡</span>
                                        <strong>Trung Bình</strong> - AI suy nghĩ 5 bước
                                    </button>
                                    <button 
                                        className={`glass-btn glass-btn-full ${aiDifficulty === 'hard' ? 'glass-btn-danger' : ''}`}
                                        onClick={() => setAiDifficulty('hard')}
                                        style={{
                                            padding: '15px 20px',
                                            background: aiDifficulty === 'hard' ? 'linear-gradient(135deg, #e53e3e, #fc8181)' : 'rgba(200,200,220,0.3)',
                                            border: aiDifficulty === 'hard' ? '2px solid #e53e3e' : '2px solid transparent'
                                        }}
                                    >
                                        <span style={{ fontSize: '20px', marginRight: '10px' }}>🔴</span>
                                        <strong>Khó</strong> - AI suy nghĩ 6 bước
                                    </button>
                                </div>
                                <button 
                                    onClick={startGame}
                                    className="glass-btn glass-btn-info glass-btn-full"
                                    style={{ padding: '15px 30px', fontSize: '16px' }}
                                >
                                    🎮 Bắt Đầu Chơi
                                </button>
                            </div>
                        ) : type === 'pvp' && !hasSelectedSettings ? (
                            /* PvP: Chọn time control */
                            <div className="glass-card" style={{ display: 'inline-block', maxWidth: '450px' }}>
                                <h3 className="text-dark mb-lg" style={{ fontSize: '1.5rem' }}>
                                    ⏱️ Chọn Thời Gian Mỗi Lượt
                                </h3>
                                <p className="text-dark mb-lg" style={{ opacity: 0.8 }}>
                                    Mỗi người chơi có thời gian giới hạn mỗi lượt:
                                </p>
                                <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', justifyContent: 'center' }}>
                                    <button 
                                        className={`glass-btn ${timeControl === 30 ? 'glass-btn-info' : ''}`}
                                        onClick={() => setTimeControl(30)}
                                        style={{
                                            padding: '20px 30px',
                                            fontSize: '18px',
                                            background: timeControl === 30 ? 'linear-gradient(135deg, #3182ce, #63b3ed)' : 'rgba(200,200,220,0.3)',
                                            border: timeControl === 30 ? '2px solid #3182ce' : '2px solid transparent',
                                            minWidth: '120px'
                                        }}
                                    >
                                        <div style={{ fontSize: '28px', fontWeight: 'bold' }}>30s</div>
                                        <div style={{ fontSize: '12px', opacity: 0.8 }}>Nhanh</div>
                                    </button>
                                    <button 
                                        className={`glass-btn ${timeControl === 60 ? 'glass-btn-info' : ''}`}
                                        onClick={() => setTimeControl(60)}
                                        style={{
                                            padding: '20px 30px',
                                            fontSize: '18px',
                                            background: timeControl === 60 ? 'linear-gradient(135deg, #3182ce, #63b3ed)' : 'rgba(200,200,220,0.3)',
                                            border: timeControl === 60 ? '2px solid #3182ce' : '2px solid transparent',
                                            minWidth: '120px'
                                        }}
                                    >
                                        <div style={{ fontSize: '28px', fontWeight: 'bold' }}>60s</div>
                                        <div style={{ fontSize: '12px', opacity: 0.8 }}>Chuẩn</div>
                                    </button>
                                </div>
                                <button 
                                    onClick={startGame}
                                    className="glass-btn glass-btn-success glass-btn-full"
                                    style={{ padding: '15px 30px', fontSize: '16px' }}
                                >
                                    🔍 Tìm Trận Đấu
                                </button>
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