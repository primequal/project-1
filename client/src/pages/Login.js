import React, { useState } from 'react';
import { login } from '../api';
import { useNavigate, Link } from 'react-router-dom';

const Login = ({ updateAuth }) => { // Nhận hàm updateAuth từ props
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

      // QUAN TRỌNG: Cập nhật state ở App.js trước khi chuyển hướng
      updateAuth();

      // CHUYỂN HƯỚNG SANG DASHBOARD
      navigate('/dashboard');
    } catch (err) {
      const errorMsg = err.response?.data?.msg || 'Lỗi đăng nhập!';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={formContainerStyle}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>🎮 Đăng Nhập Caro</h2>
        
        {error && <div style={errorStyle}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div style={inputGroupStyle}>
            <input 
              type="text"
              placeholder="Tên tài khoản" 
              value={formData.username}
              onChange={(e) => {
                setFormData({...formData, username: e.target.value});
                setError('');
              }}
              style={inputStyle}
              disabled={loading}
            />
          </div>
          
          <div style={inputGroupStyle}>
            <input 
              type="password" 
              placeholder="Mật khẩu" 
              value={formData.password}
              onChange={(e) => {
                setFormData({...formData, password: e.target.value});
                setError('');
              }}
              style={inputStyle}
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit" 
            style={{ ...buttonStyle, opacity: loading ? 0.7 : 1 }}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : '🔑 Đăng nhập'}
          </button>
        </form>

        <p style={{ marginTop: '20px', color: '#666' }}>
          Chưa có tài khoản?{' '}
          <Link to="/register" style={linkStyle}>Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  );
};

// Styles
const containerStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: '#f5f5f5'
};

const formContainerStyle = {
  backgroundColor: 'white',
  padding: '40px',
  borderRadius: '10px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  width: '100%',
  maxWidth: '400px',
  textAlign: 'center'
};

const inputGroupStyle = {
  marginBottom: '15px'
};

const inputStyle = {
  width: '100%',
  padding: '12px',
  fontSize: '14px',
  border: '1px solid #ddd',
  borderRadius: '5px',
  boxSizing: 'border-box'
};

const buttonStyle = {
  width: '100%',
  padding: '14px',
  fontSize: '16px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  marginTop: '10px'
};

const errorStyle = {
  backgroundColor: '#f8d7da',
  color: '#721c24',
  padding: '10px',
  borderRadius: '5px',
  marginBottom: '15px'
};

const linkStyle = {
  color: '#28a745',
  textDecoration: 'none',
  fontWeight: 'bold'
};

export default Login;