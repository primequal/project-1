import { io } from 'socket.io-client';

// Kết nối tới server Node.js của bạn
const SOCKET_URL = (process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const socket = io(SOCKET_URL);

export default socket;
