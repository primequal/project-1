const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const auth = require('../middleware/auth'); // Import người gác cổng

// Đường dẫn: GET /api/games/history
router.get('/history', auth, gameController.getHistory);

// Đường dẫn: GET /api/games/:id/moves
router.get('/:id/moves', auth, gameController.getGameMoves);

module.exports = router;