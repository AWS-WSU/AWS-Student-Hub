import { Types } from 'mongoose';

import Challenge, { IChallengeDocument, IChallengeRewardConfig } from '../models/Challenge';
import ChallengeAssignment, {
  ChallengeAssignmentStatus,
  IChallengeAssignmentDocument,
} from '../models/ChallengeAssignment';
import ChallengeProgress, { ChallengeProgressStatus } from '../models/ChallengeProgress';
import RewardIntegrationInstance from '../models/RewardIntegrationInstance';
import { ChallengeServiceError, toAdminChallengeDto } from './challengeService';

interface ChallengeAssignmentMutationInput {
  challengeId?: string;
  status?: ChallengeAssignmentStatus;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  maxAttempts?: number | null;
  hint?: string | null;
  reward?: Partial<IChallengeRewardConfig>;
}

interface AssignmentProgressSummary {
  total: number;
  completed: number;
  pendingReview: number;
}

interface AssignmentProgressAggregation {
  _id: Types.ObjectId;
  total: number;
  completed: number;
  pendingReview: number;
}

const assignmentStatuses: ChallengeAssignmentStatus[] = ['draft', 'published', 'archived'];
const MAX_ASSIGNMENT_HINT_LENGTH = 2000;
const completedStatuses: ChallengeProgressStatus[] = [
  'completed',
  'reward_pending',
  'reward_sent',
  'reward_failed',
];

const cleanString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
};

const normalizeAssignmentStatus = (
  value: unknown,
  fallback?: ChallengeAssignmentStatus
): ChallengeAssignmentStatus => {
  if (value === undefined && fallback) return fallback;
  if (
    typeof value === 'string' &&
    assignmentStatuses.includes(value as ChallengeAssignmentStatus)
  ) {
    return value as ChallengeAssignmentStatus;
  }
  throw new ChallengeServiceError(
    'Invalid challenge assignment status.',
    'INVALID_CHALLENGE_INPUT',
    400
  );
};

const normalizeMaxAttempts = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 1) {
    throw new ChallengeServiceError(
      'Maximum attempts must be a positive whole number.',
      'INVALID_CHALLENGE_INPUT',
      400
    );
  }
  return normalized;
};

const normalizeHint = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') {
    throw new ChallengeServiceError('Challenge hint must be text.', 'INVALID_CHALLENGE_INPUT', 400);
  }

  const hint = value.trim();
  if (hint.length > MAX_ASSIGNMENT_HINT_LENGTH) {
    throw new ChallengeServiceError(
      `Challenge hint cannot exceed ${MAX_ASSIGNMENT_HINT_LENGTH} characters.`,
      'INVALID_CHALLENGE_INPUT',
      400
    );
  }
  return hint;
};

const parseDate = (value: string | Date | null | undefined): Date | null | undefined => {
  if (value === null) return null;
  if (value === undefined || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ChallengeServiceError('Invalid assignment date.', 'INVALID_CHALLENGE_INPUT', 400);
  }
  return date;
};

const normalizeReward = (
  reward: unknown,
  fallback: IChallengeRewardConfig
): IChallengeRewardConfig => {
  if (!isRecord(reward)) return { ...fallback };

  const stats = isRecord(reward.stats)
    ? {
        multiplier: normalizeNumber(reward.stats.multiplier),
        luck: normalizeNumber(reward.stats.luck),
        shield: normalizeNumber(reward.stats.shield),
        discount: normalizeNumber(reward.stats.discount),
      }
    : fallback.stats;
  const xpMode = ['none', 'classroom', 'custom'].includes(String(reward.xpMode))
    ? (reward.xpMode as IChallengeRewardConfig['xpMode'])
    : fallback.xpMode;
  const bits = normalizeNumber(reward.bits);
  const xpAmount = normalizeNumber(reward.xpAmount);

  return {
    enabled: typeof reward.enabled === 'boolean' ? reward.enabled : fallback.enabled,
    bits: bits === undefined ? fallback.bits : Math.max(0, bits),
    xpAmount: xpAmount === undefined ? fallback.xpAmount : Math.max(0, xpAmount),
    xpMode,
    activityName: cleanString(reward.activityName) || fallback.activityName,
    description: cleanString(reward.description) || fallback.description,
    stats,
    applyGroupMultipliers:
      typeof reward.applyGroupMultipliers === 'boolean'
        ? reward.applyGroupMultipliers
        : fallback.applyGroupMultipliers,
    applyPersonalMultipliers:
      typeof reward.applyPersonalMultipliers === 'boolean'
        ? reward.applyPersonalMultipliers
        : fallback.applyPersonalMultipliers,
  };
};

const validateWindow = (startsAt?: Date | null, endsAt?: Date | null): void => {
  if (startsAt && endsAt && startsAt >= endsAt) {
    throw new ChallengeServiceError(
      'Assignment end date must be after its start date.',
      'INVALID_CHALLENGE_INPUT',
      400
    );
  }
};

