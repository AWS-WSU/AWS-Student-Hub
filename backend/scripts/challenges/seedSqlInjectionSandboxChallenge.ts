#!/usr/bin/env bun

import mongoose from 'mongoose';

import env from '../../src/config/env';
import logger from '../../src/config/logger';
import Challenge from '../../src/models/Challenge';
import User from '../../src/models/User';

const log = logger.child({ module: 'seedSqlInjectionSandboxChallenge' });
const challengeKey = 'sql_injection_sandbox';

async function seedSqlInjectionSandboxChallenge(): Promise<void> {
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
        slug: 'sql-injection-sandbox',
        title: 'SQL Injection Sandbox',
        summary:
          'Exploit an unsafe archive search query to recover a restricted record from an isolated database.',
        description:
          'A toy archive search interpolates input directly into SQL. Inspect the generated statement, alter its logic, and recover the personalized flag stored in a row that normal searches cannot return.',
        instructions:
          'Search the archive and inspect the SQL statement produced by the application. Determine how quoted input changes the WHERE clause. Recover the restricted record and submit its FLAG{...} value. The sandbox contains only synthetic data and accepts one SELECT statement at a time.',
        source: 'curated',
        status: 'published',
        kind: 'single',
        difficulty: 'medium',
        estimatedMinutes: 15,
        tags: ['sql', 'security', 'injection', 'web'],
        publishedAt: new Date(),
        startsAt: null,
        endsAt: null,
        rewardIntegrationInstanceId: null,
        validation: {
          type: 'sql_injection',
          tableName: 'archive_records',
          maxInputLength: 180,
          maxRows: 20,
          successMessage: 'Restricted record recovered. SQL injection challenge complete.',
        },
        reward: {
          enabled: true,
          bits: 50,
          xpMode: 'custom',
          xpAmount: 30,
          activityName: 'SQL Injection Sandbox',
          description: 'Completed SQL Injection Sandbox',
          applyGroupMultipliers: true,
          applyPersonalMultipliers: true,
        },
        updatedBy: owner._id,
      },
      $unset: {
        maxAttempts: '',
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

seedSqlInjectionSandboxChallenge()
  .catch((error: unknown) => {
    log.error('failed to seed SQL Injection Sandbox.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    log.info('disconnected from mongodb.');
  });
