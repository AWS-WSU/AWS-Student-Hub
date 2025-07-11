const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { sendResetCode } = require('../services/emailService');
const Filter = require('bad-words');
const crypto = require('crypto');

const generateDeviceId = () => {
  return crypto.randomBytes(16).toString('hex');
};

const generateTokens = (user, deviceId) => {
  // Debug logging for Lambda environment
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    console.log('Lambda environment detected');
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0);
  }
  
  // Short-lived access token (15 minutes)
  const accessToken = jwt.sign(
    { 
      id: user._id, 
      email: user.email,
      tokenVersion: user.tokenVersion
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  // Long-lived refresh token (7 days)
  const refreshToken = user.generateRefreshToken(deviceId);
  
  return { accessToken, refreshToken };
};

const generateUsername = async (email) => {
  let baseUsername = email.split('@')[0];
  let username = baseUsername;
  let counter = 1;
  
  while (true) {
    const existingUser = await User.findOne({ username });
    if (!existingUser) {
      return username;
    }
    username = `${baseUsername}${counter}`;
    counter++;
  }
};

const filter = new Filter();

function normalizeInput(str) {
  return str
    .toLowerCase()
    .replace(/[!1|i]/g, 'i')
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/0/g, 'o')
    .replace(/[^a-z]/g, '');
}

function containsProfanity(input) {
  if (!input || typeof input !== 'string') return false;
  const normalized = normalizeInput(input);
  return filter.isProfane(input) || filter.isProfane(normalized);
}

exports.signup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullName, email, password, username: providedUsername, deviceId } = req.body;

    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Account creation failed. Please check your information.' });
    }

    if (providedUsername) {
      const existingUsername = await User.findOne({ username: providedUsername });
      if (existingUsername) {
        return res.status(400).json({ error: 'Account creation failed. Please check your information.' });
      }
    }

    const fieldsToCheck = [
      { name: 'username', value: providedUsername },
      { name: 'full name', value: fullName },
      { name: 'email', value: email }
    ];

    for (const field of fieldsToCheck) {
      if (field.value && containsProfanity(field.value)) {
        return res.status(400).json({
          error: `Hey, that's not nice. Try again.`
        });
      }
    }

    const username = providedUsername || await generateUsername(email);

    const user = new User({
      username,
      fullName,
      email,
      password
    });

    const currentDeviceId = deviceId || generateDeviceId();
    const { accessToken, refreshToken } = generateTokens(user, currentDeviceId);

    user.lastLogin = Date.now();
    await user.save();

    res.status(201).json({
      accessToken,
      refreshToken,
      deviceId: currentDeviceId,
      user: user.toSafeObject()
    });

  } catch (error) {
    console.error('Signup error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        error: 'Account creation failed. Please check your information.'
      });
    }

    res.status(500).json({ error: 'Server error during signup' });
  }
};


exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, deviceId } = req.body;

    let user;
    const isEmail = email.includes('@');
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), 3000)
    );
    
    let findUserPromise;
    if (isEmail) {
      findUserPromise = User.findOne({ email }).select('+password');
    } else {
      findUserPromise = User.findOne({ username: email }).select('+password');
    }
    
    user = await Promise.race([findUserPromise, timeoutPromise]);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const currentDeviceId = deviceId || generateDeviceId();
    
    // Clean expired tokens before generating new ones
    user.cleanExpiredRefreshTokens();
    
    const { accessToken, refreshToken } = generateTokens(user, currentDeviceId);

    setImmediate(() => {
      user.lastLogin = Date.now();
      user.save().catch(err => console.error('Failed to update user data:', err));
    });

    res.json({
      accessToken,
      refreshToken,
      deviceId: currentDeviceId,
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error.message === 'Database timeout') {
      return res.status(503).json({
        error: 'Service temporarily unavailable. Please try again.'
      });
    }
    
    res.status(500).json({
      error: 'Server error during login'
    });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    res.json(user.toSafeObject());
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      error: 'Server error while fetching user'
    });
  }
};

exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.body;
    const currentUserId = req.user.id;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    const existingUser = await User.findOne({ 
      username,
      _id: { $ne: currentUserId }
    });

    res.json({
      success: true,
      available: !existingUser,
      message: existingUser ? 'Username is already taken' : 'Username is available'
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking username'
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, major, grade, programmingLanguages, profileSetupCompleted, wantsEmails, fullName, username } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    if (bio !== undefined) user.bio = bio;
    if (major !== undefined) user.major = major;
    if (grade !== undefined) user.grade = grade;
    if (programmingLanguages !== undefined) user.programmingLanguages = programmingLanguages;
    if (profileSetupCompleted !== undefined) user.profileSetupCompleted = profileSetupCompleted;
    if (wantsEmails !== undefined) user.wantsEmails = wantsEmails;
    if (fullName !== undefined) user.fullName = fullName;
    if (username !== undefined) user.username = username;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Server error while updating profile'
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({
        error: 'Email or username is required'
      });
    }

    let user;
    const isEmail = identifier.includes('@');
    
    if (isEmail) {
      user = await User.findOne({ email: identifier.toLowerCase() });
    } else {
      user = await User.findOne({ username: identifier });
    }

    if (!user) {
      return res.json({
        success: true,
        message: isEmail ? 
          'If an account exists with this email, a reset code has been sent.' :
          'If an account exists with this username, you will need to verify your email address.'
      });
    }

    if (user.auth0Id) {
      return res.json({
        success: true,
        message: 'If an account exists with this information, a reset code has been sent.'
      });
    }

    if (!isEmail) {
      const censoredEmail = user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      return res.json({
        success: true,
        needsEmailVerification: true,
        censoredEmail,
        message: 'Please enter the email address associated with this username to verify your identity.'
      });
    }

    const resetToken = user.generateResetToken();
    await user.save();

    await sendResetCode(user.email, resetToken, user.fullName);

    res.json({
      success: true,
      message: 'If an account exists with this email, a reset code has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Server error while processing password reset request'
    });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { username, email } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        error: 'Username and email are required'
      });
    }

    const user = await User.findOne({ 
      username,
      email: email.toLowerCase()
    });

    if (!user) {
      return res.json({
        success: true,
        message: 'If the email matches the username, a reset code has been sent.'
      });
    }

    if (user.auth0Id) {
      return res.json({
        success: true,
        message: 'If the email matches the username, a reset code has been sent.'
      });
    }

    const resetToken = user.generateResetToken();
    await user.save();

    await sendResetCode(user.email, resetToken, user.fullName);

    res.json({
      success: true,
      message: 'If the email matches the username, a reset code has been sent.'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Server error while verifying email'
    });
  }
};

