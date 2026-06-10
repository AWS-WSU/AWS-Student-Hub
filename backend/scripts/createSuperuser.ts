import dotenv from 'dotenv';
import mongoose from 'mongoose';

import User from '../models/User';
import logger from '../config/logger';

const log = logger.child({ module: 'createSuperuser' });

dotenv.config();

async function createSuperuser(email: string): Promise<void> {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    log.info('connected to mongodb.');

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      log.info(`user with email ${email} not found.`);
      log.info('user must register first before being promoted to superuser.');
      process.exit(1);
    }

    if (user.role === 'superuser') {
      log.info(`user ${email} is already a superuser.`);
      process.exit(0);
    }

    await User.findByIdAndUpdate(user._id, {
      role: 'superuser',
      status: 'active',
    });

    log.info(`successfully promoted ${email} to superuser.`);
    log.info('user details.');
    log.info(`name: ${user.fullName}.`);
    log.info(`username: ${user.username}.`);
    log.info(`email: ${user.email}.`);
    log.info(`previous role: ${user.role}.`);
    log.info('new role: superuser.');
    log.info('');
    log.info('user can now.');
    log.info('access admin dashboard at /admin.');
    log.info('manage all users and roles.');
    log.info('create other admins and moderators.');
    log.info('ban/unban users.');
    log.info('view system analytics.');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('error creating superuser.', message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log.info('disconnected from mongodb.');
    process.exit(0);
  }
}

const email = process.argv[2];

if (!email) {
  log.info('email address is required.');
  log.info('');
  log.info('usage.');
  log.info('   bun run create-superuser -- <email>');
  log.info('');
  log.info('example.');
  log.info('   bun run create-superuser -- admin@example.com');
  log.info('');
  log.info('note: user must register through the website first before being promoted.');
  process.exit(1);
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  log.info('invalid email format.');
  process.exit(1);
}

log.info(`creating superuser for ${email}.`);
log.info('');

void createSuperuser(email);
