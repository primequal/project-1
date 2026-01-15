1. Nhóm API Xác thực (Authentication)
Endpoint,Method,Mô tả,Request Body
/api/auth/register,POST,Đăng ký tài khoản mới,"{username, email, password}"
/api/auth/login,POST,Đăng nhập và nhận JWT,"{username, password}"
/api/auth/logout,POST,Đăng xuất (xóa token),None





2. Nhóm API Người dùng & Thống kê (User & Stats)
Phục vụ cho trang Dashboard và Profile.

Endpoint,Method,Mô tả,Request/Query Params
/api/user/profile,GET,"Lấy thông tin cá nhân (Elo, Avatar)",Header: Authorization
/api/user/update-avatar,PUT,Cập nhật ảnh đại diện,{avatarUrl}
/api/user/statistics,GET,Lấy số liệu thắng/thua/hòa & phần trăm,None





3. Nhóm API Lịch sử & Replay (Game History)
Đây là phần quan trọng để thực hiện chức năng tìm kiếm và xem lại ván đấu.

Endpoint,Method,Mô tả,Query Params / Body
/api/games/history,GET,Lấy danh sách ván đấu (có phân trang),?opponent=name&date=2026-01-12
/api/games/:id,GET,Lấy chi tiết 1 ván đấu để Replay,id (Game ID)





4. Cấu trúc Socket.io Events (Real-time)
Vì bạn dùng Socket.io cho PvP, PvF và Chat, chúng ta không dùng API truyền thống mà dùng các "Sự kiện".

Hệ thống Ghép cặp & Phòng (Matchmaking)
emit("join_matchmaking"): Người dùng nhấn "PvP", Server đưa vào hàng đợi.
on("match_found"): Server báo đã tìm thấy đối thủ, gửi roomId.
emit("create_private_room"): Người dùng nhấn "PvF", Server trả về roomCode.
emit("join_private_room", { roomCode }): Người bạn nhập mã để vào chơi cùng.

Trong trận đấu (In-game)
emit("send_move", { x, y, roomId }): Gửi nước đi lên server.
on("receive_move"): Nhận nước đi từ đối thủ/AI.
emit("send_chat", { message, roomId }): Gửi tin nhắn chat.
on("receive_chat"): Nhận tin nhắn chat.
on("game_over"): Server thông báo kết quả và cập nhật Elo vào MySQL.





5. Quy trình xử lý dữ liệu (Data Flow)

Khi trận đấu kết thúc: Backend sẽ thực hiện đồng thời 2 việc:
Cập nhật elo mới vào bảng Users.
Insert một dòng vào bảng Games để lấy game_id.
Dùng game_id đó để Insert hàng loạt (Bulk Insert) danh sách nước đi đã lưu trong bộ nhớ tạm (RAM/Socket session) vào bảng GameMoves.

Khi tìm kiếm ván đấu: Câu lệnh SQL sẽ có dạng:
SELECT * FROM Games 
WHERE (player1_id = myID OR player2_id = myID) 
AND (opponent_name LIKE '%...%' OR DATE(start_time) = '...')