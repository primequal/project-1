import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const History = () => {
  const [games, setGames] = useState([]);
  const [searchName, setSearchName] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const navigate = useNavigate();

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/games/history`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { opponent: searchName, date: searchDate } 
      });
      setGames(res.data);
    } catch (err) {
      console.error("Lỗi lấy lịch sử:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto' }}>
      <button onClick={() => navigate('/dashboard')}>← Quay lại Dashboard</button>
      <h2 style={{ textAlign: 'center' }}>Lịch Sử Ván Đấu</h2>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
        <input 
          type="text" placeholder="Tìm theo tên đối thủ..." 
          value={searchName} onChange={(e) => setSearchName(e.target.value)}
          style={inputStyle}
        />
        <input 
          type="date" 
          value={searchDate} onChange={(e) => setSearchDate(e.target.value)}
          style={inputStyle}
        />
        <button onClick={fetchHistory} style={{ cursor: 'pointer' }}>Tìm kiếm</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
        <thead>
          <tr style={{ backgroundColor: '#f4f4f4' }}>
            <th style={tableHeader}>Ngày diễn ra</th>
            <th style={tableHeader}>Đối thủ</th>
            <th style={tableHeader}>Kết quả</th>
            <th style={tableHeader}>Biến động Elo</th> {/* Cột mới */}
            <th style={tableHeader}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => {
            const currentUser = JSON.parse(localStorage.getItem('user'));
            const isP1 = game.player1_id === currentUser.id;
            const opponentName = isP1 ? game.p2_name : game.p1_name;
            const isWin = game.winner_id === currentUser.id;
            const isDraw = game.winner_id === null;

            // Xác định elo change của mình
            // Nếu mình là P1 thì lấy p1_elo_change, ngược lại lấy p2_elo_change
            // Nếu giá trị null (ván cũ chưa có tính năng này) thì hiện 0
            const eloDiff = isP1 ? (game.p1_elo_change || 0) : (game.p2_elo_change || 0);
            
            // Định dạng màu sắc: Dương xanh, Âm đỏ
            const eloColor = eloDiff > 0 ? 'green' : (eloDiff < 0 ? 'red' : 'gray');
            const eloText = eloDiff > 0 ? `+${eloDiff}` : `${eloDiff}`;

            return (
              <tr key={game.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={tableCell}>{new Date(game.end_time).toLocaleString()}</td>
                <td style={tableCell}>{opponentName || "Máy (AI)"}</td>
                <td style={{ ...tableCell, color: isDraw ? 'gray' : (isWin ? 'green' : 'red'), fontWeight: 'bold' }}>
                  {isDraw ? 'Hòa' : (isWin ? 'Thắng' : 'Thua')}
                </td>
                
                {/* HIỂN THỊ BIẾN ĐỘNG ELO */}
                <td style={{ ...tableCell, color: eloColor, fontWeight: 'bold' }}>
                    {eloText}
                </td>

                <td style={tableCell}>
                  <button 
                    onClick={() => navigate(`/replay/${game.id}`)}
                    style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '4px' }}
                  >
                    Xem lại
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const inputStyle = { padding: '8px', borderRadius: '4px', border: '1px solid #ccc' };
const tableHeader = { padding: '12px', borderBottom: '2px solid #ddd' };
const tableCell = { padding: '12px' };

export default History;