const mongoose = require('mongoose');

const UserPuzzleDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  rawId: { type: String, required: true },
  hashedId: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  passwordUsed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserPuzzleData', UserPuzzleDataSchema);
