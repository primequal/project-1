import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  searchUsers, 
  sendFriendRequest,
  undoFriendRequest,
  getFriendRequests, 
  acceptFriendRequest, 
  rejectFriendRequest,
  getFriends,
  removeFriend 
} from '../api';
import socket from '../socket';

const FriendsPanel = () => {
  const navigate = useNavigate();
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'requests', 'search'
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const panelRef = useRef(null);

  const fetchFriends = async () => {
    try {
      const { data } = await getFriends();
      setFriends(data);
      // Update online status from friends data
      const onlineSet = new Set();
      data.forEach(f => {
        if (f.is_online) onlineSet.add(f.id);
      });
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        data.forEach(f => {
          if (f.is_online) newSet.add(f.id);
          else newSet.delete(f.id);
        });
        return newSet;
      });
    } catch (err) {
      console.error('Lỗi lấy bạn bè:', err);
    }
  };

  const fetchRequests = async () => {
    try {
      const { data } = await getFriendRequests();
      setRequests(data);
    } catch (err) {
      console.error('Lỗi lấy lời mời:', err);
    }
  };

  useEffect(() => {
    if (showPanel) {
      fetchFriends();
      fetchRequests();
    }
  }, [showPanel]);

  // Listen for online status changes
  useEffect(() => {
    const handleStatusChange = ({ userId, isOnline }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        if (isOnline) newSet.add(userId);
        else newSet.delete(userId);
        return newSet;
      });
      // Also update friends list
      setFriends(prev => prev.map(f => 
        f.id === userId ? { ...f, is_online: isOnline } : f
      ));
    };
    
    socket.on('user_status_change', handleStatusChange);
    return () => socket.off('user_status_change', handleStatusChange);
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setShowPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) {
      setMessage('Nhập ít nhất 2 ký tự để tìm kiếm');
      return;
    }
    
    setLoading(true);
    setMessage('');
    try {
      const { data } = await searchUsers(searchQuery);
      setSearchResults(data);
      if (data.length === 0) {
        setMessage('Không tìm thấy người chơi nào');
      }
    } catch (err) {
      setMessage('Lỗi tìm kiếm');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (toUserId) => {
    try {
      await sendFriendRequest(toUserId);
      setSearchResults(prev => 
        prev.map(u => u.id === toUserId ? { ...u, friendStatus: 'request_sent' } : u)
      );
      setMessage('Đã gửi lời mời kết bạn!');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Lỗi gửi lời mời');
    }
  };

  const handleUndoRequest = async (toUserId) => {
    try {
      await undoFriendRequest(toUserId);
      setSearchResults(prev => 
        prev.map(u => u.id === toUserId ? { ...u, friendStatus: 'none' } : u)
      );
      setMessage('Đã hủy lời mời kết bạn');
    } catch (err) {
      // Edge case: request đã được accept, người này đã là bạn
      if (err.response?.data?.alreadyFriends) {
        setSearchResults(prev => 
          prev.map(u => u.id === toUserId ? { ...u, friendStatus: 'friend' } : u)
        );
        fetchFriends(); // Refresh friends list
        setMessage('Người này đã là bạn bè của bạn rồi!');
      } else {
        setMessage(err.response?.data?.error || 'Lỗi hủy lời mời');
      }
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await acceptFriendRequest(requestId);
      fetchRequests();
      fetchFriends();
      setMessage('Đã chấp nhận lời mời!');
    } catch (err) {
      setMessage('Lỗi chấp nhận lời mời');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await rejectFriendRequest(requestId);
      fetchRequests();
      setMessage('Đã từ chối lời mời');
    } catch (err) {
      setMessage('Lỗi từ chối lời mời');
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Bạn có chắc muốn xóa bạn bè này?')) return;
    try {
      await removeFriend(friendId);
      fetchFriends();
      setMessage('Đã xóa bạn bè');
    } catch (err) {
      setMessage('Lỗi xóa bạn bè');
    }
  };

  const handleInviteFriend = (friend) => {
    // Create a room first, then invite
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Emit create room with default time control of 60 seconds
    socket.emit('create_pvf', { user, isRated: true, timeControl: 60 });
    
    // Listen for room created, then invite and redirect
    const onRoomCreated = (data) => {
      const roomId = data.roomId;
      // Send invite to friend
      socket.emit('invite_to_pvf', { 
        fromUser: user, 
        toUserId: friend.id, 
        roomId 
      });
      
      // Store the created room info in sessionStorage so Game.js can use it
      sessionStorage.setItem('pvf_invited_room', JSON.stringify({
        roomId: roomId,
        invitedFriend: friend.username
      }));
      
      // Close panel and show message
      setShowPanel(false);
      
      // Navigate to game page - Game.js will detect the room was already created
      navigate('/game/pvf');
      
      socket.off('pvf_created', onRoomCreated);
    };
    
    socket.once('pvf_created', onRoomCreated);
  };

  // Online status indicator component
  const OnlineIndicator = ({ isOnline }) => (
    <span style={{
      display: 'inline-block',
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      background: isOnline ? '#42b72a' : '#888',
      marginRight: '6px',
      boxShadow: isOnline ? '0 0 6px #42b72a' : 'none'
    }} title={isOnline ? 'Đang online' : 'Offline'} />
  );

  const getStatusButton = (user) => {
    switch (user.friendStatus) {
      case 'friend':
        return <span style={{ color: '#42b72a', fontSize: '12px' }}>✅ Bạn bè</span>;
      case 'request_sent':
        return (
          <button
            onClick={() => handleUndoRequest(user.id)}
            style={{
              background: 'linear-gradient(135deg, #718096, #4a5568)',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '15px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            ↩ Hủy gửi
          </button>
        );
      case 'request_received':
        return <span style={{ color: '#ffd700', fontSize: '12px' }}>📥 Chờ phản hồi</span>;
      default:
        return (
          <button
            onClick={() => handleSendRequest(user.id)}
            style={{
              background: 'linear-gradient(135deg, #1877f2, #0d65d9)',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '15px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            ➕ Kết bạn
          </button>
        );
    }
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Friends Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
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
        👥
        {requests.length > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: 'linear-gradient(135deg, #42b72a, #36a420)',
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
            {requests.length > 9 ? '9+' : requests.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {showPanel && (
        <div style={{
          position: 'absolute',
          top: '55px',
          right: '0',
          width: '380px',
          maxHeight: '500px',
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
            background: 'linear-gradient(135deg, #42b72a, #36a420)',
            color: 'white'
          }}>
            <span style={{ fontWeight: '600', fontSize: '16px' }}>👥 Bạn bè</span>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid rgba(200, 200, 220, 0.3)'
          }}>
            {[
              { key: 'friends', label: `Bạn bè (${friends.length})` },
              { key: 'requests', label: `Lời mời (${requests.length})` },
              { key: 'search', label: '🔍 Tìm kiếm' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setMessage(''); }}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  background: activeTab === tab.key ? 'rgba(24, 119, 242, 0.1)' : 'transparent',
                  color: activeTab === tab.key ? '#1877f2' : '#666',
                  fontWeight: activeTab === tab.key ? '600' : '400',
                  cursor: 'pointer',
                  fontSize: '13px',
                  borderBottom: activeTab === tab.key ? '2px solid #1877f2' : '2px solid transparent'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Message */}
          {message && (
            <div style={{
              padding: '10px 15px',
              background: 'rgba(24, 119, 242, 0.1)',
              color: '#1877f2',
              fontSize: '13px',
              textAlign: 'center'
            }}>
              {message}
            </div>
          )}

          {/* Content */}
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {/* Friends List */}
            {activeTab === 'friends' && (
              friends.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888' }}>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>👋</div>
                  Chưa có bạn bè nào<br/>
                  <small>Hãy tìm kiếm và kết bạn!</small>
                </div>
              ) : (
                friends.map(friend => (
                  <div key={friend.id} style={{
                    padding: '12px 15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    borderBottom: '1px solid rgba(200, 200, 220, 0.2)'
                  }}>
                    <div style={{ position: 'relative' }}>
                      <img
                        src={friend.avatar?.startsWith('http') || friend.avatar?.startsWith('/') 
                          ? friend.avatar 
                          : "https://cdn-icons-png.flaticon.com/512/847/847969.png"}
                        alt={friend.username}
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      {/* Online indicator on avatar */}
                      <span style={{
                        position: 'absolute',
                        bottom: '0',
                        right: '0',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: friend.is_online || onlineUsers.has(friend.id) ? '#42b72a' : '#888',
                        border: '2px solid white',
                        boxShadow: friend.is_online || onlineUsers.has(friend.id) ? '0 0 6px #42b72a' : 'none'
                      }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#2d3748' }}>
                        {friend.username}
                      </div>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        ELO: {friend.elo} • {friend.is_online || onlineUsers.has(friend.id) ? <span style={{ color: '#42b72a' }}>Online</span> : 'Offline'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {/* Invite button - only show if online */}
                      {(friend.is_online || onlineUsers.has(friend.id)) && (
                        <button
                          onClick={() => handleInviteFriend(friend)}
                          title="Mời chơi"
                          style={{
                            background: 'linear-gradient(135deg, #1877f2, #0d65d9)',
                            color: 'white',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          🎮
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveFriend(friend.id)}
                        style={{
                          background: 'rgba(235, 51, 73, 0.1)',
                          color: '#eb3349',
                          border: 'none',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {/* Requests List */}
            {activeTab === 'requests' && (
              requests.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888' }}>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
                  Không có lời mời kết bạn
                </div>
              ) : (
                requests.map(req => (
                  <div key={req.id} style={{
                    padding: '12px 15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    borderBottom: '1px solid rgba(200, 200, 220, 0.2)'
                  }}>
                    <img
                      src={req.avatar?.startsWith('http') || req.avatar?.startsWith('/') 
                        ? req.avatar 
                        : "https://cdn-icons-png.flaticon.com/512/847/847969.png"}
                      alt={req.username}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#2d3748' }}>{req.username}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>ELO: {req.elo}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleAcceptRequest(req.id)}
                        style={{
                          background: 'linear-gradient(135deg, #42b72a, #36a420)',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        style={{
                          background: 'rgba(235, 51, 73, 0.1)',
                          color: '#eb3349',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {/* Search */}
            {activeTab === 'search' && (
              <div>
                <div style={{ padding: '15px', borderBottom: '1px solid rgba(200, 200, 220, 0.2)' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="Nhập username..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      style={{
                        flex: 1,
                        padding: '10px 15px',
                        borderRadius: '10px',
                        border: '1px solid rgba(200, 200, 220, 0.5)',
                        outline: 'none',
                        fontSize: '14px'
                      }}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={loading}
                      style={{
                        background: 'linear-gradient(135deg, #1877f2, #0d65d9)',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1
                      }}
                    >
                      {loading ? '...' : '🔍'}
                    </button>
                  </div>
                </div>

                {searchResults.length > 0 && (
                  searchResults.map(user => (
                    <div key={user.id} style={{
                      padding: '12px 15px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      borderBottom: '1px solid rgba(200, 200, 220, 0.2)'
                    }}>
                      <img
                        src={user.avatar?.startsWith('http') || user.avatar?.startsWith('/') 
                          ? user.avatar 
                          : "https://cdn-icons-png.flaticon.com/512/847/847969.png"}
                        alt={user.username}
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#2d3748' }}>{user.username}</div>
                        <div style={{ fontSize: '12px', color: '#888' }}>ELO: {user.elo}</div>
                      </div>
                      {getStatusButton(user)}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendsPanel;
