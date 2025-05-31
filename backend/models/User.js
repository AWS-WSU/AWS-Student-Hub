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
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in normal queries
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
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
    
    while (true) {
      try {
        const existingUser = await this.constructor.findOne({ username });
        if (!existingUser) {
          this.username = username;
          break;
        }
        username = `${baseUsername}${counter}`;
        counter++;
      } catch (error) {
        next(error);
        return;
      }
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

const User = mongoose.model('User', userSchema);

module.exports = User; 