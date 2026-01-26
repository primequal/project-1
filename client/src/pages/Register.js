import React, { useState } from 'react';
import { register } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import '../styles.css';

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
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

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
    <div className="app-background">
      <div className="floating-shapes">
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
      </div>

      <div className="container-center">
        <div className="glass-card" style={{ maxWidth: '450px', width: '100%' }}>
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '60px' }}>📝</span>
          </div>
          
          <h2 className="glass-title">Đăng Ký</h2>
          <p className="glass-subtitle">Tạo tài khoản để bắt đầu chơi Caro!</p>
          
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
                name="username"
                placeholder="Ít nhất 3 ký tự"
                value={formData.username}
                onChange={handleChange}
                className="glass-input"
                disabled={loading}
              />
            </div>

            <div className="mb-md">
              <label className="glass-label">Email</label>
              <input 
                type="email"
                name="email"
                placeholder="example@email.com"
                value={formData.email}
                onChange={handleChange}
                className="glass-input"
                disabled={loading}
              />
            </div>

            <div className="mb-md">
              <label className="glass-label">Mật khẩu</label>
              <input 
                type="password"
                name="password"
                placeholder="Ít nhất 6 ký tự"
                value={formData.password}
                onChange={handleChange}
                className="glass-input"
                disabled={loading}
              />
            </div>

            <div className="mb-md">
              <label className="glass-label">Xác nhận mật khẩu</label>
              <input 
                type="password"
                name="confirmPassword"
                placeholder="Nhập lại mật khẩu"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="glass-input"
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              className="glass-btn glass-btn-success glass-btn-full"
              disabled={loading}
              style={{ marginTop: '10px', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <>
                  <span className="glass-spinner" style={{ width: '20px', height: '20px', margin: '0' }}></span>
                  Đang xử lý...
                </>
              ) : (
                <>✨ Tạo tài khoản</>
              )}
            </button>
          </form>

          <p style={{ marginTop: '25px', color: 'rgba(100,100,130,0.9)' }}>
            Đã có tài khoản?{' '}
            <Link to="/login" className="glass-link">Đăng nhập ngay</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