const ensureInstance = async (instanceId: string) => {
  if (!Types.ObjectId.isValid(instanceId)) {
    throw new ChallengeServiceError(
      'Reward integration instance was not found.',
      'INVALID_CHALLENGE_INPUT',
      404
    );
  }

  const instance = await RewardIntegrationInstance.findById(instanceId);
  if (!instance) {
    throw new ChallengeServiceError(
      'Reward integration instance was not found.',
      'INVALID_CHALLENGE_INPUT',
      404
    );
  }
  return instance;
};

const ensureAssignment = async (
  instanceId: string,
  assignmentId: string
): Promise<IChallengeAssignmentDocument> => {
  if (!Types.ObjectId.isValid(instanceId) || !Types.ObjectId.isValid(assignmentId)) {
    throw new ChallengeServiceError(
      'Challenge assignment was not found.',
      'CHALLENGE_ASSIGNMENT_NOT_FOUND',
      404
    );
  }

  const assignment = await ChallengeAssignment.findOne({
    _id: new Types.ObjectId(assignmentId),
    rewardIntegrationInstanceId: new Types.ObjectId(instanceId),
  });
  if (!assignment) {
    throw new ChallengeServiceError(
      'Challenge assignment was not found.',
      'CHALLENGE_ASSIGNMENT_NOT_FOUND',
      404
    );
  }
  return assignment;
};

const getProgressSummaries = async (
  assignmentIds: Types.ObjectId[]
): Promise<Map<string, AssignmentProgressSummary>> => {
  if (!assignmentIds.length) return new Map();

  const rows = await ChallengeProgress.aggregate<AssignmentProgressAggregation>([
    { $match: { assignmentId: { $in: assignmentIds } } },
    {
      $group: {
        _id: '$assignmentId',
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $in: ['$status', completedStatuses] }, 1, 0] },
        },
        pendingReview: {
          $sum: { $cond: [{ $eq: ['$status', 'pending_review'] }, 1, 0] },
        },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      row._id.toString(),
      { total: row.total, completed: row.completed, pendingReview: row.pendingReview },
    ])
  );
};

const toAssignmentDto = (
  assignment: IChallengeAssignmentDocument,
  challenge: IChallengeDocument | null,
  progress: AssignmentProgressSummary = { total: 0, completed: 0, pendingReview: 0 }
) => {
  if (!challenge) return null;

  return {
    id: assignment._id.toString(),
    challengeId: assignment.challengeId.toString(),
    rewardIntegrationInstanceId: assignment.rewardIntegrationInstanceId.toString(),
    challengeVersion: assignment.challengeVersion,
    status: assignment.status,
    startsAt: assignment.startsAt,
    endsAt: assignment.endsAt,
    maxAttempts: assignment.maxAttempts,
    hint: assignment.hint || undefined,
    reward: assignment.reward,
    publishedAt: assignment.publishedAt,
    archivedAt: assignment.archivedAt,
    assignedBy: assignment.assignedBy.toString(),
    updatedBy: assignment.updatedBy?.toString(),
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    progress,
    challenge: toAdminChallengeDto(challenge),
  };
};

export const listInstanceChallengeAssignments = async (instanceId: string) => {
  await ensureInstance(instanceId);
  const assignments = await ChallengeAssignment.find({
    rewardIntegrationInstanceId: new Types.ObjectId(instanceId),
  }).sort({ updatedAt: -1 });
  const challengeIds = assignments.map((assignment) => assignment.challengeId);
  const [challenges, progressSummaries] = await Promise.all([
    Challenge.find({ _id: { $in: challengeIds } }),
    getProgressSummaries(assignments.map((assignment) => assignment._id)),
  ]);
  const challengeById = new Map(
    challenges.map((challenge) => [challenge._id.toString(), challenge])
  );

  return {
    items: assignments
      .map((assignment) =>
        toAssignmentDto(
          assignment,
          challengeById.get(assignment.challengeId.toString()) || null,
          progressSummaries.get(assignment._id.toString())
        )
      )
      .filter((assignment): assignment is NonNullable<typeof assignment> => Boolean(assignment)),
  };
};

