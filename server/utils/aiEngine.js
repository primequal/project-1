// Hệ số điểm cho các mẫu hình cờ
const SCORES = {
    FIVE: 100000,
    OPEN_FOUR: 10000,
    CLOSED_FOUR: 1000,
    OPEN_THREE: 500,
    CLOSED_THREE: 100,
    OPEN_TWO: 50,
    MY_PIECE: 'O',
    OPPONENT_PIECE: 'X'
};

class CaroAI {
    // Hàm đánh giá bàn cờ (Heuristic)
    evaluate(board, piece) {
        let score = 0;
        const opponent = piece === 'X' ? 'O' : 'X';
        
        // Duyệt toàn bộ bàn cờ để tìm các mẫu hình và cộng điểm
        // (Đây là phần quan trọng nhất, bạn có thể mở rộng thêm)
        score += this.countPatterns(board, piece);
        score -= this.countPatterns(board, opponent) * 1.2; // Ưu tiên chặn đối thủ hơn
        return score;
    }

    // Thuật toán Minimax kết hợp Alpha-Beta
    minimax(board, depth, alpha, beta, isMaximizing) {
        if (depth === 0) return { score: this.evaluate(board, SCORES.MY_PIECE) };

        const moves = this.getPotentialMoves(board);
        if (moves.length === 0) return { score: 0 };

        let bestMove = { r: -1, c: -1 };

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let move of moves) {
                board[move.r][move.c] = SCORES.MY_PIECE;
                let evaluation = this.minimax(board, depth - 1, alpha, beta, false).score;
                board[move.r][move.c] = null; // Trả lại trạng thái cũ (Backtracking)
                
                if (evaluation > maxEval) {
                    maxEval = evaluation;
                    bestMove = move;
                }
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break; // Cắt tỉa Alpha-Beta
            }
            return { score: maxEval, ...bestMove };
        } else {
            let minEval = Infinity;
            for (let move of moves) {
                board[move.r][move.c] = SCORES.OPPONENT_PIECE;
                let evaluation = this.minimax(board, depth - 1, alpha, beta, true).score;
                board[move.r][move.c] = null;
                
                if (evaluation < minEval) {
                    minEval = evaluation;
                    bestMove = move;
                }
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) break;
            }
            return { score: minEval, ...bestMove };
        }
    }

    // Chỉ xét các ô trống trong bán kính 1-2 ô quanh các quân đã đánh để giảm độ phức tạp
    getPotentialMoves(board) {
        const moves = [];
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if (board[r][c] === null) {
                    if (this.hasNeighbor(board, r, c)) {
                        moves.push({ r, c });
                    }
                }
            }
        }
        return moves;
    }

    hasNeighbor(board, r, c) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const nr = r + i, nc = c + j;
                if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr][nc] !== null) return true;
            }
        }
        return false;
    }

    countPatterns(board, piece) {
        let totalScore = 0;
        const size = 15;

        // Hướng quét: [dòng, cột]
        const directions = [
            [0, 1],  // Ngang
            [1, 0],  // Dọc
            [1, 1],  // Chéo xuôi
            [1, -1]  // Chéo ngược
        ];

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                // Chỉ bắt đầu kiểm tra từ ô có quân cờ của mình
                if (board[r][c] === piece) {
                    for (let [dr, dc] of directions) {
                        totalScore += this.evaluateDirection(board, r, c, dr, dc, piece);
                    }
                }
            }
        }
        return totalScore;
    }

    // Hàm hỗ trợ đánh giá một chuỗi theo một hướng cụ thể
    evaluateDirection(board, r, c, dr, dc, piece) {
        const opponent = piece === 'X' ? 'O' : 'X';
        let count = 1;
        let blockBefore = false;
        let blockAfter = false;

        // Đếm về phía trước
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr][nc] === piece) {
            count++;
            nr += dr; nc += dc;
        }
        // Kiểm tra xem đầu phía trước có bị chặn không
        if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15 || board[nr][nc] === opponent) {
            blockAfter = true;
        }

        // Đếm về phía sau
        nr = r - dr; nc = c - dc;
        while (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr][nc] === piece) {
            // Tránh đếm lặp: nếu quân phía sau cũng là mình, ta bỏ qua vì nó đã được tính ở lượt quét trước
            return 0; 
        }
        // Kiểm tra xem đầu phía sau có bị chặn không
        if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15 || board[nr][nc] === opponent) {
            blockBefore = true;
        }

        // --- CHẤM ĐIỂM DỰA TRÊN ĐỘ NGUY HIỂM ---
        if (count >= 5) return SCORES.FIVE; // Thắng luôn

        if (count === 4) {
            if (!blockBefore && !blockAfter) return SCORES.OPEN_FOUR; // .XXXX.
            if (!blockBefore || !blockAfter) return SCORES.CLOSED_FOUR; // OXXXX. hoặc .XXXXO
        }

        if (count === 3) {
            if (!blockBefore && !blockAfter) return SCORES.OPEN_THREE; // .XXX.
            if (!blockBefore || !blockAfter) return SCORES.CLOSED_THREE; // OXXX.
        }

        if (count === 2) {
            if (!blockBefore && !blockAfter) return SCORES.OPEN_TWO; // .XX.
        }

        return 0;
    }
}

module.exports = new CaroAI();