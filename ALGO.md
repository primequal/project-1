1. Cấu trúc hàm Minimax với Cắt tỉa Alpha-BetaÝ tưởng cơ bản là: Max (Máy) cố gắng tối đa hóa điểm số, còn Min (Người) cố gắng tối thiểu hóa điểm số của máy.Công thức tổng quát:$$V_{Minimax} = \max(\text{đối thủ's } \min, \dots)$$Trong đó, $\alpha$ đại diện cho giá trị tốt nhất mà Max có thể chọn, và $\beta$ là giá trị tốt nhất mà Min có thể chọn. Nếu $\alpha \ge \beta$, chúng ta "cắt tỉa" (không xét các nhánh con nữa).





2. Hàm Lượng giá (Heuristic Evaluation)
Đây là phần quan trọng nhất. Vì không thể duyệt đến cuối trận (khi có người thắng), ta phải chấm điểm cho một trạng thái bàn cờ hiện tại.

Ta sẽ tính điểm dựa trên các "mẫu hình" (patterns) xuất hiện trên bàn cờ:
Mẫu hình (Pattern),Điểm số (Ví dụ),Giải thích
5 quân liên tiếp,"100,000",Thắng tuyệt đối
4 quân mở 2 đầu,"10,000",Chắc chắn sẽ tạo được 5
4 quân bị chặn 1 đầu,"1,000",Cần thêm 1 nước để thắng
3 quân mở 2 đầu,500,Tiềm năng tạo 4
2 quân mở 2 đầu,100,Bắt đầu tạo chuỗi






4. Các kỹ thuật tối ưu bắt buộc để chạy được d=5
Để server Node.js của bạn không bị treo khi tính toán, bạn cần áp dụng các mẹo sau:

Vùng tìm kiếm (Heuristic Search Space): Chỉ xét các ô trống nằm trong phạm vi 1 hoặc 2 ô xung quanh các quân cờ đã có trên bàn. Điều này giảm số lượng moves từ 225 xuống còn khoảng 10-20.
Sắp xếp nước đi (Move Ordering): Thử các nước đi "có vẻ tốt" trước (ví dụ: nước đi tạo thành chuỗi 3, chuỗi 4). Nếu nước đi tốt được xét sớm, Alpha-Beta sẽ cắt tỉa được rất nhiều nhánh rác.
Zobrist Hashing: Lưu lại điểm số của các trạng thái bàn cờ đã tính toán vào một bảng băm (Transposition Table). Nếu gặp lại trạng thái đó, lấy kết quả luôn mà không tính lại.
Hàm lượng giá hiệu quả: Thay vì duyệt lại toàn bộ bàn cờ mỗi lần gọi evaluateBoard, hãy cập nhật điểm số dựa trên nước đi vừa đánh (Incremental Evaluation).





5. Quy trình tích hợp vào Game của bạn
Client (React): Gửi trạng thái bàn cờ hiện tại qua Socket.io.
Server (Node.js): * Nhận bàn cờ.Chạy hàm findBestMove(board) (hàm này gọi vòng lặp minimax cho từng ô trống).Trả kết quả tọa độ $\{x, y\}$ về cho Client.Lưu nước đi vào MySQL.