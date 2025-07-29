const { generatePuzzleData, validatePassword } = require('../services/puzzleService');
const User = require('../models/User'); 

async function createPuzzleId(req, res) {
  try {
    const user = await User.findById(req.user.id).select('username email');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { hashedId } = await generatePuzzleData(user);

    res.json({ message: 'Puzzle ID created', hashedId });
  } catch (err) {
    console.error('Error creating puzzle ID:', err);
    res.status(500).json({ error: 'Failed to create puzzle ID' });
  }
}

async function loginPuzzle(req, res) {
  try {
    const { hashedId, password } = req.body;
    const result = await validatePassword(hashedId, password);
    if (!result.valid) {
      return res.status(401).json({ error: result.reason });
    }
    res.json({ message: 'Login successful', redirectUrl: result.redirectUrl });
  } catch (err) {
    console.error('Error logging into puzzle:', err);
    res.status(500).json({ error: 'Failed to log into puzzle' });
  }
}

module.exports = { createPuzzleId, loginPuzzle };
