// Hệ số K-factor (thường là 32 cho người chơi mới)
const K = 32;

/**
 * Tính toán Elo mới
 * @param {number} ratingA - Elo người thắng
 * @param {number} ratingB - Elo người thua
 * @param {boolean} isDraw - Ván đấu có hòa không
 */
const calculateNewElo = (ratingA, ratingB, isDraw = false) => {
    const expectedScoreA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const expectedScoreB = 1 - expectedScoreA;

    const actualScoreA = isDraw ? 0.5 : 1;
    const actualScoreB = isDraw ? 0.5 : 0;

    const newRatingA = Math.round(ratingA + K * (actualScoreA - expectedScoreA));
    const newRatingB = Math.round(ratingB + K * (actualScoreB - expectedScoreB));

    return { newRatingA, newRatingB };
};

module.exports = { calculateNewElo };