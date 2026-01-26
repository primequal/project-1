import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles.css';

const Replay = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [moves, setMoves] = useState([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [board, setBoard] = useState(Array(15).fill(null).map(() => Array(15).fill(null)));

    useEffect(() => {
        const fetchMoves = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/games/${id}/moves`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                setMoves(res.data);
            } catch (err) {
                console.error("Lỗi lấy nước đi:", err);
            }
        };
        fetchMoves();
    }, [id]);

    const showStep = (step) => {
        const newBoard = Array(15).fill(null).map(() => Array(15).fill(null));
        for (let i = 0; i < step; i++) {
            const { x_coord, y_coord } = moves[i];
            newBoard[x_coord][y_coord] = (i % 2 === 0) ? 'X' : 'O';
        }
        setBoard(newBoard);
        setCurrentStep(step);
    };

    return (
        <div className="app-background">
            <div className="floating-shapes">
                <div className="shape"></div>
                <div className="shape"></div>
                <div className="shape"></div>
                <div className="shape"></div>
            </div>

            <div style={{ padding: '30px', position: 'relative', zIndex: 1, minHeight: '100vh' }}>
                <div className="text-center">
                    <button onClick={() => navigate('/history')} className="glass-btn glass-btn-outline mb-md">
                        ← Quay lại Lịch sử
                    </button>
                    
                    <h2 className="glass-title mb-lg">🎬 Xem lại ván đấu #{id}</h2>

                    {/* Controls */}
                    <div className="glass-card glass-card-sm mb-lg" style={{ display: 'inline-block' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <button 
                                disabled={currentStep === 0} 
                                onClick={() => showStep(currentStep - 1)}
                                className="glass-btn glass-btn-secondary"
                                style={{ opacity: currentStep === 0 ? 0.5 : 1 }}
                            >
                                ⏮️ Trở lại
                            </button>
                            
                            <div className="text-dark" style={{ minWidth: '150px' }}>
                                <span style={{ fontSize: '14px', opacity: 0.7 }}>Nước đi</span>
                                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                                    {currentStep} / {moves.length}
                                </div>
                            </div>
                            
                            <button 
                                disabled={currentStep === moves.length} 
                                onClick={() => showStep(currentStep + 1)}
                                className="glass-btn glass-btn-primary"
                                style={{ opacity: currentStep === moves.length ? 0.5 : 1 }}
                            >
                                Tiếp theo ⏭️
                            </button>
                        </div>
                        
                        {/* Progress bar */}
                        <div style={{ 
                            marginTop: '15px', 
                            height: '6px', 
                            background: 'rgba(100,100,150,0.2)', 
                            borderRadius: '3px',
                            overflow: 'hidden'
                        }}>
                            <div style={{ 
                                width: `${moves.length > 0 ? (currentStep / moves.length) * 100 : 0}%`, 
                                height: '100%', 
                                background: 'linear-gradient(90deg, #667eea, #764ba2)',
                                transition: 'width 0.3s ease'
                            }}></div>
                        </div>
                    </div>

                    {/* Board */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div className="glass-board">
                            {board.map((row, r) => row.map((cell, c) => (
                                <div 
                                    key={`${r}-${c}`} 
                                    className={`glass-cell ${cell === 'X' ? 'glass-cell-x glass-cell-filled' : ''} ${cell === 'O' ? 'glass-cell-o glass-cell-filled' : ''}`}
                                >
                                    {cell}
                                </div>
                            )))}
                        </div>
                    </div>

                    {/* Quick navigation */}
                    {moves.length > 0 && (
                        <div className="glass-card glass-card-sm mt-lg" style={{ display: 'inline-block' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button 
                                    onClick={() => showStep(0)}
                                    className="glass-btn glass-btn-outline"
                                    style={{ padding: '8px 15px' }}
                                >
                                    ⏮️ Đầu
                                </button>
                                <button 
                                    onClick={() => showStep(moves.length)}
                                    className="glass-btn glass-btn-outline"
                                    style={{ padding: '8px 15px' }}
                                >
                                    Cuối ⏭️
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Replay;