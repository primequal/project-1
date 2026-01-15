import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe } from '../api';
import socket from '../socket';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [loading, setLoading] = useState(true);

  // Fetch dữ liệu mới nhất từ server khi component mount
  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        const { data } = await getMe();
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
      } catch (err) {
        console.error('Lỗi khi lấy thông tin user:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserStats();
  }, []);

  const total = user?.total_matches || 0;

  // Hàm tính % an toàn (tránh chia cho 0)
  const getPercent = (value) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : 0;
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px' }}><p>Đang tải thông tin...</p></div>;
  }

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Chào mừng, {user?.username}!</h1>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <div style={statBox}>
          <h3>Elo hiện tại</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#007bff' }}>{user?.elo || 1000}</p>
        </div>

        <div style={statBox}>
          <h3>Tỉ lệ thắng</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: 'green' }}>{getPercent(user?.wins || 0)}%</p>
          <p style={{ fontSize: '14px', color: '#666' }}>Tổng: {total} ván</p>
        </div>

        <div style={statBox}>
          <h3>Chi tiết kết quả</h3>
          <div style={{ textAlign: 'left', display: 'inline-block' }}>
            <p style={{ color: 'green' }}>● Thắng: <strong>{user?.wins || 0}</strong> ({getPercent(user?.wins || 0)}%)</p>
            <p style={{ color: 'red' }}>● Thua: <strong>{user?.losses || 0}</strong> ({getPercent(user?.losses || 0)}%)</p>
            <p style={{ color: 'gray' }}>● Hòa: <strong>{user?.draws || 0}</strong> ({getPercent(user?.draws || 0)}%)</p>
          </div>
        </div>
      </div>
      
      {/* Các nút bấm giữ nguyên như cũ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
        <button onClick={() => navigate('/game/pvp')} style={btnStyle}>Chơi PvP (Ghép cặp)</button>
        <button onClick={() => navigate('/game/pve')} style={btnStyle}>Chơi PvE (Với Máy)</button>
        <button onClick={() => navigate('/game/pvf')} style={btnStyle}>Chơi PvF (Với Bạn bè)</button>
        <button onClick={() => navigate('/history')} style={{ ...btnStyle, backgroundColor: '#6c757d' }}>Xem Lịch Sử & Profile</button>
        
        <button onClick={handleLogout} style={{ ...btnStyle, backgroundColor: '#dc3545', marginTop: '20px' }}>
          🚪 Đăng xuất
        </button>
      </div>
    </div>
  );

  // Hàm xử lý đăng xuất
  function handleLogout() {
    // 1. Emit leave_game để cleanup ở server (nếu đang trong game)
    if (user?.id) {
      socket.emit('leave_game', user.id);
    }
    
    // 2. Xóa dữ liệu localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // 3. Chuyển về trang login
    navigate('/login');
  }
};

const statBox = { border: '1px solid #ddd', padding: '15px', borderRadius: '8px', minWidth: '150px' };
const btnStyle = { padding: '12px 30px', fontSize: '16px', cursor: 'pointer', width: '250px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' };

export default Dashboard;