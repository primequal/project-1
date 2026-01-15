import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, updateAvatar, uploadAvatarFile } from '../api'; // Import hàm mới
import socket from '../socket';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [loading, setLoading] = useState(true);
  
  // State Avatar
  const [showAvatarInput, setShowAvatarInput] = useState(false);
  const [newAvatarUrl, setNewAvatarUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null); // State lưu file

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
  const getPercent = (value) => (total > 0 ? ((value / total) * 100).toFixed(1) : 0);

  // Xử lý đổi bằng URL
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

  // Xử lý đổi bằng File Upload
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

  if (loading) return <div style={{ textAlign: 'center', padding: '20px' }}><p>Đang tải thông tin...</p></div>;

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Chào mừng, {user?.username}!</h1>
      
      {/* --- PHẦN AVATAR --- */}
      <div style={{ marginBottom: '20px' }}>
        <img 
            src={user?.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('/')) ? user.avatar : "https://cdn-icons-png.flaticon.com/512/847/847969.png"} 
            alt="Avatar" 
            style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #007bff' }}
        />
        <br />
        <button onClick={() => setShowAvatarInput(!showAvatarInput)} style={{ marginTop: '10px', cursor: 'pointer', border: 'none', background: 'transparent', color: '#007bff', textDecoration: 'underline' }}>
            {showAvatarInput ? "Hủy" : "Đổi Avatar"}
        </button>
        
        {showAvatarInput && (
            <div style={{ marginTop: '10px', border: '1px solid #ddd', padding: '10px', borderRadius: '5px', display: 'inline-block', backgroundColor: '#f9f9f9' }}>
                {/* Cách 1: Dán Link */}
                <div style={{ marginBottom: '10px' }}>
                    <strong>Cách 1: Dán Link Online</strong><br/>
                    <input 
                        type="text" 
                        placeholder="https://..." 
                        value={newAvatarUrl} 
                        onChange={(e) => setNewAvatarUrl(e.target.value)}
                        style={{ padding: '5px', borderRadius: '5px', border: '1px solid #ccc', width: '200px' }}
                    />
                    <button onClick={handleUpdateAvatarUrl} style={{ marginLeft: '5px', padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Lưu Link</button>
                </div>

                <hr style={{ margin: '10px 0' }}/>

                {/* Cách 2: Upload File */}
                <div>
                    <strong>Cách 2: Tải ảnh lên</strong><br/>
                    <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                        style={{ marginTop: '5px' }}
                    />
                    <br/>
                    <button onClick={handleUpdateAvatarFile} style={{ marginTop: '5px', padding: '5px 10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Upload & Lưu</button>
                </div>
            </div>
        )}
      </div>
      {/* ------------------- */}
      
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
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
        <button onClick={() => navigate('/game/pvp')} style={btnStyle}>Chơi PvP (Ghép cặp)</button>
        <button onClick={() => navigate('/game/pve')} style={btnStyle}>Chơi PvE (Với Máy)</button>
        <button onClick={() => navigate('/game/pvf')} style={btnStyle}>Chơi PvF (Với Bạn bè)</button>
        <button onClick={() => navigate('/history')} style={{ ...btnStyle, backgroundColor: '#6c757d' }}>Xem Lịch Sử & Profile</button>
        
        <button onClick={() => {
            if (user?.id) socket.emit('leave_game', user.id);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/login');
        }} style={{ ...btnStyle, backgroundColor: '#dc3545', marginTop: '20px' }}>
          🚪 Đăng xuất
        </button>
      </div>
    </div>
  );
};

const statBox = { border: '1px solid #ddd', padding: '15px', borderRadius: '8px', minWidth: '150px' };
const btnStyle = { padding: '12px 30px', fontSize: '16px', cursor: 'pointer', width: '250px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' };

export default Dashboard;