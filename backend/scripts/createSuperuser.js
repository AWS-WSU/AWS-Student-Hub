#!/usr/bin/env node

/**
 * Bootstrap script to create the first superuser
 * Usage: node scripts/createSuperuser.js <email>
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function createSuperuser(email) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log('❌ User with email', email, 'not found');
      console.log('👉 User must register first before being promoted to superuser');
      process.exit(1);
    }

    if (user.role === 'superuser') {
      console.log('ℹ️  User', email, 'is already a superuser');
      process.exit(0);
    }

    await User.findByIdAndUpdate(user._id, { 
      role: 'superuser',
      status: 'active'
    });

    console.log('🎉 Successfully promoted', email, 'to superuser!');
    console.log('📊 User details:');
    console.log('   - Name:', user.fullName);
    console.log('   - Username:', user.username);
    console.log('   - Email:', user.email);
    console.log('   - Previous Role:', user.role);
    console.log('   - New Role: superuser');
    console.log('');
    console.log('🔐 User can now:');
    console.log('   - Access admin dashboard at /admin');
    console.log('   - Manage all users and roles');
    console.log('   - Create other admins and moderators');
    console.log('   - Ban/unban users');
    console.log('   - View system analytics');

  } catch (error) {
    console.error('❌ Error creating superuser:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔐 Disconnected from MongoDB');
    process.exit(0);
  }
}

const email = process.argv[2];

if (!email) {
  console.log('❌ Email address is required');
  console.log('');
  console.log('Usage:');
  console.log('   node scripts/createSuperuser.js <email>');
  console.log('');
  console.log('Example:');
  console.log('   node scripts/createSuperuser.js admin@example.com');
  console.log('');
  console.log('Note: User must register through the website first before being promoted');
  process.exit(1);
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.log('❌ Invalid email format');
  process.exit(1);
}

console.log('🚀 Creating superuser for:', email);
console.log('');

createSuperuser(email); 