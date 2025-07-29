const express = require('express');
const router = express.Router();
const { createPuzzleId, loginPuzzle } = require('../controllers/puzzleController');
const checkJwt = require('../middleware/auth');

router.post('/generate', checkJwt, createPuzzleId);
router.post('/login', checkJwt, loginPuzzle);

module.exports = router;
