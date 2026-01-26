import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5000/api' });

API.interceptors.request.use((req) => {
    const token = localStorage.getItem('token');
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
});

export const login = (formData) => API.post('/auth/login', formData);
export const register = (formData) => API.post('/auth/register', formData);
export const getMe = () => API.get('/auth/me');
export const updateAvatar = (avatarUrl) => API.put('/auth/avatar', { avatarUrl }); 
export const changePassword = (currentPassword, newPassword) => 
    API.put('/auth/change-password', { currentPassword, newPassword });

// HÀM MỚI: Upload file (Cần header multipart/form-data, axios tự xử lý khi nhận FormData)
export const uploadAvatarFile = (formData) => API.post('/auth/avatar-upload', formData);

// Game history
export const getHistory = () => API.get('/games/history');
export const getGameMoves = (gameId) => API.get(`/games/${gameId}/moves`);

// ELO History - period: 'week' | 'month' | 'year'
export const getEloHistory = (period) => API.get(`/games/elo-history?period=${period}`);

// Leaderboard - Top 20 players
export const getLeaderboard = () => API.get('/games/leaderboard');

// Friends
export const searchUsers = (username) => API.get(`/friends/search?username=${username}`);
export const sendFriendRequest = (toUserId) => API.post('/friends/request', { toUserId });
export const undoFriendRequest = (toUserId) => API.delete(`/friends/request/${toUserId}`);
export const getFriendRequests = () => API.get('/friends/requests');
export const acceptFriendRequest = (requestId) => API.post(`/friends/accept/${requestId}`);
export const rejectFriendRequest = (requestId) => API.post(`/friends/reject/${requestId}`);
export const getFriends = () => API.get('/friends');
export const removeFriend = (friendId) => API.delete(`/friends/${friendId}`);

// Notifications
export const getNotifications = () => API.get('/notifications');
export const markNotificationRead = (notifId) => API.put(`/notifications/${notifId}/read`);
export const markAllNotificationsRead = () => API.put('/notifications/read-all');