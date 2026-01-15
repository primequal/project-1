import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';
import CaroBoard from '../CaroBoard';

const Game = () => {
    const { type } = useParams();
    const navigate = useNavigate();
    const [gameState, setGameState] = useState({ 
        roomId: null, myPiece: null, isMyTurn: false, opponent: null, initialBoard: null 
    });
    
    // --- STATE PVF & CHAT ---
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [pvfRoomIdInput, setPvfRoomIdInput] = useState(""); // Input nhập mã phòng
    const [createdRoomId, setCreatedRoomId] = useState(null); // Mã phòng vừa tạo
    // ------------------------

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

        // LOGIC CHỌN CHẾ ĐỘ
        if (!hasJoinedRef.current) {
            // Nếu KHÔNG phải PvF, tự động join như cũ
            if (type !== 'pvf') {
                hasJoinedRef.current = true;
                socket.emit('join_game', { type, user });
            }
            // Nếu là PvF, không làm gì cả, đợi người dùng bấm nút
        }

        // Listener cho game thường
        const onReady = (data) => {
            setGameState({ 
                roomId: data.roomId, myPiece: data.piece, isMyTurn: data.turn, 
                opponent: data.opponent, initialBoard: data.board 
            });
            setMessages([]);
            setCreatedRoomId(null); // Xóa mã phòng chờ nếu đã vào game
        };

        const onRole = (data) => setGameState(prev => ({ 
            ...prev, roomId: data.roomId, myPiece: data.piece, 
            isMyTurn: data.turn, opponent: data.opponent,
            initialBoard: data.board || Array(15).fill(null).map(() => Array(15).fill(null))
        }));
        
        const onResult = (data) => {
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

        // --- LISTENER RIÊNG CHO PVF ---
        const onPvfCreated = (data) => {
            setCreatedRoomId(data.roomId);
        };
        const onPvfError = (msg) => {
            alert(msg);
        };
        // ------------------------------

        socket.on('game_ready', onReady);
        socket.on('role_assigned', onRole);
        socket.on('game_result', onResult);
        socket.on('pvf_created', onPvfCreated);
        socket.on('pvf_error', onPvfError);

        return () => {
            socket.off('game_ready', onReady);
            socket.off('role_assigned', onRole);
            socket.off('game_result', onResult);
            socket.off('pvf_created', onPvfCreated);
            socket.off('pvf_error', onPvfError);
        };
    }, [type, navigate]);

    // Chat Listener riêng biệt
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
            socket.emit('leave_game', user.id);
            hasJoinedRef.current = false;
        }
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

    // --- HÀM XỬ LÝ NÚT BẤM PVF ---
    const createRoom = () => {
        socket.emit('create_pvf', { user: userRef.current });
    };

    const joinRoom = () => {
        if (!pvfRoomIdInput.trim()) return alert("Vui lòng nhập mã phòng!");
        socket.emit('join_pvf', { user: userRef.current, roomId: pvfRoomIdInput.trim() });
    };
    // ----------------------------

    return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
            <h2>CHẾ ĐỘ: {type.toUpperCase()}</h2>
            <button onClick={handleLeaveGame} style={{ marginBottom: '10px', padding: '8px 16px', cursor: 'pointer' }}>
                ← Thoát về Dashboard
            </button>
            
            {/* TRƯỜNG HỢP 1: Đã vào game (có roomId từ server) */}
            {gameState.roomId ? (
                <div key={gameState.roomId} style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
                    <div>
                        {/* --- PHẦN HIỂN THỊ THÔNG TIN TRẬN ĐẤU --- */}
                        <div style={{ marginBottom: '10px', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '8px' }}>
                            <p style={{ margin: '5px 0' }}>Đối thủ: <strong>{gameState.opponent?.username}</strong></p>
                            <p style={{ margin: '5px 0' }}>Bạn cầm quân: <strong style={{ color: gameState.myPiece === 'X' ? 'red' : 'blue', fontSize: '18px' }}>{gameState.myPiece}</strong></p>
                            
                            {/* --- HIỂN THỊ MÃ PHÒNG (Chỉ hiện nếu là PvF) --- */}
                            {type === 'pvf' && (
                                <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px dashed #ccc' }}>
                                    Mã phòng: <span style={{ fontWeight: 'bold', color: '#007bff', fontSize: '18px' }}>
                                        {/* roomId có dạng "pvf_12345", ta cắt lấy phần số */}
                                        {gameState.roomId.split('_')[1]}
                                    </span>
                                </div>
                            )}
                            
                            <h3 style={{ color: gameState.isMyTurn ? 'green' : 'gray', margin: '10px 0' }}>
                                {gameState.isMyTurn ? "🔥 ĐẾN LƯỢT BẠN 🔥" : "⏳ ĐỐI THỦ ĐANG SUY NGHĨ..."}
                            </h3>
                        </div>
                        {/* ------------------------------------------ */}

                        <CaroBoard {...gameState} setIsMyTurn={(val) => setGameState(p => ({...p, isMyTurn: val}))} type={type} />
                    </div>

                    {type !== 'pve' && (
                        <div style={chatContainerStyle}>
                            <div style={chatHeaderStyle}>💬 Trò chuyện</div>
                            <div style={chatBodyStyle}>
                                {messages.map((msg, index) => {
                                    const isMe = msg.userId === userRef.current?.id;
                                    return (
                                        <div key={index} style={{ textAlign: isMe ? 'right' : 'left', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>{msg.username}</span>
                                            <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '15px', backgroundColor: isMe ? '#007bff' : '#f1f0f0', color: isMe ? 'white' : 'black', maxWidth: '80%', wordWrap: 'break-word', textAlign: 'left' }}>
                                                {msg.content}
                                            </span>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                            <form onSubmit={handleSendMessage} style={chatInputContainerStyle}>
                                <input type="text" placeholder="Nhập tin nhắn..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} style={chatInputStyle} />
                                <button type="submit" style={chatButtonStyle}>Gửi</button>
                            </form>
                        </div>
                    )}
                </div>
            ) : (
                /* TRƯỜNG HỢP 2: Chưa vào game */
                <div style={{ marginTop: '20px' }}>
                    {type === 'pvf' ? (
                        /* Giao diện sảnh chờ PvF */
                        <div style={{ border: '1px solid #ddd', padding: '30px', borderRadius: '10px', display: 'inline-block', backgroundColor: 'white' }}>
                            {!createdRoomId ? (
                                <>
                                    <h3 style={{ marginBottom: '20px' }}>Chơi với Bạn Bè</h3>
                                    <div style={{ marginBottom: '20px' }}>
                                        <button onClick={createRoom} style={{ ...btnStyle, backgroundColor: '#17a2b8' }}>+ Tạo Phòng Mới</button>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input 
                                            type="text" 
                                            placeholder="Nhập mã phòng (VD: 12345)" 
                                            value={pvfRoomIdInput}
                                            onChange={(e) => setPvfRoomIdInput(e.target.value)}
                                            style={inputStyle}
                                        />
                                        <button onClick={joinRoom} style={{ ...btnStyle, width: 'auto' }}>Vào Phòng</button>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <h3 style={{ color: 'green' }}>Phòng đã được tạo!</h3>
                                    <p>Hãy gửi mã này cho bạn bè:</p>
                                    <h1 style={{ fontSize: '48px', margin: '10px 0', color: '#007bff', letterSpacing: '5px' }}>{createdRoomId}</h1>
                                    <p>Đang chờ người chơi thứ 2...</p>
                                    <div className="spinner" style={{ margin: '20px auto', width: '30px', height: '30px', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p>Đang tìm trận đấu mới...</p>
                    )}
                </div>
            )}
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

// Styles
const chatContainerStyle = { width: '300px', height: '450px', border: '1px solid #ddd', borderRadius: '10px', display: 'flex', flexDirection: 'column', backgroundColor: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', marginTop: '20px' };
const chatHeaderStyle = { padding: '10px', backgroundColor: '#007bff', color: 'white', fontWeight: 'bold', borderTopLeftRadius: '10px', borderTopRightRadius: '10px' };
const chatBodyStyle = { flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column' };
const chatInputContainerStyle = { display: 'flex', padding: '10px', borderTop: '1px solid #ddd' };
const chatInputStyle = { flex: 1, padding: '8px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none', marginRight: '5px' };
const chatButtonStyle = { padding: '8px 15px', borderRadius: '20px', border: 'none', backgroundColor: '#007bff', color: 'white', cursor: 'pointer' };
const btnStyle = { padding: '10px 20px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' };
const inputStyle = { padding: '10px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc' };

export default Game;