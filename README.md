# 🎮 Caro Online Game

Game cờ caro online với các chế độ PvP, PvE (AI), PvF (với bạn bè), hệ thống ELO, kết bạn, thông báo và spectator mode.

## 📋 Yêu cầu hệ thống

- **Node.js** >= 18.x
- **npm** >= 9.x
- **MySQL** >= 8.0

## 🚀 Hướng dẫn cài đặt

### 1. Clone repository

```bash
git clone <repository-url>
cd main
```

### 2. Cài đặt Database MySQL

1. Mở MySQL Workbench hoặc terminal MySQL
2. Chạy file SQL để tạo database và các bảng:

```bash
mysql -u root -p < caro.sql
```

Hoặc copy nội dung file `caro.sql` và chạy trong MySQL Workbench.

### 3. Cấu hình Server

1. Vào thư mục server:
```bash
cd server
```

2. Tạo file `.env`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=caro
JWT_SECRET=your_jwt_secret_key
```

3. Cài đặt dependencies:
```bash
npm install
```

### 4. Cấu hình Client

1. Vào thư mục client:
```bash
cd ../client
```

2. Cài đặt dependencies:
```bash
npm install
```

## ▶️ Chạy ứng dụng

### Chạy Server (Terminal 1)

```bash
cd server
npm run dev
```

Server sẽ chạy tại: `http://localhost:5000`

### Chạy Client (Terminal 2)

```bash
cd client
npm start
```

Client sẽ chạy tại: `http://localhost:3000`

## 📦 Dependencies

### Server
| Package | Version | Mô tả |
|---------|---------|-------|
| express | ^5.2.1 | Web framework |
| socket.io | ^4.8.3 | Real-time communication |
| mysql2 | ^3.16.0 | MySQL driver |
| bcryptjs | ^3.0.3 | Password hashing |
| jsonwebtoken | ^9.0.3 | JWT authentication |
| cors | ^2.8.5 | Cross-origin resource sharing |
| dotenv | ^17.2.3 | Environment variables |
| multer | ^2.0.2 | File upload |
| nodemon | ^3.1.11 | Auto-restart (dev) |

### Client
| Package | Version | Mô tả |
|---------|---------|-------|
| react | ^18.2.0 | UI library |
| react-dom | ^18.2.0 | React DOM |
| react-router-dom | ^7.12.0 | Routing |
| axios | ^1.13.2 | HTTP client |
| socket.io-client | ^4.8.3 | Socket.IO client |
| lucide-react | ^0.562.0 | Icons |

## 🎯 Tính năng

### Chế độ chơi
- ⚔️ **PvP** - Ghép cặp ngẫu nhiên với người chơi khác (cùng time control)
- 🤖 **PvE** - Đấu với AI (3 độ khó: Dễ, Trung bình, Khó - Minimax algorithm)
- 👥 **PvF** - Tạo phòng chơi với bạn bè (Rated/Unrated)
- 🎬 **Spectator** - Xem trực tiếp trận đấu của người khác

### Hệ thống xếp hạng & Thống kê
- 📊 **ELO System** - Hệ thống xếp hạng ELO
- 🏆 **Leaderboard** - Bảng xếp hạng top người chơi
- 📜 **History** - Xem lại lịch sử và replay các ván đấu

### Kết bạn & Thông báo
- 👫 **Friends** - Kết bạn bằng username
- 🟢 **Online Status** - Hiển thị trạng thái online/offline của bạn bè
- 🎮 **Mời bạn bè** - Mời bạn bè chơi PvF qua Friends Panel hoặc Notification
- 🔔 **Notifications** - Thông báo biến động ELO, lời mời kết bạn, mời chơi game

### Trong trận đấu
- ⏱️ **Time Control** - Giới hạn thời gian mỗi lượt (PvP: 30s/60s, PvF: 30s/60s/Vô hạn/Tùy chỉnh)
- 💬 **Chat + Emoji** - Chat trong game với emoji picker
- 🔄 **Rematch** - Yêu cầu đấu lại sau khi kết thúc ván
- 🔊 **Sound Effects** - Hiệu ứng âm thanh (đặt quân, thắng, thua, bắt đầu game)

### Tài khoản
- 🖼️ **Avatar** - Đổi avatar bằng URL hoặc upload file
- 🔐 **Đổi mật khẩu** - Thay đổi mật khẩu tài khoản

## 📁 Cấu trúc thư mục

```
main/
├── client/                 # React Frontend
│   ├── public/
│   └── src/
│       ├── components/     # NotificationBell, FriendsPanel
│       ├── pages/          # Dashboard, Game, History, Login, Register, Replay
│       ├── api.js          # API functions
│       ├── socket.js       # Socket.IO client
│       └── styles.css      # Glassmorphism styles
│
├── server/                 # Express Backend
│   ├── config/
│   │   └── db.js          # MySQL connection
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── gameController.js
│   │   ├── friendController.js
│   │   └── notificationController.js
│   ├── middleware/
│   │   └── auth.js        # JWT middleware
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── gameRoutes.js
│   │   ├── friendRoutes.js
│   │   └── notificationRoutes.js
│   ├── utils/
│   │   ├── aiEngine.js    # Minimax AI
│   │   └── eloCalculator.js
│   ├── uploads/           # Avatar uploads
│   └── index.js           # Main server + Socket.IO
│
├── caro.sql               # Database schema
└── README.md              # This file
```

## 🔧 Troubleshooting

### Lỗi kết nối MySQL
- Kiểm tra MySQL service đang chạy
- Kiểm tra thông tin trong file `.env`
- Đảm bảo đã tạo database bằng file `caro.sql`

### Lỗi CORS
- Đảm bảo client chạy ở port 3000, server ở port 5000

### Lỗi Socket.IO
- Kiểm tra cả server và client đều đang chạy
- Refresh lại trang nếu mất kết nối

## 📝 License

MIT License
