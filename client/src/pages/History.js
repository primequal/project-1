import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles.css';

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

  const currentUser = JSON.parse(localStorage.getItem('user'));

  return (
    <div className="app-background">
      <div className="floating-shapes">
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
      </div>

      <div style={{ padding: '30px', position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          
          {/* Header */}
          <div className="text-center mb-lg">
            <button onClick={() => navigate('/dashboard')} className="glass-btn glass-btn-outline mb-md">
              ← Quay lại Dashboard
            </button>
            <h2 className="glass-title">📜 Lịch Sử Ván Đấu</h2>
          </div>

          {/* Search Box */}
          <div className="glass-card glass-card-sm mb-lg">
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="🔍 Tìm theo tên đối thủ..." 
                value={searchName} 
                onChange={(e) => setSearchName(e.target.value)}
                className="glass-input"
                style={{ maxWidth: '250px' }}
              />
              <input 
                type="date" 
                value={searchDate} 
                onChange={(e) => setSearchDate(e.target.value)}
                className="glass-input"
                style={{ maxWidth: '180px' }}
              />
              <button onClick={fetchHistory} className="glass-btn glass-btn-primary">
                🔎 Tìm kiếm
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            {games.length === 0 ? (
              <div className="text-center text-dark" style={{ padding: '40px' }}>
                <p style={{ fontSize: '48px', marginBottom: '15px' }}>🎮</p>
                <p>Chưa có ván đấu nào được ghi nhận.</p>
              </div>
            ) : (
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>📅 Ngày diễn ra</th>
                    <th>👤 Đối thủ</th>
                    <th>🏆 Kết quả</th>
                    <th>📊 Biến động Elo</th>
                    <th>⚡ Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((game) => {
                    const isP1 = game.player1_id === currentUser.id;
                    const opponentName = isP1 ? game.p2_name : game.p1_name;
                    const isWin = game.winner_id === currentUser.id;
                    const isDraw = game.winner_id === null;

                    const eloDiff = isP1 ? (game.p1_elo_change || 0) : (game.p2_elo_change || 0);
                    const eloColor = eloDiff > 0 ? '#38ef7d' : (eloDiff < 0 ? '#ff5252' : '#888');
                    const eloText = eloDiff > 0 ? `+${eloDiff}` : `${eloDiff}`;

                    return (
                      <tr key={game.id}>
                        <td>{new Date(game.end_time).toLocaleString()}</td>
                        <td style={{ fontWeight: '500' }}>{opponentName || "🤖 Máy (AI)"}</td>
                        <td>
                          <span style={{ 
                            color: isDraw ? '#ffd700' : (isWin ? '#38ef7d' : '#ff5252'), 
                            fontWeight: 'bold',
                            padding: '5px 12px',
                            borderRadius: '20px',
                            background: isDraw ? 'rgba(255,215,0,0.2)' : (isWin ? 'rgba(56,239,125,0.2)' : 'rgba(255,82,82,0.2)')
                          }}>
                            {isDraw ? '🤝 Hòa' : (isWin ? '✅ Thắng' : '❌ Thua')}
                          </span>
                        </td>
                        <td style={{ color: eloColor, fontWeight: 'bold', fontSize: '16px' }}>
                          {eloText}
                        </td>
                        <td>
                          <button 
                            onClick={() => navigate(`/replay/${game.id}`)}
                            className="glass-btn glass-btn-info"
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                          >
                            ▶️ Xem lại
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default History;