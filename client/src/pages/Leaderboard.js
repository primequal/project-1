import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLeaderboard } from '../api';
import '../styles.css';

const Leaderboard = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data } = await getLeaderboard();
        setPlayers(data);
      } catch (err) {
        console.error('Lỗi lấy leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const getRankBadge = (rank) => {
    switch (rank) {
      case 1:
        return <span style={{ fontSize: '24px' }}>🥇</span>;
      case 2:
        return <span style={{ fontSize: '24px' }}>🥈</span>;
      case 3:
        return <span style={{ fontSize: '24px' }}>🥉</span>;
      default:
        return <span style={{ 
          background: 'rgba(102, 126, 234, 0.2)', 
          color: '#667eea',
          padding: '4px 10px',
          borderRadius: '12px',
          fontWeight: '600',
          fontSize: '14px'
        }}>#{rank}</span>;
    }
  };

  const getWinRate = (player) => {
    if (player.total_matches === 0) return '0%';
    return Math.round((player.wins / player.total_matches) * 100) + '%';
  };

  return (
    <div className="app-background">
      <div className="floating-shapes">
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
      </div>
      
      <div className="container-center" style={{ padding: '40px 20px' }}>
        <div className="glass-card" style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '30px',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <h1 style={{ 
              margin: 0,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: '28px'
            }}>
              🏆 Bảng Xếp Hạng
            </h1>
            <button
              onClick={() => navigate('/dashboard')}
              className="glass-btn glass-btn-secondary"
            >
              ← Quay lại
            </button>
          </div>

          {/* Subtitle */}
          <p style={{ color: '#666', marginBottom: '25px', textAlign: 'center' }}>
            Top 20 người chơi có ELO cao nhất
          </p>

          {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            Đang tải bảng xếp hạng...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 100px 80px 80px 80px 100px',
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              borderRadius: '12px 12px 0 0',
              color: 'white',
              fontWeight: '600',
              fontSize: '13px'
            }}>
              <div style={{ textAlign: 'center' }}>Hạng</div>
              <div>Người chơi</div>
              <div style={{ textAlign: 'center' }}>ELO</div>
              <div style={{ textAlign: 'center' }}>Thắng</div>
              <div style={{ textAlign: 'center' }}>Thua</div>
              <div style={{ textAlign: 'center' }}>Hòa</div>
              <div style={{ textAlign: 'center' }}>Tỷ lệ thắng</div>
            </div>

            {/* Table Body */}
            {players.map((player, index) => {
              const rank = index + 1;
              const isCurrentUser = currentUser && currentUser.id === player.id;
              
              return (
                <div key={player.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 100px 80px 80px 80px 100px',
                  padding: '15px 20px',
                  alignItems: 'center',
                  borderBottom: '1px solid rgba(200, 200, 220, 0.2)',
                  background: isCurrentUser 
                    ? 'rgba(102, 126, 234, 0.1)' 
                    : (rank <= 3 ? 'rgba(255, 215, 0, 0.05)' : 'transparent'),
                  transition: 'background 0.2s'
                }}>
                  {/* Rank */}
                  <div style={{ textAlign: 'center' }}>
                    {getRankBadge(rank)}
                  </div>

                  {/* Player Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                      <img
                        src={player.avatar?.startsWith('http') || player.avatar?.startsWith('/') 
                          ? player.avatar 
                          : "https://cdn-icons-png.flaticon.com/512/847/847969.png"}
                        alt={player.username}
                        style={{ 
                          width: '45px', 
                          height: '45px', 
                          borderRadius: '50%', 
                          objectFit: 'cover',
                          border: rank <= 3 ? '2px solid gold' : '2px solid rgba(200,200,220,0.3)'
                        }}
                      />
                      {/* Online indicator */}
                      <span style={{
                        position: 'absolute',
                        bottom: '2px',
                        right: '2px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: player.is_online ? '#38ef7d' : '#888',
                        border: '2px solid white',
                        boxShadow: player.is_online ? '0 0 6px #38ef7d' : 'none'
                      }} />
                    </div>
                    <div>
                      <div style={{ 
                        fontWeight: '600', 
                        color: isCurrentUser ? '#667eea' : '#2d3748',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {player.username}
                        {isCurrentUser && <span style={{ 
                          background: '#667eea', 
                          color: 'white', 
                          padding: '2px 6px', 
                          borderRadius: '8px',
                          fontSize: '10px'
                        }}>Bạn</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        {player.total_matches} trận
                      </div>
                    </div>
                  </div>

                  {/* ELO */}
                  <div style={{ 
                    textAlign: 'center', 
                    fontWeight: '700',
                    fontSize: '16px',
                    color: rank === 1 ? '#ffd700' : (rank <= 3 ? '#667eea' : '#2d3748')
                  }}>
                    {player.elo}
                  </div>

                  {/* Wins */}
                  <div style={{ textAlign: 'center', color: '#38ef7d', fontWeight: '600' }}>
                    {player.wins}
                  </div>

                  {/* Losses */}
                  <div style={{ textAlign: 'center', color: '#eb3349', fontWeight: '600' }}>
                    {player.losses}
                  </div>

                  {/* Draws */}
                  <div style={{ textAlign: 'center', color: '#888', fontWeight: '600' }}>
                    {player.draws}
                  </div>

                  {/* Win Rate */}
                  <div style={{ 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#667eea'
                  }}>
                    {getWinRate(player)}
                  </div>
                </div>
              );
            })}

            {players.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                Chưa có dữ liệu xếp hạng
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
