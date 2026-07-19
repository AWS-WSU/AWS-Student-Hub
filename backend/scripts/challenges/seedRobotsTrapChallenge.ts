#!/usr/bin/env bun

import mongoose from 'mongoose';

import env from '../../src/config/env';
import logger from '../../src/config/logger';
import Challenge from '../../src/models/Challenge';
import User from '../../src/models/User';

const log = logger.child({ module: 'seedRobotsTrapChallenge' });

const challengeKey = 'robots_txt_trap';

async function seedRobotsTrapChallenge(): Promise<void> {
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
        slug: 'robots-txt-trap',
        title: 'Robots.txt Trap',
        summary: 'Inspect crawler instructions to find a hidden vault route.',
        description:
          'A robots.txt file tells crawlers where not to go. It does not protect private routes. Find the disallowed vault path and submit the flag shown there.',
        instructions:
          'Start at /robots.txt.\nFind the disallowed vault route.\nOpen that route directly and submit the flag value.',
        source: 'curated',
        status: 'published',
        kind: 'single',
        difficulty: 'easy',
        estimatedMinutes: 8,
        tags: ['web', 'recon', 'robots'],
        publishedAt: new Date(),
        startsAt: null,
        endsAt: null,
        validation: {
          type: 'static_secret',
          expectedValueHash: '5dd42750ab5a1dad69cd76a964df82eaf7315ed6b7f8d9d7aaf3cb1f70fa6fe2',
          hashAlgorithm: 'sha256',
          trimSubmission: true,
          caseSensitive: true,
        },
        reward: {
          enabled: true,
          bits: 25,
          xpMode: 'custom',
          xpAmount: 15,
          activityName: 'Robots.txt Trap',
          description: 'Completed Robots.txt Trap',
          applyGroupMultipliers: true,
          applyPersonalMultipliers: true,
        },
        updatedBy: owner._id,
      },
      $setOnInsert: {
        version: 1,
        assignmentMigrationVersion: 1,
        createdBy: owner._id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  log.info(`seeded challenge ${challenge.title} (${challenge.slug}).`);
  log.info(`owner: ${owner.email} (${owner.role}).`);
}

seedRobotsTrapChallenge()
  .catch((error: unknown) => {
    log.error('failed to seed robots trap challenge.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    log.info('disconnected from mongodb.');
  });
