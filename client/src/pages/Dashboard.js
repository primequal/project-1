import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, updateAvatar, uploadAvatarFile, getEloHistory, changePassword } from '../api';
import socket from '../socket';
import '../styles.css';
import NotificationBell from '../components/NotificationBell';
import FriendsPanel from '../components/FriendsPanel';

// Simple Line Chart Component (no external library needed)
const EloLineChart = ({ data, period }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
        Chưa có dữ liệu ELO trong khoảng thời gian này
      </div>
    );
  }

  const values = data.map(d => d.elo);
  const minElo = Math.min(...values) - 20;
  const maxElo = Math.max(...values) + 20;
  const range = maxElo - minElo || 1;
  
  const width = 600;
  const height = 250;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.elo - minElo) / range) * chartHeight;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  // Area fill
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

  // Y-axis labels
  const yLabels = [];
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const value = Math.round(minElo + (range / steps) * i);
    const y = padding.top + chartHeight - (i / steps) * chartHeight;
    yLabels.push({ value, y });
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
        {/* Background grid */}
        {yLabels.map((label, i) => (
          <g key={i}>
            <line 
              x1={padding.left} 
              y1={label.y} 
              x2={width - padding.right} 
              y2={label.y} 
              stroke="rgba(102, 126, 234, 0.1)" 
              strokeDasharray="5,5"
            />
            <text 
              x={padding.left - 10} 
              y={label.y + 4} 
              fill="#666" 
              fontSize="12" 
              textAnchor="end"
            >
              {label.value}
            </text>
          </g>
        ))}
        
        {/* Area fill */}
        <path d={areaD} fill="url(#gradient)" opacity="0.3" />
        
        {/* Line */}
        <path d={pathD} fill="none" stroke="#667eea" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="6" fill="#667eea" stroke="#fff" strokeWidth="2" />
            {/* X-axis labels - show every nth label based on data length */}
            {(data.length <= 7 || i % Math.ceil(data.length / 7) === 0) && (
              <text 
                x={p.x} 
                y={height - 10} 
                fill="#666" 
                fontSize="10" 
                textAnchor="middle"
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#667eea" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#667eea" stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [loading, setLoading] = useState(true);
  
  const [showAvatarInput, setShowAvatarInput] = useState(false);
  const [newAvatarUrl, setNewAvatarUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  
  // ELO Chart states
  const [eloHistory, setEloHistory] = useState([]);
  const [eloPeriod, setEloPeriod] = useState('month');
  const [loadingElo, setLoadingElo] = useState(false);

  // Change Password states
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const fetchEloHistory = async (period) => {
    setLoadingElo(true);
    try {
      const { data } = await getEloHistory(period);
      setEloHistory(data);
    } catch (err) {
      console.error('Lỗi khi lấy lịch sử ELO:', err);
    } finally {
      setLoadingElo(false);
    }
  };

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
    fetchEloHistory(eloPeriod);
    
    // Set user online status
    if (user?.id) {
      socket.emit('user_online', { userId: user.id });
    }
  }, []);
  
  useEffect(() => {
    fetchEloHistory(eloPeriod);
  }, [eloPeriod]);

  const total = user?.total_matches || 0;
  const getPercent = (value) => (total > 0 ? ((value / total) * 100).toFixed(1) : 0);

  const handleUpdateAvatarUrl = async () => {
    if (!newAvatarUrl.trim()) return;
    try {
        await updateAvatar(newAvatarUrl);
        const updatedUser = { ...user, avatar: newAvatarUrl };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setShowAvatarInput(false);
        setNewAvatarUrl("");
        alert("Đổi avatar bằng Link thành công!");
    } catch (err) {
        alert("Lỗi đổi avatar");
    }
  };

  const handleUpdateAvatarFile = async () => {
    if (!selectedFile) return alert("Vui lòng chọn file ảnh!");
    
    const formData = new FormData();
    formData.append('avatar', selectedFile);

    try {
        const { data } = await uploadAvatarFile(formData);
        const updatedUser = { ...user, avatar: data.avatar };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setShowAvatarInput(false);
        setSelectedFile(null);
        alert("Upload ảnh thành công!");
    } catch (err) {
        console.error(err);
        alert("Lỗi upload ảnh");
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp');
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowChangePassword(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (err) {
      setPasswordError(err.response?.data?.msg || 'Lỗi đổi mật khẩu');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    if (user?.id) socket.emit('leave_game', user.id);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="app-background">
        <div className="container-center">
          <div className="glass-card text-center">
            <div className="glass-spinner"></div>
            <p className="text-dark mt-md">Đang tải thông tin...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-background">
      <div className="floating-shapes">
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
      </div>

      {/* Top Right Corner - Notifications & Friends */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        display: 'flex',
        gap: '15px',
        zIndex: 1000
      }}>
        <FriendsPanel />
        <NotificationBell />
      </div>

      <div className="container-center" style={{ padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: '900px', position: 'relative', zIndex: 1 }}>
          
          {/* Header Card */}
          <div className="glass-card text-center mb-lg">
            <img 
              src={user?.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('/')) 
                ? user.avatar 
                : "https://cdn-icons-png.flaticon.com/512/847/847969.png"} 
              alt="Avatar" 
              className="glass-avatar"
            />
            
            <h1 className="glass-title mt-md">
              Chào mừng, {user?.username}! 👋
            </h1>
            
            <button 
              onClick={() => setShowAvatarInput(!showAvatarInput)} 
              className="glass-btn glass-btn-outline"
              style={{ marginTop: '15px', marginRight: '10px' }}
            >
              {showAvatarInput ? "❌ Hủy" : "📷 Đổi Avatar"}
            </button>
            
            <button 
              onClick={() => setShowChangePassword(!showChangePassword)} 
              className="glass-btn glass-btn-outline"
              style={{ marginTop: '15px' }}
            >
              {showChangePassword ? "❌ Hủy" : "🔑 Đổi Mật Khẩu"}
            </button>
            
            {showAvatarInput && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
                <div className="glass-card glass-card-sm glass-card-dark" style={{ maxWidth: '400px', width: '100%' }}>
                  <div className="mb-md">
                    <p className="text-dark mb-sm" style={{ fontWeight: '600' }}>🔗 Cách 1: Dán Link Online</p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="text" 
                        placeholder="https://..." 
                        value={newAvatarUrl} 
                        onChange={(e) => setNewAvatarUrl(e.target.value)}
                        className="glass-input"
                        style={{ flex: 1 }}
                      />
                      <button onClick={handleUpdateAvatarUrl} className="glass-btn glass-btn-success">
                        Lưu
                      </button>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid rgba(100,100,150,0.2)', margin: '15px 0' }}/>

                  <div>
                    <p className="text-dark mb-sm" style={{ fontWeight: '600' }}>📁 Cách 2: Tải ảnh lên</p>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      style={{ color: '#333', marginBottom: '10px' }}
                    />
                    <br/>
                    <button onClick={handleUpdateAvatarFile} className="glass-btn glass-btn-info">
                      Upload & Lưu
                    </button>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowAvatarInput(false)} 
                  className="glass-btn glass-btn-danger"
                  style={{ marginTop: '15px' }}
                >
                  ❌ Hủy thay đổi
                </button>
              </div>
            )}

            {showChangePassword && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
                <div className="glass-card glass-card-sm glass-card-dark" style={{ maxWidth: '400px', width: '100%' }}>
                  <h4 className="text-dark mb-md" style={{ textAlign: 'center' }}>🔑 Đổi Mật Khẩu</h4>
                  
                  {passwordError && (
                    <div style={{ 
                      background: 'rgba(229, 62, 62, 0.15)', 
                      color: '#e53e3e', 
                      padding: '10px', 
                      borderRadius: '8px', 
                      marginBottom: '15px',
                      textAlign: 'center'
                    }}>
                      {passwordError}
                    </div>
                  )}
                  
                  {passwordSuccess && (
                    <div style={{ 
                      background: 'rgba(56, 161, 105, 0.15)', 
                      color: '#38a169', 
                      padding: '10px', 
                      borderRadius: '8px', 
                      marginBottom: '15px',
                      textAlign: 'center'
                    }}>
                      {passwordSuccess}
                    </div>
                  )}
                  
                  <div className="mb-md">
                    <label className="text-dark mb-sm" style={{ display: 'block', fontWeight: '500' }}>
                      Mật khẩu hiện tại
                    </label>
                    <input 
                      type="password" 
                      placeholder="Nhập mật khẩu hiện tại" 
                      value={currentPassword} 
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="glass-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  
                  <div className="mb-md">
                    <label className="text-dark mb-sm" style={{ display: 'block', fontWeight: '500' }}>
                      Mật khẩu mới
                    </label>
                    <input 
                      type="password" 
                      placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="glass-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  
                  <div className="mb-md">
                    <label className="text-dark mb-sm" style={{ display: 'block', fontWeight: '500' }}>
                      Xác nhận mật khẩu mới
                    </label>
                    <input 
                      type="password" 
                      placeholder="Nhập lại mật khẩu mới" 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="glass-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  
                  <button 
                    onClick={handleChangePassword} 
                    className="glass-btn glass-btn-success"
                    style={{ width: '100%' }}
                    disabled={changingPassword}
                  >
                    {changingPassword ? '⏳ Đang xử lý...' : '✅ Xác nhận đổi mật khẩu'}
                  </button>
                </div>
                
                <button 
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordError('');
                    setPasswordSuccess('');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }} 
                  className="glass-btn glass-btn-danger"
                  style={{ marginTop: '15px' }}
                >
                  ❌ Hủy
                </button>
              </div>
            )}
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <div className="glass-stat-box">
              <h3>🏆 Elo hiện tại</h3>
              <p className="glass-stat-value" style={{ color: '#ffd700' }}>{user?.elo || 1000}</p>
            </div>

            <div className="glass-stat-box">
              <h3>📊 Tỉ lệ thắng</h3>
              <p className="glass-stat-value" style={{ color: '#38ef7d' }}>{getPercent(user?.wins || 0)}%</p>
              <p className="glass-stat-label">Tổng: {total} ván</p>
            </div>

            <div className="glass-stat-box" style={{ minWidth: '220px' }}>
              <h3>📈 Chi tiết kết quả</h3>
              <div style={{ textAlign: 'left', marginTop: '10px' }}>
                <p style={{ color: '#38ef7d', margin: '5px 0' }}>
                  ✅ Thắng: <strong>{user?.wins || 0}</strong> ({getPercent(user?.wins || 0)}%)
                </p>
                <p style={{ color: '#ff5252', margin: '5px 0' }}>
                  ❌ Thua: <strong>{user?.losses || 0}</strong> ({getPercent(user?.losses || 0)}%)
                </p>
                <p style={{ color: '#888', margin: '5px 0' }}>
                  🤝 Hòa: <strong>{user?.draws || 0}</strong> ({getPercent(user?.draws || 0)}%)
                </p>
              </div>
            </div>
          </div>

          {/* ELO History Chart */}
          <div className="glass-chart-container mb-lg">
            <h3 className="glass-chart-title">📊 Biến động ELO</h3>
            
            <div className="glass-chart-tabs">
              <button 
                className={`glass-chart-tab ${eloPeriod === 'week' ? 'active' : ''}`}
                onClick={() => setEloPeriod('week')}
              >
                Tuần
              </button>
              <button 
                className={`glass-chart-tab ${eloPeriod === 'month' ? 'active' : ''}`}
                onClick={() => setEloPeriod('month')}
              >
                Tháng
              </button>
              <button 
                className={`glass-chart-tab ${eloPeriod === 'year' ? 'active' : ''}`}
                onClick={() => setEloPeriod('year')}
              >
                Năm
              </button>
            </div>
            
            {loadingElo ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="glass-spinner"></div>
              </div>
            ) : (
              <EloLineChart data={eloHistory} period={eloPeriod} />
            )}
          </div>

          {/* Game Mode Buttons */}
          <div className="glass-card text-center">
            <h3 className="text-dark mb-lg" style={{ fontSize: '1.5rem' }}>🎮 Chọn chế độ chơi</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
              <button 
                onClick={() => navigate('/game/pvp')} 
                className="glass-btn glass-btn-primary"
                style={{ width: '280px' }}
              >
                ⚔️ Chơi PvP (Ghép cặp)
              </button>
              
              <button 
                onClick={() => navigate('/game/pve')} 
                className="glass-btn glass-btn-info"
                style={{ width: '280px' }}
              >
                🤖 Chơi PvE (Với Máy)
              </button>
              
              <button 
                onClick={() => navigate('/game/pvf')} 
                className="glass-btn glass-btn-success"
                style={{ width: '280px' }}
              >
                👥 Chơi PvF (Với Bạn bè)
              </button>
              
              <button 
                onClick={() => navigate('/history')} 
                className="glass-btn glass-btn-secondary"
                style={{ width: '280px' }}
              >
                📜 Xem Lịch Sử & Profile
              </button>
              
              <button 
                onClick={() => navigate('/leaderboard')} 
                className="glass-btn"
                style={{ 
                  width: '280px',
                  background: 'linear-gradient(135deg, #ffd700 0%, #ff9500 100%)',
                  color: '#333'
                }}
              >
                🏆 Bảng Xếp Hạng
              </button>
              
              <button 
                onClick={handleLogout} 
                className="glass-btn glass-btn-danger"
                style={{ width: '280px', marginTop: '15px' }}
              >
                🔓 Đăng xuất
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;