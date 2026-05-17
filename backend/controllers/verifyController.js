const User = require('../models/User');

exports.verifyUser = async (req, res) => {
  try {
    const { username, secret } = req.body;

    // console.log('Received:', { username, secret });

    if (!username || !secret) {
      return res.json({
        valid: false,
        message: 'Username and secret are required',
      });
    }

    const user = await User.findOne({ username }).select('+nextChallengePassword');

    /* console.log('Found user:', user ? 'YES' : 'NO'); 
    if (user) {
      console.log('User nextChallengePassword:', user.nextChallengePassword); 
    } */

    if (!user) {
      return res.json({
        valid: false,
      });
    }

    if (!user.nextChallengePassword) {
      return res.json({
        valid: false,
      });
    }

    const isValid = user.nextChallengePassword === secret;

    // console.log('Password match:', isValid);

    res.json({
      valid: isValid,
    });
  } catch (error) {
    console.error('Verify user error:', error);
    res.json({
      valid: false,
      message: 'Server error',
    });
  }
};
