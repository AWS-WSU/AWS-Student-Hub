#!/usr/bin/env bun

import mongoose from 'mongoose';

import env from '../../src/config/env';
import logger from '../../src/config/logger';
import Challenge from '../../src/models/Challenge';
import User from '../../src/models/User';

const log = logger.child({ module: 'seedPcapForensicsChallenge' });
const challengeKey = 'pcap_forensics';

async function seedPcapForensicsChallenge(): Promise<void> {
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
        slug: 'pcap-forensics',
        title: 'PCAP Forensics',
        summary:
          'Analyze DNS and HTTP traffic in Wireshark to recover a personalized flag from a packet capture.',
        description:
          'A student workstation contacted an unfamiliar telemetry service. Investigate the supplied network capture, identify the relevant protocol activity, and recover the evidence embedded in the outbound request.',
        instructions:
          'Start the challenge and download the PCAP evidence file. Open it in Wireshark, review the protocol hierarchy, and use display filters such as dns and http.request to narrow the traffic. Inspect request fields or follow the relevant TCP stream, then submit the complete FLAG{...} value you recover.',
        source: 'curated',
        status: 'published',
        kind: 'single',
        difficulty: 'medium',
        estimatedMinutes: 20,
        tags: ['pcap', 'wireshark', 'forensics', 'networking', 'security'],
        publishedAt: new Date(),
        startsAt: null,
        endsAt: null,
        rewardIntegrationInstanceId: null,
        validation: {
          type: 'pcap_forensics',
          fileName: 'network-evidence.pcap',
          successMessage: 'Packet evidence validated. PCAP forensics challenge complete.',
        },
        reward: {
          enabled: true,
          bits: 50,
          xpMode: 'custom',
          xpAmount: 30,
          activityName: 'PCAP Forensics',
          description: 'Completed PCAP Forensics',
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

seedPcapForensicsChallenge()
  .catch((error: unknown) => {
    log.error('failed to seed PCAP Forensics.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    log.info('disconnected from mongodb.');
  });
