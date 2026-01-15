import React, { useState } from 'react';
import { register } from '../api';
import { useNavigate, Link } from 'react-router-dom';

const Register = () => {
  const [formData, setFormData] = useState({ 
    username: '', 
    email: '', 
    password: '', 
    confirmPassword: '' 
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(''); // Xóa lỗi khi user sửa input
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate phía client
    if (!formData.username.trim()) {
      return setError('Vui lòng nhập tên tài khoản');
    }
    if (formData.username.length < 3) {
      return setError('Tên tài khoản phải có ít nhất 3 ký tự');
    }
    if (!formData.email.trim()) {
      return setError('Vui lòng nhập email');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return setError('Email không hợp lệ');
    }
    if (formData.password.length < 6) {
      return setError('Mật khẩu phải có ít nhất 6 ký tự');
    }
    if (formData.password !== formData.confirmPassword) {
      return setError('Mật khẩu xác nhận không khớp');
    }

    setLoading(true);
    try {
      const { data } = await register({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password
      });
      
      alert(data.msg || 'Đăng ký thành công! Vui lòng đăng nhập.');
      navigate('/login');
    } catch (err) {
      const errorMsg = err.response?.data?.msg || err.response?.data?.error || 'Đăng ký thất bại!';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={formContainerStyle}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>🎮 Đăng Ký Tài Khoản Caro</h2>
        
        {error && <div style={errorStyle}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Tên tài khoản</label>
            <input 
              type="text"
              name="username"
              placeholder="Nhập tên tài khoản (ít nhất 3 ký tự)"
              value={formData.username}
              onChange={handleChange}
              style={inputStyle}
              disabled={loading}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Email</label>
            <input 
              type="email"
              name="email"
              placeholder="Nhập email của bạn"
              value={formData.email}
              onChange={handleChange}
              style={inputStyle}
              disabled={loading}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Mật khẩu</label>
            <input 
              type="password"
              name="password"
              placeholder="Nhập mật khẩu (ít nhất 6 ký tự)"
              value={formData.password}
              onChange={handleChange}
              style={inputStyle}
              disabled={loading}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Xác nhận mật khẩu</label>
            <input 
              type="password"
              name="confirmPassword"
              placeholder="Nhập lại mật khẩu"
              value={formData.confirmPassword}
              onChange={handleChange}
              style={inputStyle}
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            style={{ ...buttonStyle, opacity: loading ? 0.7 : 1 }}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : '📝 Đăng ký'}
          </button>
        </form>

        <p style={{ marginTop: '20px', color: '#666' }}>
          Đã có tài khoản?{' '}
          <Link to="/login" style={linkStyle}>Đăng nhập ngay</Link>
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
  marginBottom: '15px',
  textAlign: 'left'
};

const labelStyle = {
  display: 'block',
  marginBottom: '5px',
  fontWeight: 'bold',
  color: '#555'
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
  backgroundColor: '#28a745',
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
  color: '#007bff',
  textDecoration: 'none',
  fontWeight: 'bold'
};

export default Register;
