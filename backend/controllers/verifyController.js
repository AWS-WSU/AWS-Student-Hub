const User = require('../models/User');

exports.verifyUser = async (req, res) => {
  try {
    const { username, secret } = req.body;

    if (!username || !secret) {
      return res.json({
        valid: false,
        message: 'Username and secret are required'
      });
    }

    const user = await User.findOne({ username }).select('+nextChallengePassword');

    if (!user) {
      return res.json({
        valid: false
      });
    }

    if (!user.nextChallengePassword) {
      return res.json({
        valid: false
      });
    }

    const isValid = user.nextChallengePassword === secret;

    res.json({
      valid: isValid
    });

  } catch (error) {
    console.error('Verify user error:', error);
    res.json({
      valid: false,
      message: 'Server error'
    });
  }
};
