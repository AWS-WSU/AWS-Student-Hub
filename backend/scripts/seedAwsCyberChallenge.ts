#!/usr/bin/env bun

import mongoose from 'mongoose';

import env from '../src/config/env';
import logger from '../src/config/logger';
import Challenge from '../src/models/Challenge';
import User from '../src/models/User';

const log = logger.child({ module: 'seedAwsCyberChallenge' });

const challengeKey = 'aws_cloud_security_lab';

async function seedAwsCyberChallenge(): Promise<void> {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(env.MONGODB_URI);
  log.info('connected to mongodb.');

  const owner = await User.findOne({ role: { $in: ['superuser', 'admin'] }, status: 'active' })
    .sort({ role: -1, createdAt: 1 })
    .select('_id email role');

  if (!owner) {
    throw new Error('An active admin or superuser is required to seed the challenge.');
  }

  const challenge = await Challenge.findOneAndUpdate(
    { key: challengeKey },
    {
      $set: {
        key: challengeKey,
        slug: 'aws-cloud-security-lab',
        title: 'AWS Cloud Security Lab',
        summary: 'Use your assigned AWS workspace to retrieve the next challenge secret.',
        description:
          'Configure your AWS credentials, inspect your assigned S3 secret file, and submit the secret value to complete the lab.',
        instructions:
          'S3 bucket: wayne-aws-club-secrets\nSecret path: secrets/{username}.txt\nExpected file format: next_password=<secret>',
        status: 'published',
        kind: 'single',
        difficulty: 'medium',
        estimatedMinutes: 20,
        tags: ['aws', 's3', 'security'],
        publishedAt: new Date(),
        startsAt: null,
        endsAt: null,
        validation: {
          type: 'aws_secret',
          source: 'user_next_challenge_password',
          acceptedPrefixes: ['next_password='],
        },
        reward: {
          enabled: true,
          bits: 50,
          xpMode: 'custom',
          xpAmount: 30,
          activityName: 'AWS Cloud Security Lab',
          description: 'Completed AWS Cloud Security Lab',
          applyGroupMultipliers: true,
          applyPersonalMultipliers: true,
        },
        updatedBy: owner._id,
      },
      $setOnInsert: {
        version: 1,
        createdBy: owner._id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  log.info(`seeded challenge ${challenge.title} (${challenge.slug}).`);
  log.info(`owner: ${owner.email} (${owner.role}).`);
}

seedAwsCyberChallenge()
  .catch((error: unknown) => {
    log.error('failed to seed aws cyber challenge.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    log.info('disconnected from mongodb.');
  });
