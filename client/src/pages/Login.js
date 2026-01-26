import React, { useState } from 'react';
import { login } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import '../styles.css';

const Login = ({ updateAuth }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const { data } = await login(formData);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      updateAuth();
      navigate('/dashboard');
    } catch (err) {
      const errorMsg = err.response?.data?.msg || 'Lỗi đăng nhập!';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-background">
      <div className="floating-shapes">
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
      </div>

      <div className="container-center">
        <div className="glass-card" style={{ maxWidth: '420px', width: '100%' }}>
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '60px' }}>🎮</span>
          </div>
          
          <h2 className="glass-title">Đăng Nhập</h2>
          <p className="glass-subtitle">Chào mừng trở lại với Caro Game!</p>
          
          {error && (
            <div className="glass-alert glass-alert-error">
              ⚠️ {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-md">
              <label className="glass-label">Tên tài khoản</label>
              <input 
                type="text"
                placeholder="Nhập tên tài khoản" 
                value={formData.username}
                onChange={(e) => {
                  setFormData({...formData, username: e.target.value});
                  setError('');
                }}
                className="glass-input"
                disabled={loading}
              />
            </div>
            
            <div className="mb-md">
              <label className="glass-label">Mật khẩu</label>
              <input 
                type="password" 
                placeholder="Nhập mật khẩu" 
                value={formData.password}
                onChange={(e) => {
                  setFormData({...formData, password: e.target.value});
                  setError('');
                }}
                className="glass-input"
                disabled={loading}
              />
            </div>
            
            <button 
              type="submit" 
              className="glass-btn glass-btn-primary glass-btn-full"
              disabled={loading}
              style={{ marginTop: '10px', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <>
                  <span className="glass-spinner" style={{ width: '20px', height: '20px', margin: '0' }}></span>
                  Đang xử lý...
                </>
              ) : (
                <>🔑 Đăng nhập</>
              )}
            </button>
          </form>

          <p style={{ marginTop: '25px', color: 'rgba(100,100,130,0.9)' }}>
            Chưa có tài khoản?{' '}
            <Link to="/register" className="glass-link">Đăng ký ngay</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;