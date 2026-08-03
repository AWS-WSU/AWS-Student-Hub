#!/usr/bin/env bun

import mongoose, { Types } from 'mongoose';

import env from '../../src/config/env';
import logger from '../../src/config/logger';
import Challenge from '../../src/models/Challenge';
import ChallengeAssignment, {
  ChallengeAssignmentStatus,
} from '../../src/models/ChallengeAssignment';
import ChallengeProgress from '../../src/models/ChallengeProgress';
import ChallengeSubmission from '../../src/models/ChallengeSubmission';
import RewardIntegrationInstance from '../../src/models/RewardIntegrationInstance';
import User from '../../src/models/User';

const log = logger.child({ module: 'migrateChallengeCatalogAssignments' });
const curatedKeys = new Set([
  'aws_cloud_security_lab',
  'robots_txt_trap',
  'ciphered_seal_protocol',
  'sql_injection_sandbox',
]);

const toAssignmentStatus = (status: string): ChallengeAssignmentStatus => {
  if (status === 'published' || status === 'archived') return status;
  return 'draft';
};

async function migrateChallengeCatalogAssignments(): Promise<void> {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  await mongoose.connect(env.MONGODB_URI);
  log.info('connected to mongodb.');

  const [challenges, allInstances, activeInstances] = await Promise.all([
    Challenge.find(),
    RewardIntegrationInstance.find(),
    RewardIntegrationInstance.find({ active: true }),
  ]);
  let assignmentsCreated = 0;
  const challengeById = new Map(
    challenges.map((challenge) => [challenge._id.toString(), challenge])
  );

  for (const challenge of challenges) {
    challenge.source = curatedKeys.has(challenge.key) ? 'curated' : 'custom';
    if (challenge.assignmentMigrationVersion === 1) {
      await challenge.save();
      continue;
    }
    const legacyInstanceId = challenge.rewardIntegrationInstanceId;
    const targetInstances = legacyInstanceId
      ? allInstances.filter((instance) => instance._id.equals(legacyInstanceId))
      : challenge.status === 'published'
        ? activeInstances
        : [];

    for (const instance of targetInstances) {
      const result = await ChallengeAssignment.updateOne(
        {
          challengeId: challenge._id,
          rewardIntegrationInstanceId: instance._id,
        },
        {
          $set: {
            challengeVersion: challenge.version,
            status: toAssignmentStatus(challenge.status),
            startsAt: challenge.startsAt || null,
            endsAt: challenge.endsAt || null,
            maxAttempts: challenge.maxAttempts,
            reward: challenge.reward,
            publishedAt:
              challenge.status === 'published' ? challenge.publishedAt || new Date() : null,
            archivedAt: challenge.status === 'archived' ? challenge.archivedAt || new Date() : null,
            updatedBy: challenge.updatedBy || challenge.createdBy,
          },
          $setOnInsert: {
            assignedBy: challenge.createdBy,
          },
        },
        { upsert: true }
      );
      if (result.upsertedCount > 0) assignmentsCreated += 1;
    }

    challenge.assignmentMigrationVersion = 1;
    await challenge.save();
  }

  const legacyProgress = await ChallengeProgress.find({
    $or: [{ assignmentId: null }, { assignmentId: { $exists: false } }],
  });
  const userIds = Array.from(new Set(legacyProgress.map((progress) => progress.userId.toString())));
  const users = await User.find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } });
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  let progressMigrated = 0;

  for (const progress of legacyProgress) {
    const user = userById.get(progress.userId.toString());
    if (!user?.rewardIntegrationInstanceId) continue;
    let assignment = await ChallengeAssignment.findOne({
      challengeId: progress.challengeId,
      rewardIntegrationInstanceId: user.rewardIntegrationInstanceId,
    });
    if (!assignment) {
      const challenge = challengeById.get(progress.challengeId.toString());
      const instanceExists = allInstances.some((instance) =>
        instance._id.equals(user.rewardIntegrationInstanceId as Types.ObjectId)
      );
      if (!challenge || !instanceExists) continue;
      assignment = await ChallengeAssignment.findOneAndUpdate(
        {
          challengeId: challenge._id,
          rewardIntegrationInstanceId: user.rewardIntegrationInstanceId,
        },
        {
          $set: {
            challengeVersion: challenge.version,
            status: 'archived',
            startsAt: challenge.startsAt || null,
            endsAt: challenge.endsAt || null,
            maxAttempts: challenge.maxAttempts,
            reward: challenge.reward,
            archivedAt: challenge.archivedAt || new Date(),
            updatedBy: challenge.updatedBy || challenge.createdBy,
          },
          $setOnInsert: { assignedBy: challenge.createdBy },
        },
        { new: true, upsert: true }
      );
      assignmentsCreated += 1;
    }

    progress.assignmentId = assignment._id;
    progress.rewardIntegrationInstanceId = assignment.rewardIntegrationInstanceId;
    await progress.save();
    await ChallengeSubmission.updateMany(
      { progressId: progress._id },
      {
        $set: {
          assignmentId: assignment._id,
          rewardIntegrationInstanceId: assignment.rewardIntegrationInstanceId,
        },
      }
    );
    progressMigrated += 1;
  }

  const progressIndexes = await ChallengeProgress.collection.indexes();
  const legacyUniqueIndex = progressIndexes.find((index) => {
    const keys = Object.keys(index.key);
    return (
      index.unique === true &&
      keys.length === 2 &&
      index.key.userId === 1 &&
      index.key.challengeId === 1
    );
  });
  if (legacyUniqueIndex?.name) {
    await ChallengeProgress.collection.dropIndex(legacyUniqueIndex.name);
  }
  await ChallengeProgress.createIndexes();
  await ChallengeAssignment.createIndexes();

  log.info(
    `migration complete: ${challenges.length} catalog records, ${assignmentsCreated} new assignments, ${progressMigrated} progress records migrated.`
  );
}

migrateChallengeCatalogAssignments()
  .catch((error: unknown) => {
    log.error('challenge catalog migration failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    log.info('disconnected from mongodb.');
  });
