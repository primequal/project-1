import { io } from 'socket.io-client';

// Kết nối tới server Node.js của bạn
const socket = io('http://localhost:5000');

export default socket;