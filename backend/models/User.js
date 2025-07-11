const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot be more than 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Full name must be at least 2 characters long']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false
  },
  auth0Id: {
    type: String,
    sparse: true,
    unique: true
  },
  profilePicture: {
    type: String,
    default: '/account.svg'
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [500, 'Bio cannot be more than 500 characters'],
    default: ''
  },
  major: {
    type: String,
    trim: true,
    maxlength: [100, 'Major cannot be more than 100 characters'],
    default: ''
  },
  grade: {
    type: String,
    enum: ['', 'Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Other'],
    default: ''
  },
  programmingLanguages: [{
    type: String,
    trim: true
  }],
  profileSetupCompleted: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['member', 'moderator', 'admin', 'superuser'],
    default: 'member'
  },
  status: {
    type: String,
    enum: ['active', 'banned', 'suspended'],
    default: 'active'
  },
  bannedAt: {
    type: Date,
    default: null
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  banReason: {
    type: String,
    default: null
  },
  wantsEmails: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  refreshTokens: [{
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    deviceId: {
      type: String,
      required: true
    }
  }],
  tokenVersion: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre('save', async function(next) {
  if (this.isNew && !this.username) {
    let baseUsername = this.email.split('@')[0];
    let username = baseUsername;
    let counter = 1;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        const existingUser = await this.constructor.findOne({ username });
        if (!existingUser) {
          this.username = username;
          break;
        }
        username = `${baseUsername}${counter}`;
        counter++;
        attempts++;
      } catch (error) {
        next(error);
        return;
      }
    }
    
    if (attempts >= maxAttempts) {
      this.username = `${baseUsername}_${Date.now()}`;
    }
  }
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

userSchema.methods.generateResetToken = function() {
  const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
  this.resetPasswordToken = resetToken;
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

userSchema.methods.clearResetToken = function() {
  this.resetPasswordToken = undefined;
  this.resetPasswordExpires = undefined;
};

userSchema.methods.generateRefreshToken = function(deviceId) {
  const crypto = require('crypto');
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  // Clean up old tokens for this device
  this.refreshTokens = this.refreshTokens.filter(
    token => token.deviceId !== deviceId && token.expiresAt > new Date()
  );
  
  // Add new refresh token
  this.refreshTokens.push({
    token: refreshToken,
    createdAt: new Date(),
    expiresAt,
    deviceId
  });
  
  // Keep only the 5 most recent tokens
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
  }
  
  return refreshToken;
};

userSchema.methods.validateRefreshToken = function(token, deviceId) {
  const tokenEntry = this.refreshTokens.find(
    t => t.token === token && t.deviceId === deviceId && t.expiresAt > new Date()
  );
  return !!tokenEntry;
};

userSchema.methods.revokeRefreshToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(t => t.token !== token);
};

userSchema.methods.revokeAllRefreshTokens = function() {
  this.refreshTokens = [];
  this.tokenVersion += 1;
};

userSchema.methods.cleanExpiredRefreshTokens = function() {
  this.refreshTokens = this.refreshTokens.filter(token => token.expiresAt > new Date());
};

const User = mongoose.model('User', userSchema);

module.exports = User;