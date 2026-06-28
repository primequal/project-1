import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Game from './pages/Game';
// client/src/App.js
import History from './pages/History';
import Replay from './pages/Replay';
import Leaderboard from './pages/Leaderboard';
import soundManager from './hooks/useSound';

function App() {
  // Dùng state để lưu token, khởi tạo bằng giá trị trong localStorage
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Hàm này để cập nhật token từ các trang con (như Login)
  const updateAuth = () => {
    setToken(localStorage.getItem('token'));
  };

  // Global button click sound effect
  useEffect(() => {
    const handleClick = (e) => {
      // Check if clicked element is a button or has button-like behavior
      const target = e.target;
      const isButton = target.tagName === 'BUTTON' || 
                       target.classList.contains('glass-btn') ||
                       target.closest('button') ||
                       target.closest('.glass-btn');
      
      if (isButton) {
        soundManager.playClickSound();
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <Router basename={process.env.PUBLIC_URL}>
      <Routes>
        {/* Truyền hàm updateAuth vào trang Login */}
        <Route path="/login" element={<Login updateAuth={updateAuth} />} />
        <Route path="/register" element={<Register />} />
        
        <Route 
          path="/dashboard" 
          element={token ? <Dashboard /> : <Navigate to="/login" />} 
        />
        
        <Route 
          path="/game/:type" 
          element={token ? <Game /> : <Navigate to="/login" />} 
        />

        {/* Trong phần <Routes> */}
        <Route 
          path="/history" 
          element={token ? <History /> : <Navigate to="/login" />} 
        />

        <Route 
          path="/replay/:id" 
          element={token ? <Replay /> : <Navigate to="/login" />} 
        />

        <Route 
          path="/leaderboard" 
          element={token ? <Leaderboard /> : <Navigate to="/login" />} 
        />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
