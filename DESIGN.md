1. Kiến trúc hệ thống (System Architecture)
Hệ thống của bạn sẽ hoạt động theo mô hình Client-Server thời gian thực.

Frontend (React): Quản lý giao diện, trạng thái bàn cờ, và gửi/nhận sự kiện qua Socket.io-client.
Backend (Node.js & Express):
REST API: Xử lý đăng ký, đăng nhập, lấy lịch sử đấu, cập nhật profile.
Socket.io Server: Xử lý logic thời gian thực (ghép cặp, chat, gửi nước đi).
AI Engine: Thực hiện thuật toán Minimax (đặt tại Backend để bảo mật và tránh lag cho Client).
Database (MySQL): Lưu trữ thông tin người dùng, chỉ số Elo và lịch sử các nước đi.





2. Thiết kế Cơ sở dữ liệu (ERD)
Để hỗ trợ chức năng "Xem lại ván đấu", chúng ta cần lưu trữ không chỉ kết quả mà là toàn bộ danh sách các nước đi.

Các bảng dữ liệu (Database Schema)
Bảng,Trường dữ liệu,Mô tả
Users,"id, username, password, email, avatar, elo, created_at",Thông tin người dùng và điểm xếp hạng.
Games,"id, player1_id, player2_id (null nếu là AI), winner_id, game_type (PvP, PvE, PvF), start_time, end_time",Thông tin tổng quan về một ván đấu.
GameMoves,"id, game_id, player_id, x_coord, y_coord, move_order",Lưu từng nước đi theo thứ tự để phục vụ tính năng Replay.





3. Thuật toán AI: Minimax & Cắt tỉa Alpha-Beta
Với độ sâu $d \le 5$, thuật toán Minimax sẽ duyệt cây trạng thái để tìm nước đi tối ưu.Hàm lượng giá (Heuristic): Bạn cần một hàm để chấm điểm bàn cờ dựa trên các chuỗi 2, 3, 4 quân cờ liên tiếp và các ô bị chặn.Cắt tỉa Alpha-Beta: Giúp loại bỏ các nhánh không cần thiết, tăng tốc độ tính toán đáng kể để có thể đạt tới độ sâu 5 trong thời gian ngắn.$$\alpha \text{ là giá trị tốt nhất mà người chơi Max có thể đảm bảo.}$$$$\beta \text{ là giá trị tốt nhất mà người chơi Min có thể đảm bảo.}$$





4. Sơ đồ luồng hoạt động (Workflow)
A. Luồng Đăng nhập & DashboardNgười dùng gửi thông tin Đăng nhập -> Backend xác thực -> Trả về JWT Token.Frontend lưu Token, chuyển hướng vào /dashboard.Frontend gọi API lấy thông tin Profile & Thống kê (Elo, % thắng/thua).
B. Luồng Ghép cặp (Matchmaking - PvP)User ấn "PvP" -> Gửi sự kiện join_queue lên Socket server kèm theo Elo.Server lưu User vào danh sách hàng đợi (Queue).Server định kỳ quét Queue: Nếu 2 người có chênh lệch $Elo < 100$, tạo phòng đấu và gửi sự kiện match_found cho cả hai.
C. Luồng Chơi Game & Lưu trữNgười chơi đánh 1 nước -> Gửi tọa độ $(x, y)$ qua Socket.Server kiểm tra tính hợp lệ -> Lưu nước đi vào mảng tạm thời.Server gửi nước đi tới đối thủ (PvP) hoặc gọi AI Engine (PvE).Khi có người thắng: Server tính toán lại Elo, lưu bản ghi vào bảng Games và toàn bộ mảng nước đi vào bảng GameMoves.
D. Luồng Xem lại ván đấu (Replay)User chọn một ván từ lịch sử.Frontend gọi API get_game_detail/:id.Backend trả về thông tin ván đấu và danh sách các nước đi sắp xếp theo move_order.Frontend hiển thị bàn cờ trống và nút "Next/Back" để User duyệt qua mảng nước đi đó.