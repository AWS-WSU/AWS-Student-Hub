const crypto = require('crypto');
const UserPuzzleData = require('../models/UserPuzzleData');

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function sha1(input) {
  return crypto.createHash('sha1').update(input).digest('hex');
}

async function generatePuzzleData(user) {
  const dateStr = new Date().toISOString().slice(5,10).replace(/-/g,'') + new Date().getFullYear();
  const rawId = `${dateStr}#${user.username}`;
  const hashedId = sha256(rawId);
  const password = sha1(rawId).slice(0,8);

  // const passwordHash = sha256(password);

  /* const data = await UserPuzzleData.findOneAndUpdate(
    { userId: user._id },
    { rawId, hashedId, passwordHash, passwordUsed: false },
    { new: true, upsert: true }
  ); */


  return { hashedId, rawId, password }; // TODO: ONLY RETURN hashedId 
}

async function validatePassword(hashedId, password) {
  const userData = await UserPuzzleData.findOne({ hashedId });
  if (!userData) return { valid: false, reason: 'No such ID' };
  if (userData.passwordUsed) return { valid: false, reason: 'Password already used' };

  const hashedPassword = sha256(password);
  if (hashedPassword !== userData.passwordHash) return { valid: false, reason: 'Wrong password' };

  // Burn the password
  userData.passwordUsed = true;
  await userData.save();

  return { valid: true, redirectUrl: `/clue/${hashedId}` };
}

module.exports = { generatePuzzleData, validatePassword };