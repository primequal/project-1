import React, { useState, useEffect } from 'react';
import socket from './socket';

const CaroBoard = ({ roomId, myPiece, isMyTurn, setIsMyTurn, initialBoard, type }) => {
    // Reset board về null hoàn toàn khi roomId thay đổi
    const [board, setBoard] = useState(Array(15).fill(null).map(() => Array(15).fill(null)));
    const [gameOver, setGameOver] = useState(false);

    useEffect(() => {
        if (initialBoard) setBoard(initialBoard);
        else setBoard(Array(15).fill(null).map(() => Array(15).fill(null)));
        setGameOver(false);
    }, [roomId, initialBoard]);

    useEffect(() => {
        const onReceiveMove = (data) => {
            console.log('=== CLIENT: RECEIVED MOVE ===', data);
            setBoard(prev => {
                const nb = prev.map(r => [...r]);
                nb[data.r][data.c] = data.piece;
                if (checkWin(nb, data.r, data.c, data.piece)) {
                    setGameOver(true);
                    setTimeout(() => alert("ĐỐI THỦ ĐÃ GIÀNH CHIẾN THẮNG!"), 100);
                }
                return nb;
            });
            setIsMyTurn(true);
        };
        console.log('=== CLIENT: Registering receive_move listener ===');
        socket.on('receive_move', onReceiveMove);
        return () => {
            console.log('=== CLIENT: Removing receive_move listener ===');
            socket.off('receive_move', onReceiveMove);
        };
    }, [setIsMyTurn]);

    const handleClick = (r, c) => {
        // CHẶN TUYỆT ĐỐI nếu game đã kết thúc hoặc không phải lượt
        if (board[r][c] || !isMyTurn || gameOver) return;

        const nb = board.map(row => [...row]);
        nb[r][c] = myPiece;
        setBoard(nb);
        setIsMyTurn(false);

        const userId = JSON.parse(localStorage.getItem('user')).id;
        socket.emit('make_move', { roomId, r, c, piece: myPiece, userId, type });

        if (checkWin(nb, r, c, myPiece)) {
            setGameOver(true);
            setTimeout(() => {
                socket.emit('game_over', { roomId, winnerId: userId });
            }, 100);
        }
    };

    const checkWin = (b, r, c, p) => {
        const dirs = [[0,1],[1,0],[1,1],[1,-1]];
        for (let [dr, dc] of dirs) {
            let count = 1;
            for (let i = 1; i < 5; i++) {
                let nr = r+dr*i, nc = c+dc*i;
                if (nr>=0 && nr<15 && nc>=0 && nc<15 && b[nr][nc]===p) count++; else break;
            }
            for (let i = 1; i < 5; i++) {
                let nr = r-dr*i, nc = c-dc*i;
                if (nr>=0 && nr<15 && nc>=0 && nc<15 && b[nr][nc]===p) count++; else break;
            }
            if (count >= 5) return true;
        }
        return false;
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 30px)', justifyContent: 'center', marginTop: '20px' }}>
            {board.map((row, r) => row.map((cell, c) => (
                <div 
                    key={`${r}-${c}`} 
                    onClick={() => handleClick(r, c)} 
                    style={{ 
                        width: 30, height: 30, border: '1px solid #ccc', 
                        backgroundColor: cell==='X'?'#ffebee':cell==='O'?'#e3f2fd':'white', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        cursor: (isMyTurn && !gameOver && !cell) ? 'pointer' : 'default',
                        fontSize: '18px', fontWeight: 'bold'
                    }}
                >
                    <span style={{ color: cell === 'X' ? 'red' : 'blue' }}>{cell}</span>
                </div>
            )))}
        </div>
    );
};

export default CaroBoard;