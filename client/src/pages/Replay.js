import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Thêm useNavigate để quay lại
import axios from 'axios';

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
            const { x_coord, y_coord } = moves[i]; // Bỏ player_id vì không dùng
            newBoard[x_coord][y_coord] = (i % 2 === 0) ? 'X' : 'O';
        }
        setBoard(newBoard);
        setCurrentStep(step);
    };

    return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
            <button onClick={() => navigate('/history')}>← Quay lại Lịch sử</button>
            <h2>Xem lại ván đấu #{id}</h2>
            <div style={{ marginBottom: '20px' }}>
                <button disabled={currentStep === 0} onClick={() => showStep(currentStep - 1)}>Trở lại</button>
                <span style={{ margin: '0 15px' }}>Nước đi: {currentStep} / {moves.length}</span>
                <button disabled={currentStep === moves.length} onClick={() => showStep(currentStep + 1)}>Tiếp theo</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(15, 30px)`, justifyContent: 'center' }}>
                {board.map((row, r) => row.map((cell, c) => (
                    <div key={`${r}-${c}`} style={{ 
                        width: '30px', height: '30px', border: '1px solid #ccc',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: cell === 'X' ? '#ffebee' : cell === 'O' ? '#e3f2fd' : 'white'
                    }}>
                        <span style={{ color: cell === 'X' ? 'red' : 'blue', fontWeight: 'bold' }}>{cell}</span>
                    </div>
                )))}
            </div>
        </div>
    );
};

export default Replay; // DÒNG QUAN TRỌNG NHẤT: Phải có dòng này!