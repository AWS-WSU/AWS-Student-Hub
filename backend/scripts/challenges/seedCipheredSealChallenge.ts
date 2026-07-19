#!/usr/bin/env bun

import mongoose from 'mongoose';

import env from '../../src/config/env';
import logger from '../../src/config/logger';
import Challenge from '../../src/models/Challenge';
import User from '../../src/models/User';

const log = logger.child({ module: 'seedCipheredSealChallenge' });

const challengeKey = 'ciphered_seal_protocol';

async function seedCipheredSealChallenge(): Promise<void> {
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

  const routeConflict = await Challenge.findOne({
    key: { $ne: challengeKey },
    'validation.type': 'ciphered_seal',
    'validation.routeKey': '256027',
  }).select('key title');

  if (routeConflict) {
    throw new Error(
      `Route 256027 is already assigned to ${routeConflict.title} (${routeConflict.key}).`
    );
  }

  const challenge = await Challenge.findOneAndUpdate(
    { key: challengeKey },
    {
      $set: {
        key: challengeKey,
        slug: 'ciphered-seal-protocol',
        title: 'Ciphered Seal Protocol',
        summary:
          'Discover a concealed route, resolve two seals from your identifier, and invoke a personalized shrine sequence.',
        description:
          'The protocol begins with an image artifact. Inspect its original metadata to discover the shrine route, then use your assigned identifier, the Seal Calculator, and the Lore Book to determine the correct ward invocation.',
        instructions:
          'Download the original artifact and inspect its pixel width and height. Multiply those measurements to produce the numeric route key, then navigate to /challenge/<route-key>. At the shrine, use your displayed ID to resolve the seal state. The script has order, not just shape.',
        status: 'published',
        kind: 'multi_part',
        difficulty: 'hard',
        estimatedMinutes: 30,
        tags: ['logic', 'modulo', 'recon', 'personalized'],
        publishedAt: new Date(),
        startsAt: null,
        endsAt: null,
        rewardIntegrationInstanceId: null,
        validation: {
          type: 'ciphered_seal',
          routeKey: '256027',
          imagePath: '/challenges/ciphered-seal/shrine-map.png',
          imageWidth: 509,
          imageHeight: 503,
          successMessage: 'The shrine accepts the invocation sequence.',
        },
        reward: {
          enabled: true,
          bits: 50,
          xpMode: 'custom',
          xpAmount: 30,
          activityName: 'Ciphered Seal Protocol',
          description: 'Completed Ciphered Seal Protocol',
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
        createdBy: owner._id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  log.info(`seeded challenge ${challenge.title} (${challenge.slug}).`);
  log.info(`owner: ${owner.email} (${owner.role}).`);
}

seedCipheredSealChallenge()
  .catch((error: unknown) => {
    log.error('failed to seed Ciphered Seal Protocol.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    log.info('disconnected from mongodb.');
  });
