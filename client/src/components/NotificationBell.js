import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api';
import socket from '../socket';
import { useSound } from '../hooks/useSound';

const NotificationBell = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const dropdownRef = useRef(null);
  const prevUnreadCountRef = useRef(0);
  const { playNotificationSound } = useSound();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Play sound when new notifications arrive
  useEffect(() => {
    if (unreadCount > prevUnreadCountRef.current) {
      playNotificationSound();
    }
    prevUnreadCountRef.current = unreadCount;
  }, [unreadCount, playNotificationSound]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Lỗi lấy thông báo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen for real-time game invites
  useEffect(() => {
    const handleGameInvite = (data) => {
      // Refresh notifications to show the new invite
      fetchNotifications();
    };
    
    socket.on('game_invite_received', handleGameInvite);
    return () => socket.off('game_invite_received', handleGameInvite);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (notifId) => {
    try {
      await markNotificationRead(notifId);
      setNotifications(prev => 
        prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error('Lỗi đánh dấu đã đọc:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    await handleMarkAsRead(notif.id);
    
    // If it's a game invite, save roomId and navigate to PvF page
    if (notif.type === 'game_invite' && notif.data?.roomId) {
      // Store the room info for Game.js to use (timeControl is always 60 for invites)
      sessionStorage.setItem('pvf_join_room', notif.data.roomId);
      setShowDropdown(false);
      navigate('/game/pvf');
    }
  };

  const handleCopyRoomId = (e, roomId) => {
    e.stopPropagation(); // Prevent triggering the notification click
    navigator.clipboard.writeText(roomId);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleJoinRoom = (e, notif) => {
    e.stopPropagation();
    handleMarkAsRead(notif.id);
    // Store the room info for Game.js to use (timeControl is always 60 for invites)
    sessionStorage.setItem('pvf_join_room', notif.data.roomId);
    setShowDropdown(false);
    navigate('/game/pvf');
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Lỗi đánh dấu tất cả:', err);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'elo_change': return '📊';
      case 'friend_request': return '📨';
      case 'friend_accepted': return '🎉';
      case 'game_invite': return '🎮';
      default: return '🔔';
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setShowDropdown(!showDropdown);
          if (!showDropdown) fetchNotifications();
        }}
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          border: '1px solid rgba(200, 200, 220, 0.5)',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '22px',
          position: 'relative',
          boxShadow: '0 4px 15px rgba(100, 100, 150, 0.15)',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: 'linear-gradient(135deg, #eb3349, #f45c43)',
            color: 'white',
            borderRadius: '50%',
            width: '22px',
            height: '22px',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid white'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '55px',
          right: '0',
          width: '360px',
          maxHeight: '450px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(15px)',
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(100, 100, 150, 0.25)',
          border: '1px solid rgba(200, 200, 220, 0.5)',
          overflow: 'hidden',
          zIndex: 1000
        }}>
          {/* Header */}
          <div style={{
            padding: '15px 20px',
            background: 'linear-gradient(135deg, #1877f2, #0d65d9)',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: '600', fontSize: '16px' }}>🔔 Thông báo</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '5px 10px',
                  borderRadius: '15px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Đọc tất cả
              </button>
            )}
          </div>

          {/* Notification List */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#666' }}>
                Đang tải...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
                Chưa có thông báo nào
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    padding: '15px 20px',
                    borderBottom: '1px solid rgba(200, 200, 220, 0.3)',
                    background: notif.is_read ? 'transparent' : 'rgba(24, 119, 242, 0.08)',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(24, 119, 242, 0.12)'}
                  onMouseOut={(e) => e.currentTarget.style.background = notif.is_read ? 'transparent' : 'rgba(24, 119, 242, 0.08)'}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '24px' }}>{getNotificationIcon(notif.type)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: notif.is_read ? '400' : '600', 
                        color: '#2d3748',
                        marginBottom: '4px'
                      }}>
                        {notif.title}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>
                        {notif.content}
                      </div>
                      
                      {/* Game Invite Actions - Room ID + Copy + Join buttons */}
                      {notif.type === 'game_invite' && notif.data?.roomId && (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          marginTop: '8px',
                          flexWrap: 'wrap'
                        }}>
                          <span style={{
                            background: 'rgba(24, 119, 242, 0.15)',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: '#1877f2',
                            fontWeight: '600',
                            fontFamily: 'monospace'
                          }}>
                            ID: {notif.data.roomId}
                          </span>
                          <button
                            onClick={(e) => handleCopyRoomId(e, notif.data.roomId)}
                            style={{
                              background: copiedId === notif.data.roomId 
                                ? 'linear-gradient(135deg, #42b72a, #36a420)' 
                                : 'rgba(24, 119, 242, 0.2)',
                              border: 'none',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              color: copiedId === notif.data.roomId ? 'white' : '#1877f2',
                              fontWeight: '500'
                            }}
                          >
                            {copiedId === notif.data.roomId ? '✓ Đã copy' : '📋 Copy ID'}
                          </button>
                          <button
                            onClick={(e) => handleJoinRoom(e, notif)}
                            style={{
                              background: 'linear-gradient(135deg, #1877f2, #0d65d9)',
                              border: 'none',
                              padding: '4px 12px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              color: 'white',
                              fontWeight: '500'
                            }}
                          >
                            Tham gia
                          </button>
                        </div>
                      )}
                      
                      <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
                        {formatTime(notif.created_at)}
                      </div>
                    </div>
                    {!notif.is_read && (
                      <span style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: '#1877f2',
                        flexShrink: 0
                      }}></span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