exports.verifyResetCode = async (req, res) => {
  try {
    const { identifier, code } = req.body;

    if (!identifier || !code) {
      return res.status(400).json({
        error: 'Email/username and reset code are required'
      });
    }

    let user;
    const isEmail = identifier.includes('@');
    
    if (isEmail) {
      user = await User.findOne({ 
        email: identifier.toLowerCase(),
        resetPasswordToken: code,
        resetPasswordExpires: { $gt: Date.now() }
      }).select('+resetPasswordToken +resetPasswordExpires');
    } else {
      user = await User.findOne({ 
        username: identifier,
        resetPasswordToken: code,
        resetPasswordExpires: { $gt: Date.now() }
      }).select('+resetPasswordToken +resetPasswordExpires');
    }

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired reset code'
      });
    }

    res.json({
      success: true,
      message: 'Reset code verified successfully. You can now set a new password.',
      resetToken: code
    });
  } catch (error) {
    console.error('Verify reset code error:', error);
    res.status(500).json({
      error: 'Server error while verifying reset code'
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { identifier, code, newPassword } = req.body;

    if (!identifier || !code || !newPassword) {
      return res.status(400).json({
        error: 'All fields are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long'
      });
    }

    let user;
    const isEmail = identifier.includes('@');
    
    if (isEmail) {
      user = await User.findOne({ 
        email: identifier.toLowerCase(),
        resetPasswordToken: code,
        resetPasswordExpires: { $gt: Date.now() }
      }).select('+resetPasswordToken +resetPasswordExpires +password');
    } else {
      user = await User.findOne({ 
        username: identifier,
        resetPasswordToken: code,
        resetPasswordExpires: { $gt: Date.now() }
      }).select('+resetPasswordToken +resetPasswordExpires +password');
    }

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired reset code'
      });
    }

    user.password = newPassword;
    user.clearResetToken();
    await user.save();

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Server error while resetting password'
    });
  }
};

exports.getRecentUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    
    const recentUsers = await User.find({})
      .select('username fullName profilePicture createdAt')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      users: recentUsers
    });
  } catch (error) {
    console.error('Get recent users error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching recent users'
    });
  }
};

exports.getPublicProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username })
      .select('username fullName profilePicture bio major grade programmingLanguages role createdAt lastLogin');

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const now = new Date();
    const createdAt = new Date(user.createdAt);
    const lastLogin = new Date(user.lastLogin);
    
    const daysSinceJoin = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    const daysSinceLastSeen = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));
    
    const memberSince = createdAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const profileData = {
      username: user.username,
      fullName: user.fullName,
      profilePicture: user.profilePicture,
      bio: user.bio || '',
      major: user.major || '',
      grade: user.grade || '',
      programmingLanguages: user.programmingLanguages || [],
      role: user.role || 'member',
      lastLogin: user.lastLogin,
      stats: {
        memberSince,
        daysSinceJoin,
        daysSinceLastSeen
      }
    };

    res.json({
      success: true,
      profile: profileData
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({
      error: 'Server error while fetching profile'
    });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters long'
      });
    }

    const searchRegex = new RegExp(q, 'i');
    const searchLimit = Math.min(parseInt(limit), 20);

    const users = await User.find({
      $or: [
        { username: searchRegex },
        { fullName: searchRegex }
      ]
    })
    .select('username fullName profilePicture createdAt')
    .limit(searchLimit)
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while searching users'
    });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken, deviceId } = req.body;

    if (!refreshToken || !deviceId) {
      return res.status(400).json({
        error: 'Refresh token and device ID are required'
      });
    }

    // Find user with this refresh token
    const user = await User.findOne({
      'refreshTokens.token': refreshToken,
      'refreshTokens.deviceId': deviceId
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid refresh token'
      });
    }

    // Validate the refresh token
    if (!user.validateRefreshToken(refreshToken, deviceId)) {
      return res.status(401).json({
        error: 'Refresh token expired or invalid'
      });
    }

    // Clean expired tokens
    user.cleanExpiredRefreshTokens();

    // Generate new tokens (this also rotates the refresh token)
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user, deviceId);

    // Remove the old refresh token
    user.revokeRefreshToken(refreshToken);

    await user.save();

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      error: 'Server error during token refresh'
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken, deviceId, allDevices } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    if (allDevices) {
      // Logout from all devices
      user.revokeAllRefreshTokens();
    } else if (refreshToken) {
      // Logout from specific device
      user.revokeRefreshToken(refreshToken);
    } else if (deviceId) {
      // Logout by device ID
      user.refreshTokens = user.refreshTokens.filter(token => token.deviceId !== deviceId);
    }

    await user.save();

    res.json({
      success: true,
      message: allDevices ? 'Logged out from all devices' : 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Server error during logout'
    });
  }
};