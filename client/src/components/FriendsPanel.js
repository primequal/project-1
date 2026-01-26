import React, { useState, useEffect, useRef } from 'react';
import { 
  searchUsers, 
  sendFriendRequest, 
  getFriendRequests, 
  acceptFriendRequest, 
  rejectFriendRequest,
  getFriends,
  removeFriend 
} from '../api';

const FriendsPanel = () => {
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'requests', 'search'
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const panelRef = useRef(null);

  const fetchFriends = async () => {
    try {
      const { data } = await getFriends();
      setFriends(data);
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

  const getStatusButton = (user) => {
    switch (user.friendStatus) {
      case 'friend':
        return <span style={{ color: '#38ef7d', fontSize: '12px' }}>✅ Bạn bè</span>;
      case 'request_sent':
        return <span style={{ color: '#667eea', fontSize: '12px' }}>📤 Đã gửi</span>;
      case 'request_received':
        return <span style={{ color: '#ffd700', fontSize: '12px' }}>📥 Chờ phản hồi</span>;
      default:
        return (
          <button
            onClick={() => handleSendRequest(user.id)}
            style={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
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
            background: 'linear-gradient(135deg, #11998e, #38ef7d)',
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
            background: 'linear-gradient(135deg, #11998e, #38ef7d)',
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
                  background: activeTab === tab.key ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                  color: activeTab === tab.key ? '#667eea' : '#666',
                  fontWeight: activeTab === tab.key ? '600' : '400',
                  cursor: 'pointer',
                  fontSize: '13px',
                  borderBottom: activeTab === tab.key ? '2px solid #667eea' : '2px solid transparent'
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
              background: 'rgba(102, 126, 234, 0.1)',
              color: '#667eea',
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
                    <img
                      src={friend.avatar?.startsWith('http') || friend.avatar?.startsWith('/') 
                        ? friend.avatar 
                        : "https://cdn-icons-png.flaticon.com/512/847/847969.png"}
                      alt={friend.username}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#2d3748' }}>{friend.username}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>ELO: {friend.elo}</div>
                    </div>
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
                          background: 'linear-gradient(135deg, #11998e, #38ef7d)',
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
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
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
