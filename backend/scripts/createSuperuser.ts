import dotenv from 'dotenv';
import mongoose from 'mongoose';

import User from '../models/User';

dotenv.config();

async function createSuperuser(email: string): Promise<void> {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('connected to mongodb.');

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log(`user with email ${email} not found.`);
      console.log('user must register first before being promoted to superuser.');
      process.exit(1);
    }

    if (user.role === 'superuser') {
      console.log(`user ${email} is already a superuser.`);
      process.exit(0);
    }

    await User.findByIdAndUpdate(user._id, {
      role: 'superuser',
      status: 'active',
    });

    console.log(`successfully promoted ${email} to superuser.`);
    console.log('user details.');
    console.log(`name: ${user.fullName}.`);
    console.log(`username: ${user.username}.`);
    console.log(`email: ${user.email}.`);
    console.log(`previous role: ${user.role}.`);
    console.log('new role: superuser.');
    console.log('');
    console.log('user can now.');
    console.log('access admin dashboard at /admin.');
    console.log('manage all users and roles.');
    console.log('create other admins and moderators.');
    console.log('ban/unban users.');
    console.log('view system analytics.');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('error creating superuser.', message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('disconnected from mongodb.');
    process.exit(0);
  }
}

const email = process.argv[2];

if (!email) {
  console.log('email address is required.');
  console.log('');
  console.log('usage.');
  console.log('   npm run create-superuser -- <email>');
  console.log('');
  console.log('example.');
  console.log('   npm run create-superuser -- admin@example.com');
  console.log('');
  console.log('note: user must register through the website first before being promoted.');
  process.exit(1);
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.log('invalid email format.');
  process.exit(1);
}

console.log(`creating superuser for ${email}.`);
console.log('');

void createSuperuser(email);
