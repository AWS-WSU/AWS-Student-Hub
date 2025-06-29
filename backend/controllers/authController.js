const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { sendResetCode } = require('../services/emailService');
const Filter = require('bad-words');

const generateToken = (user, rememberMe = false) => {
  const expiresIn = rememberMe ? '30d' : '24h';
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn }
  );
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
    .replace(/[^a-z]/g, ''); // remove non-alphabetic
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

    const { fullName, email, password, username: providedUsername, rememberMe } = req.body;

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

    // Check for profanity in user inputs
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

    await user.save();

    const token = generateToken(user, rememberMe);

    user.lastLogin = Date.now();
    await user.save();

    res.status(201).json({
      token,
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

    const { email, password, rememberMe } = req.body;

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

    const token = generateToken(user, rememberMe);

    setImmediate(() => {
      user.lastLogin = Date.now();
      user.save().catch(err => console.error('Failed to update lastLogin:', err));
    });

    res.json({
      token,
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
    const { fullName, username, wantsEmails } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check for profanity in username and fullName
    if (username && containsProfanity(username)) {
      return res.status(400).json({
        success: false,
        message: "Hey, that's not nice. Try again."
      });
    }

    if (fullName && containsProfanity(fullName)) {
      return res.status(400).json({
        success: false,
        message: "Hey, that's not nice. Try again."
      });
    }

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ 
        username,
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (username !== undefined) user.username = username;
    if (wantsEmails !== undefined) user.wantsEmails = wantsEmails;

    await user.save();

    res.json({
      success: true,
      user: user.toSafeObject(),
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Update failed. Please check your information.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile'
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
      // Don't reveal that account doesn't exist - always return success message
      return res.json({
        success: true,
        message: isEmail ? 
          'If an account exists with this email, a reset code has been sent.' :
          'If an account exists with this username, you will need to verify your email address.'
      });
    }

    if (user.auth0Id) {
      // Don't reveal auth method - return generic message
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
      // Don't reveal mismatch - always return success message
      return res.json({
        success: true,
        message: 'If the email matches the username, a reset code has been sent.'
      });
    }

    if (user.auth0Id) {
      // Don't reveal auth method - return generic message
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