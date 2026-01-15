caro-project/
├── server/                # Backend (Node.js & Express)
│   ├── config/            # Cấu hình Database, biến môi trường
│   ├── controllers/       # Logic xử lý API (Auth, User, Game)
│   ├── engine/            # "Bộ não" AI (Minimax, Alpha-Beta)
│   ├── middleware/        # Kiểm tra JWT, phân quyền
│   ├── models/            # Các câu lệnh truy vấn MySQL
│   ├── routes/            # Khai báo các đường dẫn API
│   ├── sockets/           # Xử lý sự kiện Real-time (Socket.io)
│   └── index.js           # File chạy chính của server
├── client/                # Frontend (React.js)
│   ├── public/            # File tĩnh (ảnh, icon)
│   ├── src/
│   │   ├── assets/        # CSS, hình ảnh quân cờ
│   │   ├── components/    # Các UI nhỏ (Board, Square, ChatBox, Navbar)
│   │   ├── contexts/      # Quản lý trạng thái Global (AuthContext, GameContext)
│   │   ├── hooks/         # Custom hooks (useSocket, useAuth)
│   │   ├── pages/         # Các trang chính (Login, Register, Dashboard, Game)
│   │   ├── services/      # Gọi API (Axios)
│   │   └── App.js         # Component gốc và Route
└── .gitignore             # Các file không đẩy lên Github (node_modules, .env)