export const createInstanceChallengeAssignment = async (
  instanceId: string,
  input: ChallengeAssignmentMutationInput,
  adminUserId: string
) => {
  const instance = await ensureInstance(instanceId);
  if (!instance.active) {
    throw new ChallengeServiceError(
      'Activate this reward instance before assigning challenges.',
      'INVALID_CHALLENGE_INPUT',
      409
    );
  }

  const challengeId = cleanString(input.challengeId);
  if (!Types.ObjectId.isValid(challengeId)) {
    throw new ChallengeServiceError('Challenge was not found.', 'CHALLENGE_NOT_FOUND', 404);
  }
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    throw new ChallengeServiceError('Challenge was not found.', 'CHALLENGE_NOT_FOUND', 404);
  }
  if (challenge.status !== 'published') {
    throw new ChallengeServiceError(
      'Publish the catalog challenge before assigning it to a classroom.',
      'CHALLENGE_NOT_PUBLISHED',
      409
    );
  }

  const existing = await ChallengeAssignment.exists({
    challengeId: challenge._id,
    rewardIntegrationInstanceId: instance._id,
  });
  if (existing) {
    throw new ChallengeServiceError(
      'This challenge is already assigned to the classroom.',
      'CHALLENGE_ASSIGNMENT_EXISTS',
      409
    );
  }

  const status = normalizeAssignmentStatus(input.status, 'draft');
  const startsAt = parseDate(input.startsAt) ?? challenge.startsAt ?? null;
  const endsAt = parseDate(input.endsAt) ?? challenge.endsAt ?? null;
  validateWindow(startsAt, endsAt);
  const maxAttempts =
    input.maxAttempts === undefined
      ? challenge.maxAttempts
      : normalizeMaxAttempts(input.maxAttempts);
  const reward = normalizeReward(input.reward, challenge.reward);
  const hint = normalizeHint(input.hint);
  const now = new Date();

  const assignment = await ChallengeAssignment.create({
    challengeId: challenge._id,
    rewardIntegrationInstanceId: instance._id,
    challengeVersion: challenge.version,
    status,
    startsAt,
    endsAt,
    maxAttempts,
    hint,
    reward,
    publishedAt: status === 'published' ? now : null,
    archivedAt: status === 'archived' ? now : null,
    assignedBy: new Types.ObjectId(adminUserId),
  });

  return toAssignmentDto(assignment, challenge);
};

export const updateInstanceChallengeAssignment = async (
  instanceId: string,
  assignmentId: string,
  input: ChallengeAssignmentMutationInput,
  adminUserId: string
) => {
  const instance = await ensureInstance(instanceId);
  const assignment = await ensureAssignment(instanceId, assignmentId);
  const challenge = await Challenge.findById(assignment.challengeId);
  if (!challenge) {
    throw new ChallengeServiceError('Challenge was not found.', 'CHALLENGE_NOT_FOUND', 404);
  }

  if (input.status !== undefined) {
    const status = normalizeAssignmentStatus(input.status);
    if (status === 'published' && !instance.active) {
      throw new ChallengeServiceError(
        'Activate this reward instance before publishing classroom challenges.',
        'INVALID_CHALLENGE_INPUT',
        409
      );
    }
    if (status === 'published' && challenge.status !== 'published') {
      throw new ChallengeServiceError(
        'Publish the catalog challenge before publishing this assignment.',
        'CHALLENGE_NOT_PUBLISHED',
        409
      );
    }
    assignment.status = status;
    if (status === 'published') {
      assignment.publishedAt = assignment.publishedAt || new Date();
      assignment.archivedAt = null;
    }
    if (status === 'archived') assignment.archivedAt = new Date();
  }

  if (input.startsAt !== undefined) assignment.startsAt = parseDate(input.startsAt) || null;
  if (input.endsAt !== undefined) assignment.endsAt = parseDate(input.endsAt) || null;
  validateWindow(assignment.startsAt, assignment.endsAt);
  if (input.maxAttempts !== undefined) {
    assignment.maxAttempts = normalizeMaxAttempts(input.maxAttempts);
  }
  if (input.hint !== undefined) {
    assignment.hint = normalizeHint(input.hint);
  }
  if (input.reward !== undefined) {
    assignment.reward = normalizeReward(input.reward, assignment.reward);
  }

  assignment.challengeVersion = challenge.version;
  assignment.updatedBy = new Types.ObjectId(adminUserId);
  await assignment.save();
  const progressSummary = (await getProgressSummaries([assignment._id])).get(
    assignment._id.toString()
  );
  return toAssignmentDto(assignment, challenge, progressSummary);
};

export const removeInstanceChallengeAssignment = async (
  instanceId: string,
  assignmentId: string,
  adminUserId: string
) => {
  const assignment = await ensureAssignment(instanceId, assignmentId);
  const progressCount = await ChallengeProgress.countDocuments({ assignmentId: assignment._id });

  if (progressCount > 0) {
    assignment.status = 'archived';
    assignment.archivedAt = new Date();
    assignment.updatedBy = new Types.ObjectId(adminUserId);
    await assignment.save();
    return {
      removed: false as const,
      archived: true as const,
      assignmentId: assignment._id.toString(),
      progressCount,
    };
  }

  await ChallengeAssignment.deleteOne({ _id: assignment._id });
  return {
    removed: true as const,
    archived: false as const,
    assignmentId: assignment._id.toString(),
    progressCount: 0,
  };
};
