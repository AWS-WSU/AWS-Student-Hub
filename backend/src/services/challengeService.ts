import { Types } from 'mongoose';

import Challenge, {
  ChallengeDifficulty,
  ChallengeKind,
  ChallengeStatus,
  ChallengeXpMode,
  IChallengeDocument,
  IChallengeRewardConfig,
} from '../models/Challenge';
import ChallengeAssignment, { IChallengeAssignmentDocument } from '../models/ChallengeAssignment';
import ChallengeProgress, {
  ChallengeProgressStatus,
  IChallengeProgressDocument,
} from '../models/ChallengeProgress';
import ChallengeSubmission, {
  ChallengeSubmissionStatus,
  IChallengeSubmissionDocument,
} from '../models/ChallengeSubmission';
import RewardIntegrationInstance from '../models/RewardIntegrationInstance';
import User, { IUserDocument } from '../models/User';
import {
  buildChallengeCompletionEvent,
  grantChallengeCompletionReward,
  hasRewardIdentity,
  RewardGrantResult,
} from './challengeRewardService';
import {
  ChallengeValidatorError,
  prepareChallengeValidationConfigForStorage,
  sanitizeChallengeSubmissionPayload,
  validateChallengeSubmission,
} from './challengeValidatorService';
import {
  buildCipheredSealPublicState,
  CIPHERED_SEAL_VALIDATOR_TYPE,
  getCipheredSealPublicExperience,
  resolveSubmittedCipheredSealSeed,
} from './cipheredSealService';
import { getPrizeversityStatus } from './rewardIntegrationService';
import {
  getSqlInjectionPublicExperience,
  runSqlInjectionSandboxQuery,
  SQL_INJECTION_VALIDATOR_TYPE,
} from './sqlInjectionSandboxService';
import {
  buildPcapForensicsCapture,
  getPcapForensicsPublicExperience,
  PCAP_FORENSICS_VALIDATOR_TYPE,
} from './pcapForensicsService';

export type ChallengeErrorCode =
  | 'CHALLENGE_NOT_FOUND'
  | 'CHALLENGE_NOT_PUBLISHED'
  | 'REWARD_LINK_REQUIRED'
  | 'MAX_ATTEMPTS_REACHED'
  | 'VALIDATION_FAILED'
  | 'VALIDATOR_ERROR'
  | 'CHALLENGE_DELETE_BLOCKED'
  | 'CHALLENGE_ASSIGNMENT_NOT_FOUND'
  | 'CHALLENGE_ASSIGNMENT_EXISTS'
  | 'SUBMISSION_NOT_FOUND'
  | 'SUBMISSION_NOT_REVIEWABLE'
  | 'INVALID_CHALLENGE_INPUT';

export class ChallengeServiceError extends Error {
  status: number;
  code: ChallengeErrorCode;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ChallengeErrorCode,
    status = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ChallengeServiceError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ChallengeListOptions {
  userId?: string;
  tag?: string;
  difficulty?: ChallengeDifficulty;
}

interface AdminChallengeListOptions {
  status?: ChallengeStatus;
  search?: string;
  limit?: number;
  page?: number;
}

interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

interface RewardLinkSummary {
  required: boolean;
  linked: boolean;
  configured: boolean;
  requiredInstanceId?: string | null;
  linkedInstanceId?: string | null;
}

interface ChallengeSubmitResult {
  accepted: boolean;
  completed: boolean;
  message: string;
  progress: ReturnType<typeof toProgressDto>;
  reward?: RewardGrantResult;
}

interface ChallengeReviewResult {
  message: string;
  submission: ReturnType<typeof toSubmissionDto>;
  progress: ReturnType<typeof toProgressDto>;
  reward?: RewardGrantResult;
}

interface ChallengeMutationInput {
  key?: string;
  slug?: string;
  title?: string;
  summary?: string;
  description?: string;
  instructions?: string;
  status?: ChallengeStatus;
  kind?: ChallengeKind;
  difficulty?: ChallengeDifficulty;
  estimatedMinutes?: number;
  tags?: unknown;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  maxAttempts?: number | null;
  validation?: Record<string, unknown>;
  reward?: Partial<IChallengeRewardConfig>;
}

const challengeStatuses: ChallengeStatus[] = ['draft', 'published', 'archived'];
const challengeKinds: ChallengeKind[] = ['single', 'multi_part'];
const challengeDifficulties: ChallengeDifficulty[] = ['easy', 'medium', 'hard', 'expert'];
const xpModes: ChallengeXpMode[] = ['none', 'classroom', 'custom'];
const customChallengeValidatorTypes = new Set(['static_secret', 'manual_review']);
const completedStatuses: ChallengeProgressStatus[] = [
  'completed',
  'reward_pending',
  'reward_sent',
  'reward_failed',
];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const cleanString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
};

const keyify = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
};

const parseDate = (value: string | Date | null | undefined): Date | null | undefined => {
  if (value === null) return null;
  if (value === undefined || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ChallengeServiceError('Invalid challenge date.', 'INVALID_CHALLENGE_INPUT', 400, {
      value,
    });
  }
  return date;
};

const normalizeTags = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return [];

  return Array.from(
    new Set(
      tags
        .map((tag) => cleanString(tag).toLowerCase())
        .filter(Boolean)
        .slice(0, 20)
    )
  );
};

const normalizeNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const getAssignmentScopeId = (assignment?: IChallengeAssignmentDocument | null): string | null => {
  return assignment?.rewardIntegrationInstanceId?.toString() || null;
};

const normalizeValidation = (
  validation: unknown,
  required: boolean
): Record<string, unknown> | undefined => {
  if (!isRecord(validation)) {
    if (required) {
      throw new ChallengeServiceError(
        'Challenge validation config is required.',
        'INVALID_CHALLENGE_INPUT'
      );
    }
    return undefined;
  }

  const type = cleanString(validation.type);
  if (!type) {
    throw new ChallengeServiceError(
      'Challenge validation type is required.',
      'INVALID_CHALLENGE_INPUT'
    );
  }

  try {
    return prepareChallengeValidationConfigForStorage({
      ...validation,
      type,
    });
  } catch (error: unknown) {
    if (error instanceof ChallengeValidatorError) {
      throw new ChallengeServiceError(error.message, 'INVALID_CHALLENGE_INPUT', 400);
    }
    throw error;
  }
};

const ensureUniqueCipheredSealRoute = async (
  validation: Record<string, unknown>,
  challengeId?: string
): Promise<void> => {
  if (validation.type !== CIPHERED_SEAL_VALIDATOR_TYPE) return;

  const query: Record<string, unknown> = {
    'validation.type': CIPHERED_SEAL_VALIDATOR_TYPE,
    'validation.routeKey': cleanString(validation.routeKey),
  };
  if (challengeId) {
    query._id = { $ne: new Types.ObjectId(challengeId) };
  }

  if (await Challenge.exists(query)) {
    throw new ChallengeServiceError(
      'That Ciphered Seal route is already assigned to another challenge.',
      'INVALID_CHALLENGE_INPUT',
      409
    );
  }
};

const normalizeReward = (reward: unknown): IChallengeRewardConfig => {
  if (!isRecord(reward)) {
    return {
      enabled: false,
      bits: 0,
      xpMode: 'custom',
      applyGroupMultipliers: true,
      applyPersonalMultipliers: true,
    };
  }

  const bits = normalizeNumber(reward.bits);
  const xpAmount = normalizeNumber(reward.xpAmount);
  const xpMode = xpModes.includes(reward.xpMode as ChallengeXpMode)
    ? (reward.xpMode as ChallengeXpMode)
    : 'custom';
  const stats = isRecord(reward.stats)
    ? {
        multiplier: normalizeNumber(reward.stats.multiplier),
        luck: normalizeNumber(reward.stats.luck),
        shield: normalizeNumber(reward.stats.shield),
        discount: normalizeNumber(reward.stats.discount),
      }
    : undefined;

  return {
    enabled: Boolean(reward.enabled),
    bits: bits && bits > 0 ? bits : 0,
    xpAmount: xpAmount && xpAmount > 0 ? xpAmount : undefined,
    xpMode,
    activityName: cleanString(reward.activityName) || undefined,
    description: cleanString(reward.description) || undefined,
    stats,
    applyGroupMultipliers:
      typeof reward.applyGroupMultipliers === 'boolean' ? reward.applyGroupMultipliers : true,
    applyPersonalMultipliers:
      typeof reward.applyPersonalMultipliers === 'boolean' ? reward.applyPersonalMultipliers : true,
  };
};

const normalizeExistingReward = (
  current: IChallengeRewardConfig,
  update: unknown
): IChallengeRewardConfig => {
  if (!isRecord(update)) return current;
  return normalizeReward({
    ...current,
    ...update,
    stats: isRecord(update.stats) ? update.stats : current.stats,
  });
};

const isPublishedAssignmentNowQuery = () => {
  const now = new Date();
  return {
    status: 'published',
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
    ],
  };
};

const getValidatorType = (challenge: IChallengeDocument): string => {
  return cleanString(challenge.validation?.type) || 'unknown';
};

const toRewardPreview = (reward: IChallengeRewardConfig) => ({
  enabled: Boolean(reward?.enabled),
  bits: reward?.bits || 0,
  xpAmount: reward?.xpAmount,
  xpMode: reward?.xpMode || 'custom',
});

const getPublicChallengeExperience = (challenge: IChallengeDocument) => {
  try {
    if (getValidatorType(challenge) === CIPHERED_SEAL_VALIDATOR_TYPE) {
      return getCipheredSealPublicExperience(challenge.validation);
    }
    if (getValidatorType(challenge) === SQL_INJECTION_VALIDATOR_TYPE) {
      return getSqlInjectionPublicExperience(challenge.validation);
    }
    if (getValidatorType(challenge) === PCAP_FORENSICS_VALIDATOR_TYPE) {
      return getPcapForensicsPublicExperience(challenge.validation);
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const toProgressDto = (progress: IChallengeProgressDocument | null) => {
  if (!progress) {
    return {
      status: 'not_started' as ChallengeProgressStatus,
      attemptCount: 0,
      assignmentId: null,
      rewardIntegrationInstanceId: null,
      startedAt: null,
      lastSubmittedAt: null,
      completedAt: null,
      rewardEmissionId: null,
      completionEventId: undefined,
      lastValidationMessage: undefined,
    };
  }

  return {
    id: String(progress._id),
    challengeId: String(progress.challengeId),
    assignmentId: progress.assignmentId?.toString() || null,
    rewardIntegrationInstanceId: progress.rewardIntegrationInstanceId?.toString() || null,
    challengeKey: progress.challengeKey,
    challengeVersion: progress.challengeVersion,
    status: progress.status,
    attemptCount: progress.attemptCount,
    startedAt: progress.startedAt,
    lastSubmittedAt: progress.lastSubmittedAt,
    completedAt: progress.completedAt,
    rewardEmissionId: progress.rewardEmissionId?.toString() || null,
    completionEventId: progress.completionEventId,
    lastValidationMessage: progress.lastValidationMessage,
    createdAt: progress.createdAt,
    updatedAt: progress.updatedAt,
  };
};

const toPublicChallengeDto = (
  challenge: IChallengeDocument,
  assignment?: IChallengeAssignmentDocument | null,
  progress?: IChallengeProgressDocument | null
) => ({
  id: String(challenge._id),
  assignmentId: assignment?._id.toString() || null,
  key: challenge.key,
  slug: challenge.slug,
  title: challenge.title,
  summary: challenge.summary,
  description: challenge.description,
  instructions: challenge.instructions,
  kind: challenge.kind,
  difficulty: challenge.difficulty,
  estimatedMinutes: challenge.estimatedMinutes,
  tags: challenge.tags,
  version: challenge.version,
  validationType: getValidatorType(challenge),
  experience: getPublicChallengeExperience(challenge),
  startsAt: assignment ? assignment.startsAt : challenge.startsAt,
  endsAt: assignment ? assignment.endsAt : challenge.endsAt,
  maxAttempts: assignment ? assignment.maxAttempts : challenge.maxAttempts,
  rewardIntegrationInstanceId: getAssignmentScopeId(assignment),
  reward: toRewardPreview(assignment ? assignment.reward : challenge.reward),
  progress: progress === undefined ? undefined : toProgressDto(progress),
});

export const toAdminChallengeDto = (challenge: IChallengeDocument) => ({
  ...toPublicChallengeDto(challenge, null),
  source: challenge.source || 'custom',
  status: challenge.status,
  validation: challenge.validation,
  reward: challenge.reward,
  maxAttempts: challenge.maxAttempts,
  publishedAt: challenge.publishedAt,
  archivedAt: challenge.archivedAt,
  createdBy: challenge.createdBy?.toString(),
  updatedBy: challenge.updatedBy?.toString(),
  createdAt: challenge.createdAt,
  updatedAt: challenge.updatedAt,
});

const toSubmissionDto = (submission: IChallengeSubmissionDocument) => ({
  id: String(submission._id),
  userId: submission.userId?.toString(),
  challengeId: submission.challengeId?.toString(),
  assignmentId: submission.assignmentId?.toString() || null,
  rewardIntegrationInstanceId: submission.rewardIntegrationInstanceId?.toString() || null,
  progressId: submission.progressId?.toString(),
  challengeKey: submission.challengeKey,
  validatorType: submission.validatorType,
  status: submission.status,
  submittedPayloadPreview: submission.submittedPayloadPreview,
  validationResult: submission.validationResult,
  message: submission.message,
  createdAt: submission.createdAt,
  updatedAt: submission.updatedAt,
});

const getRewardLinkSummary = async (
  userId?: string,
  requiredInstanceId?: string | null
): Promise<RewardLinkSummary> => {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return {
      required: true,
      linked: false,
      configured: false,
      requiredInstanceId: requiredInstanceId || null,
      linkedInstanceId: null,
    };
  }

  const user = await User.findById(userId);
  const status = await getPrizeversityStatus(user);
  const linkedInstanceId = status.account?.instanceId || null;
  const linked = Boolean(
    status.linked && (!requiredInstanceId || linkedInstanceId === requiredInstanceId)
  );

  return {
    required: true,
    linked,
    configured: status.configured,
    requiredInstanceId: requiredInstanceId || null,
    linkedInstanceId,
  };
};

interface AssignedChallengeContext {
  challenge: IChallengeDocument;
  assignment: IChallengeAssignmentDocument;
  user: IUserDocument;
}

const ensureLinkedChallengeUser = async (userId?: string): Promise<IUserDocument> => {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new ChallengeServiceError(
      'Link your Prizeversity classroom account before opening challenges.',
      'REWARD_LINK_REQUIRED',
      403
    );
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ChallengeServiceError('User not found.', 'INVALID_CHALLENGE_INPUT', 404);
  }
  if (!user.rewardIntegrationInstanceId) {
    throw new ChallengeServiceError(
      'Link your Prizeversity classroom account before opening challenges.',
      'REWARD_LINK_REQUIRED',
      403
    );
  }
  const activeInstance = await RewardIntegrationInstance.exists({
    _id: user.rewardIntegrationInstanceId,
    active: true,
  });
  if (!activeInstance) {
    throw new ChallengeServiceError(
      'Your linked Prizeversity classroom is not currently active.',
      'REWARD_LINK_REQUIRED',
      403
    );
  }
  return user;
};

const findActiveAssignment = async (
  challengeId: Types.ObjectId,
  rewardIntegrationInstanceId: Types.ObjectId
): Promise<IChallengeAssignmentDocument | null> => {
  return ChallengeAssignment.findOne({
    challengeId,
    rewardIntegrationInstanceId,
    ...isPublishedAssignmentNowQuery(),
  });
};

const ensureAssignedChallenge = async (
  slug: string,
  userId?: string
): Promise<AssignedChallengeContext> => {
  const user = await ensureLinkedChallengeUser(userId);
  const challenge = await Challenge.findOne({
    slug: slugify(slug),
    status: 'published',
  });
  if (!challenge) {
    throw new ChallengeServiceError('Challenge not found.', 'CHALLENGE_NOT_FOUND', 404);
  }

  const assignment = await findActiveAssignment(
    challenge._id,
    user.rewardIntegrationInstanceId as Types.ObjectId
  );
  if (!assignment) {
    throw new ChallengeServiceError(
      'This challenge is not available in your classroom.',
      'CHALLENGE_NOT_FOUND',
      404
    );
  }
  return { challenge, assignment, user };
};

const ensureAssignedCipheredSealChallenge = async (
  routeKey: string,
  userId: string
): Promise<AssignedChallengeContext> => {
  const normalizedRouteKey = cleanString(routeKey);
  if (!/^\d{4,12}$/.test(normalizedRouteKey)) {
    throw new ChallengeServiceError('Challenge route not found.', 'CHALLENGE_NOT_FOUND', 404);
  }

  const user = await ensureLinkedChallengeUser(userId);
  const challenge = await Challenge.findOne({
    status: 'published',
    'validation.type': CIPHERED_SEAL_VALIDATOR_TYPE,
    'validation.routeKey': normalizedRouteKey,
  });

  if (!challenge) {
    throw new ChallengeServiceError('Challenge route not found.', 'CHALLENGE_NOT_FOUND', 404);
  }

  const assignment = await findActiveAssignment(
    challenge._id,
    user.rewardIntegrationInstanceId as Types.ObjectId
  );
  if (!assignment) {
    throw new ChallengeServiceError('Challenge route not found.', 'CHALLENGE_NOT_FOUND', 404);
  }

  return { challenge, assignment, user };
};

const ensureChallengeById = async (challengeId: string): Promise<IChallengeDocument> => {
  if (!Types.ObjectId.isValid(challengeId)) {
    throw new ChallengeServiceError('Challenge not found.', 'CHALLENGE_NOT_FOUND', 404);
  }

  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    throw new ChallengeServiceError('Challenge not found.', 'CHALLENGE_NOT_FOUND', 404);
  }

  return challenge;
};

const getOrCreateProgress = async (
  challenge: IChallengeDocument,
  assignment: IChallengeAssignmentDocument,
  userId: string
): Promise<IChallengeProgressDocument> => {
  const userObjectId = new Types.ObjectId(userId);
  let progress = await ChallengeProgress.findOne({
    userId: userObjectId,
    assignmentId: assignment._id,
  });

  if (!progress) {
    progress = await ChallengeProgress.create({
      userId: userObjectId,
      challengeId: challenge._id,
      assignmentId: assignment._id,
      rewardIntegrationInstanceId: assignment.rewardIntegrationInstanceId,
      challengeKey: challenge.key,
      challengeVersion: challenge.version,
      status: 'in_progress',
      attemptCount: 0,
      startedAt: new Date(),
    });
    return progress;
  }

  if (progress.status === 'not_started') {
    progress.status = 'in_progress';
    progress.startedAt = progress.startedAt || new Date();
    await progress.save();
  }

  return progress;
};

const normalizePagination = (page?: number, limit?: number) => {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit,
  };
};

const completeChallengeProgress = async (
  challenge: IChallengeDocument,
  assignment: IChallengeAssignmentDocument,
  user: IUserDocument,
  progress: IChallengeProgressDocument
): Promise<RewardGrantResult> => {
  const completedAt = new Date();
  progress.status = assignment.reward?.enabled ? 'reward_pending' : 'completed';
  progress.completedAt = progress.completedAt || completedAt;
  progress.completionEventId =
    progress.completionEventId ||
    `challenge-completed:${String(user._id)}:${assignment._id.toString()}`;
  await progress.save();

  const event = buildChallengeCompletionEvent(user, challenge, assignment, progress);
  const reward = await grantChallengeCompletionReward(event, user);

  if (reward.status === 'sent' || reward.status === 'already_sent') {
    progress.status = 'reward_sent';
    progress.rewardEmissionId = reward.emissionId ? new Types.ObjectId(reward.emissionId) : null;
  } else if (reward.status === 'failed') {
    progress.status = 'reward_failed';
    progress.rewardEmissionId = reward.emissionId ? new Types.ObjectId(reward.emissionId) : null;
  } else {
    progress.status = 'completed';
  }

  await progress.save();
  return reward;
};

export const listPublishedChallenges = async (
  options: ChallengeListOptions = {}
): Promise<{
  challenges: ReturnType<typeof toPublicChallengeDto>[];
  rewardLink: RewardLinkSummary;
}> => {
  const user =
    options.userId && Types.ObjectId.isValid(options.userId)
      ? await User.findById(options.userId)
      : null;

  if (!user?.rewardIntegrationInstanceId) {
    return {
      challenges: [],
      rewardLink: await getRewardLinkSummary(options.userId),
    };
  }

  const activeInstance = await RewardIntegrationInstance.exists({
    _id: user.rewardIntegrationInstanceId,
    active: true,
  });
  if (!activeInstance) {
    return {
      challenges: [],
      rewardLink: await getRewardLinkSummary(options.userId),
    };
  }

  const assignments = await ChallengeAssignment.find({
    rewardIntegrationInstanceId: user.rewardIntegrationInstanceId,
    ...isPublishedAssignmentNowQuery(),
  }).sort({ publishedAt: -1, createdAt: -1 });
  const challengeQuery: Record<string, unknown> = {
    _id: { $in: assignments.map((assignment) => assignment.challengeId) },
    status: 'published',
  };
  if (options.tag) challengeQuery.tags = cleanString(options.tag).toLowerCase();
  if (options.difficulty && challengeDifficulties.includes(options.difficulty)) {
    challengeQuery.difficulty = options.difficulty;
  }

  const challenges = await Challenge.find(challengeQuery);
  const challengeById = new Map(
    challenges.map((challenge) => [challenge._id.toString(), challenge])
  );
  const visibleAssignments = assignments.filter((assignment) =>
    challengeById.has(assignment.challengeId.toString())
  );
  const progressRecords = await ChallengeProgress.find({
    userId: user._id,
    assignmentId: { $in: visibleAssignments.map((assignment) => assignment._id) },
  });
  const progressByAssignmentId = new Map(
    progressRecords.map((progress) => [progress.assignmentId?.toString(), progress])
  );

  return {
    challenges: visibleAssignments.map((assignment) => {
      const challenge = challengeById.get(assignment.challengeId.toString()) as IChallengeDocument;
      return toPublicChallengeDto(
        challenge,
        assignment,
        progressByAssignmentId.get(assignment._id.toString()) || null
      );
    }),
    rewardLink: await getRewardLinkSummary(options.userId),
  };
};

export const getPublishedChallenge = async (
  slug: string,
  userId?: string
): Promise<{
  challenge: ReturnType<typeof toPublicChallengeDto>;
  rewardLink: RewardLinkSummary;
}> => {
  const { challenge, assignment } = await ensureAssignedChallenge(slug, userId);
  const progress = await ChallengeProgress.findOne({
    userId: new Types.ObjectId(userId as string),
    assignmentId: assignment._id,
  });

  return {
    challenge: toPublicChallengeDto(challenge, assignment, progress || null),
    rewardLink: await getRewardLinkSummary(userId, getAssignmentScopeId(assignment)),
  };
};

export const getChallengeProgress = async (
  slug: string,
  userId: string
): Promise<{
  challenge: ReturnType<typeof toPublicChallengeDto>;
  progress: ReturnType<typeof toProgressDto>;
}> => {
  const { challenge, assignment } = await ensureAssignedChallenge(slug, userId);
  const progress = await ChallengeProgress.findOne({
    userId: new Types.ObjectId(userId),
    assignmentId: assignment._id,
  });

  return {
    challenge: toPublicChallengeDto(challenge, assignment),
    progress: toProgressDto(progress),
  };
};

export const startChallenge = async (
  slug: string,
  userId: string
): Promise<{
  challenge: ReturnType<typeof toPublicChallengeDto>;
  progress: ReturnType<typeof toProgressDto>;
}> => {
  const { challenge, assignment } = await ensureAssignedChallenge(slug, userId);
  const progress = await getOrCreateProgress(challenge, assignment, userId);

  return {
    challenge: toPublicChallengeDto(challenge, assignment),
    progress: toProgressDto(progress),
  };
};

const getCipheredSealPlayerContext = async (routeKey: string, userId: string) => {
  const { challenge, assignment, user } = await ensureAssignedCipheredSealChallenge(
    routeKey,
    userId
  );
  if (assignment.reward?.enabled && !hasRewardIdentity(user)) {
    throw new ChallengeServiceError(
      'Link your Prizeversity account before entering this challenge.',
      'REWARD_LINK_REQUIRED',
      403
    );
  }

  const progress = await getOrCreateProgress(challenge, assignment, userId);
  return { challenge, assignment, user, progress };
};

export const getCipheredSealRouteState = async (routeKey: string, userId: string) => {
  const { challenge, assignment, user, progress } = await getCipheredSealPlayerContext(
    routeKey,
    userId
  );

  return {
    challenge: toPublicChallengeDto(challenge, assignment),
    progress: toProgressDto(progress),
    rewardLink: await getRewardLinkSummary(userId, getAssignmentScopeId(assignment)),
    protocol: buildCipheredSealPublicState(challenge, user),
  };
};

export const resolveCipheredSealRouteSeed = async (
  routeKey: string,
  userId: string,
  seedNumber: unknown
) => {
  const { challenge, user } = await getCipheredSealPlayerContext(routeKey, userId);
  return resolveSubmittedCipheredSealSeed(challenge, user, seedNumber);
};

const getSqlInjectionPlayerContext = async (slug: string, userId: string) => {
  const { challenge, assignment, user } = await ensureAssignedChallenge(slug, userId);
  if (getValidatorType(challenge) !== SQL_INJECTION_VALIDATOR_TYPE) {
    throw new ChallengeServiceError('SQL sandbox not found.', 'CHALLENGE_NOT_FOUND', 404);
  }
  if (assignment.reward?.enabled && !hasRewardIdentity(user)) {
    throw new ChallengeServiceError(
      'Link your Prizeversity account before entering this challenge.',
      'REWARD_LINK_REQUIRED',
      403
    );
  }

  const progress = await getOrCreateProgress(challenge, assignment, userId);
  return { challenge, assignment, user, progress };
};

export const getSqlInjectionSandboxState = async (slug: string, userId: string) => {
  const { challenge, assignment, progress } = await getSqlInjectionPlayerContext(slug, userId);
  return {
    challenge: toPublicChallengeDto(challenge, assignment),
    progress: toProgressDto(progress),
    rewardLink: await getRewardLinkSummary(userId, getAssignmentScopeId(assignment)),
    sandbox: getSqlInjectionPublicExperience(challenge.validation),
  };
};

export const searchSqlInjectionSandbox = async (slug: string, userId: string, input: unknown) => {
  const { challenge, user, progress } = await getSqlInjectionPlayerContext(slug, userId);
  try {
    return runSqlInjectionSandboxQuery(challenge.validation, input, {
      challenge,
      progress,
      user,
    });
  } catch (error: unknown) {
    throw new ChallengeServiceError(
      error instanceof Error ? error.message : 'Unable to run the sandbox query.',
      'INVALID_CHALLENGE_INPUT',
      400
    );
  }
};

const getPcapForensicsPlayerContext = async (slug: string, userId: string) => {
  const { challenge, assignment, user } = await ensureAssignedChallenge(slug, userId);
  if (getValidatorType(challenge) !== PCAP_FORENSICS_VALIDATOR_TYPE) {
    throw new ChallengeServiceError('Packet capture not found.', 'CHALLENGE_NOT_FOUND', 404);
  }
  if (assignment.reward?.enabled && !hasRewardIdentity(user)) {
    throw new ChallengeServiceError(
      'Link your Prizeversity account before downloading this challenge.',
      'REWARD_LINK_REQUIRED',
      403
    );
  }

  const progress = await getOrCreateProgress(challenge, assignment, userId);
  return { challenge, user, progress };
};

export const downloadPcapForensicsCapture = async (slug: string, userId: string) => {
  const { challenge, user, progress } = await getPcapForensicsPlayerContext(slug, userId);
  const experience = getPcapForensicsPublicExperience(challenge.validation);
  return {
    capture: buildPcapForensicsCapture({ challenge, progress, user }),
    fileName: experience.fileName,
  };
};

export const submitChallenge = async (
  slug: string,
  userId: string,
  payload: unknown
): Promise<ChallengeSubmitResult> => {
  const { challenge, assignment, user } = await ensureAssignedChallenge(slug, userId);

  if (assignment.reward?.enabled && !hasRewardIdentity(user)) {
    throw new ChallengeServiceError(
      'Link your Prizeversity account before completing rewardable challenges.',
      'REWARD_LINK_REQUIRED',
      403
    );
  }

  const progress = await getOrCreateProgress(challenge, assignment, userId);

  if (completedStatuses.includes(progress.status)) {
    return {
      accepted: true,
      completed: true,
      message: 'Challenge is already completed.',
      progress: toProgressDto(progress),
      reward: assignment.reward?.enabled
        ? {
            status:
              progress.status === 'reward_sent'
                ? 'already_sent'
                : progress.status === 'reward_failed'
                  ? 'failed'
                  : 'not_required',
            emissionId: progress.rewardEmissionId?.toString(),
          }
        : { status: 'not_required' },
    };
  }

  if (assignment.maxAttempts && progress.attemptCount >= assignment.maxAttempts) {
    throw new ChallengeServiceError(
      'Maximum challenge attempts reached.',
      'MAX_ATTEMPTS_REACHED',
      429,
      { progress: toProgressDto(progress) }
    );
  }

  progress.attemptCount += 1;
  progress.lastSubmittedAt = new Date();

  let validationResult;
  try {
    validationResult = await validateChallengeSubmission(challenge.validation, payload, {
      user,
      challenge,
      progress,
    });
  } catch (error: unknown) {
    const message =
      error instanceof ChallengeValidatorError
        ? error.message
        : 'Challenge validation failed unexpectedly.';
    progress.lastValidationMessage = message;
    await progress.save();

    await ChallengeSubmission.create({
      userId: new Types.ObjectId(userId),
      challengeId: challenge._id,
      assignmentId: assignment._id,
      rewardIntegrationInstanceId: assignment.rewardIntegrationInstanceId,
      progressId: progress._id,
      challengeKey: challenge.key,
      validatorType: getValidatorType(challenge),
      status: 'error',
      submittedPayloadPreview: sanitizeChallengeSubmissionPayload(challenge.validation, payload),
      validationResult: {
        code: error instanceof ChallengeValidatorError ? 'VALIDATOR_ERROR' : 'VALIDATOR_EXCEPTION',
      },
      message,
    });

    throw new ChallengeServiceError(message, 'VALIDATOR_ERROR', 500, {
      progress: toProgressDto(progress),
    });
  }

  progress.lastValidationMessage = validationResult.message;
  const validationOutcome =
    validationResult.outcome || (validationResult.accepted ? 'accepted' : 'rejected');

  if (validationOutcome === 'pending_review') {
    progress.status = 'pending_review';
    await progress.save();

    await ChallengeSubmission.create({
      userId: new Types.ObjectId(userId),
      challengeId: challenge._id,
      assignmentId: assignment._id,
      rewardIntegrationInstanceId: assignment.rewardIntegrationInstanceId,
      progressId: progress._id,
      challengeKey: challenge.key,
      validatorType: getValidatorType(challenge),
      status: 'pending_review',
      submittedPayloadPreview: sanitizeChallengeSubmissionPayload(challenge.validation, payload),
      validationResult: {
        accepted: true,
        outcome: 'pending_review',
        publicDetails: validationResult.publicDetails,
        privateDetails: validationResult.privateDetails,
      },
      message: validationResult.message,
    });

    return {
      accepted: true,
      completed: false,
      message: validationResult.message,
      progress: toProgressDto(progress),
      reward: { status: 'not_required' },
    };
  }

  if (!validationResult.accepted || validationOutcome === 'rejected') {
    await progress.save();
    await ChallengeSubmission.create({
      userId: new Types.ObjectId(userId),
      challengeId: challenge._id,
      assignmentId: assignment._id,
      rewardIntegrationInstanceId: assignment.rewardIntegrationInstanceId,
      progressId: progress._id,
      challengeKey: challenge.key,
      validatorType: getValidatorType(challenge),
      status: 'rejected',
      submittedPayloadPreview: sanitizeChallengeSubmissionPayload(challenge.validation, payload),
      validationResult: {
        accepted: false,
        publicDetails: validationResult.publicDetails,
        privateDetails: validationResult.privateDetails,
      },
      message: validationResult.message,
    });

    return {
      accepted: false,
      completed: false,
      message: validationResult.message,
      progress: toProgressDto(progress),
      reward: { status: 'not_required' },
    };
  }

  await ChallengeSubmission.create({
    userId: new Types.ObjectId(userId),
    challengeId: challenge._id,
    assignmentId: assignment._id,
    rewardIntegrationInstanceId: assignment.rewardIntegrationInstanceId,
    progressId: progress._id,
    challengeKey: challenge.key,
    validatorType: getValidatorType(challenge),
    status: 'accepted',
    submittedPayloadPreview: sanitizeChallengeSubmissionPayload(challenge.validation, payload),
    validationResult: {
      accepted: true,
      publicDetails: validationResult.publicDetails,
      privateDetails: validationResult.privateDetails,
    },
    message: validationResult.message,
  });

  const reward = await completeChallengeProgress(challenge, assignment, user, progress);

  return {
    accepted: true,
    completed: true,
    message: validationResult.message,
    progress: toProgressDto(progress),
    reward,
  };
};

export const listAdminChallenges = async (
  options: AdminChallengeListOptions = {}
): Promise<ListResult<ReturnType<typeof toAdminChallengeDto>>> => {
  const { page, limit, skip } = normalizePagination(options.page, options.limit);
  const query: Record<string, unknown> = {};

  if (options.status && challengeStatuses.includes(options.status)) {
    query.status = options.status;
  }

  if (options.search) {
    const search = cleanString(options.search);
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { key: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Challenge.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Challenge.countDocuments(query),
  ]);

  return {
    items: items.map(toAdminChallengeDto),
    total,
    page,
    limit,
  };
};

export const getAdminChallenge = async (
  challengeId: string
): Promise<ReturnType<typeof toAdminChallengeDto>> => {
  return toAdminChallengeDto(await ensureChallengeById(challengeId));
};

export const createAdminChallenge = async (
  input: ChallengeMutationInput,
  adminUserId: string
): Promise<ReturnType<typeof toAdminChallengeDto>> => {
  const title = cleanString(input.title);
  const summary = cleanString(input.summary);
  const description = cleanString(input.description);

  if (!title) {
    throw new ChallengeServiceError('Challenge title is required.', 'INVALID_CHALLENGE_INPUT');
  }
  if (!summary) {
    throw new ChallengeServiceError('Challenge summary is required.', 'INVALID_CHALLENGE_INPUT');
  }
  if (!description) {
    throw new ChallengeServiceError(
      'Challenge description is required.',
      'INVALID_CHALLENGE_INPUT'
    );
  }

  const slug = slugify(input.slug || title);
  const key = keyify(input.key || slug || title);

  if (!slug || !key) {
    throw new ChallengeServiceError(
      'Challenge slug and key are required.',
      'INVALID_CHALLENGE_INPUT'
    );
  }

  const status = challengeStatuses.includes(input.status as ChallengeStatus)
    ? (input.status as ChallengeStatus)
    : 'draft';
  const startsAt = parseDate(input.startsAt);
  const endsAt = parseDate(input.endsAt);
  const validation = normalizeValidation(input.validation, true) as Record<string, unknown>;
  if (!customChallengeValidatorTypes.has(cleanString(validation.type))) {
    throw new ChallengeServiceError(
      'Custom challenges must use static_secret or manual_review validation.',
      'INVALID_CHALLENGE_INPUT',
      400
    );
  }
  await ensureUniqueCipheredSealRoute(validation);
  const now = new Date();

  const challenge = await Challenge.create({
    key,
    slug,
    title,
    summary,
    description,
    instructions: cleanString(input.instructions) || undefined,
    source: 'custom',
    status,
    kind: challengeKinds.includes(input.kind as ChallengeKind) ? input.kind : 'single',
    difficulty: challengeDifficulties.includes(input.difficulty as ChallengeDifficulty)
      ? input.difficulty
      : 'easy',
    estimatedMinutes: normalizeNumber(input.estimatedMinutes),
    tags: normalizeTags(input.tags),
    version: 1,
    assignmentMigrationVersion: 1,
    publishedAt: status === 'published' ? now : null,
    archivedAt: status === 'archived' ? now : null,
    startsAt,
    endsAt,
    maxAttempts: normalizeNumber(input.maxAttempts),
    rewardIntegrationInstanceId: null,
    validation,
    reward: normalizeReward(input.reward),
    createdBy: new Types.ObjectId(adminUserId),
  });

  return toAdminChallengeDto(challenge);
};

export const updateAdminChallenge = async (
  challengeId: string,
  input: ChallengeMutationInput,
  adminUserId: string
): Promise<ReturnType<typeof toAdminChallengeDto>> => {
  const challenge = await ensureChallengeById(challengeId);

  if (input.key !== undefined) challenge.key = keyify(input.key);
  if (input.slug !== undefined) challenge.slug = slugify(input.slug);
  if (input.title !== undefined) challenge.title = cleanString(input.title);
  if (input.summary !== undefined) challenge.summary = cleanString(input.summary);
  if (input.description !== undefined) challenge.description = cleanString(input.description);
  if (input.instructions !== undefined) {
    challenge.instructions = cleanString(input.instructions) || undefined;
  }
  if (challengeKinds.includes(input.kind as ChallengeKind)) challenge.kind = input.kind;
  if (challengeDifficulties.includes(input.difficulty as ChallengeDifficulty)) {
    challenge.difficulty = input.difficulty;
  }
  if (input.estimatedMinutes !== undefined) {
    challenge.estimatedMinutes = normalizeNumber(input.estimatedMinutes);
  }
  if (input.tags !== undefined) challenge.tags = normalizeTags(input.tags);
  if (input.startsAt !== undefined) challenge.startsAt = parseDate(input.startsAt) || null;
  if (input.endsAt !== undefined) challenge.endsAt = parseDate(input.endsAt) || null;
  if (input.maxAttempts !== undefined) {
    challenge.maxAttempts = normalizeNumber(input.maxAttempts) || undefined;
  }
  if (input.validation !== undefined) {
    const validation = normalizeValidation(input.validation, true) as Record<string, unknown>;
    await ensureUniqueCipheredSealRoute(validation, challengeId);
    challenge.validation = validation;
    challenge.version += 1;
  }
  if (input.reward !== undefined) {
    challenge.reward = normalizeExistingReward(challenge.reward, input.reward);
  }

  challenge.updatedBy = new Types.ObjectId(adminUserId);
  await challenge.save();

  return toAdminChallengeDto(challenge);
};

export const publishAdminChallenge = async (
  challengeId: string,
  adminUserId: string
): Promise<ReturnType<typeof toAdminChallengeDto>> => {
  const challenge = await ensureChallengeById(challengeId);
  challenge.status = 'published';
  challenge.publishedAt = challenge.publishedAt || new Date();
  challenge.archivedAt = null;
  challenge.updatedBy = new Types.ObjectId(adminUserId);
  await challenge.save();
  return toAdminChallengeDto(challenge);
};

export const archiveAdminChallenge = async (
  challengeId: string,
  adminUserId: string
): Promise<ReturnType<typeof toAdminChallengeDto>> => {
  const challenge = await ensureChallengeById(challengeId);
  challenge.status = 'archived';
  challenge.archivedAt = new Date();
  challenge.updatedBy = new Types.ObjectId(adminUserId);
  await challenge.save();
  return toAdminChallengeDto(challenge);
};

export const deleteAdminChallenge = async (
  challengeId: string
): Promise<{
  deleted: true;
  challengeId: string;
  progressDeleted: number;
  submissionsDeleted: number;
}> => {
  const challenge = await ensureChallengeById(challengeId);

  if (challenge.source === 'curated') {
    throw new ChallengeServiceError(
      'Curated catalog challenges cannot be deleted.',
      'CHALLENGE_DELETE_BLOCKED',
      409,
      { source: challenge.source }
    );
  }

  if (challenge.status === 'published') {
    throw new ChallengeServiceError(
      'Archive the challenge before deleting it.',
      'CHALLENGE_DELETE_BLOCKED',
      409,
      { status: challenge.status }
    );
  }

  const assignmentCount = await ChallengeAssignment.countDocuments({ challengeId: challenge._id });
  if (assignmentCount > 0) {
    throw new ChallengeServiceError(
      'Remove this challenge from every classroom before deleting it from the catalog.',
      'CHALLENGE_DELETE_BLOCKED',
      409,
      { assignmentCount }
    );
  }

  const [submissionResult, progressResult] = await Promise.all([
    ChallengeSubmission.deleteMany({ challengeId: challenge._id }),
    ChallengeProgress.deleteMany({ challengeId: challenge._id }),
  ]);

  await Challenge.deleteOne({ _id: challenge._id });

  return {
    deleted: true,
    challengeId: String(challenge._id),
    progressDeleted: progressResult.deletedCount || 0,
    submissionsDeleted: submissionResult.deletedCount || 0,
  };
};

export const listAdminChallengeSubmissions = async (
  challengeId: string,
  options: {
    page?: number;
    limit?: number;
    status?: ChallengeSubmissionStatus;
    rewardIntegrationInstanceId?: string;
  } = {}
): Promise<ListResult<ReturnType<typeof toSubmissionDto>>> => {
  const challenge = await ensureChallengeById(challengeId);
  const { page, limit, skip } = normalizePagination(options.page, options.limit);
  const query: Record<string, unknown> = { challengeId: challenge._id };

  if (options.status) query.status = options.status;
  if (options.rewardIntegrationInstanceId) {
    if (!Types.ObjectId.isValid(options.rewardIntegrationInstanceId)) {
      throw new ChallengeServiceError(
        'Reward integration instance was not found.',
        'INVALID_CHALLENGE_INPUT',
        404
      );
    }
    query.rewardIntegrationInstanceId = new Types.ObjectId(options.rewardIntegrationInstanceId);
  }

  const [items, total] = await Promise.all([
    ChallengeSubmission.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ChallengeSubmission.countDocuments(query),
  ]);

  return {
    items: items.map(toSubmissionDto),
    total,
    page,
    limit,
  };
};

const ensureReviewableSubmission = async (
  challengeId: string,
  submissionId: string
): Promise<{
  challenge: IChallengeDocument;
  submission: IChallengeSubmissionDocument;
}> => {
  const challenge = await ensureChallengeById(challengeId);
  if (!Types.ObjectId.isValid(submissionId)) {
    throw new ChallengeServiceError('Submission not found.', 'SUBMISSION_NOT_FOUND', 404);
  }

  const submission = await ChallengeSubmission.findOne({
    _id: new Types.ObjectId(submissionId),
    challengeId: challenge._id,
  });

  if (!submission) {
    throw new ChallengeServiceError('Submission not found.', 'SUBMISSION_NOT_FOUND', 404);
  }

  if (submission.status !== 'pending_review') {
    throw new ChallengeServiceError(
      'Only pending manual-review submissions can be reviewed.',
      'SUBMISSION_NOT_REVIEWABLE',
      409,
      { status: submission.status }
    );
  }

  return { challenge, submission };
};

export const approveAdminChallengeSubmission = async (
  challengeId: string,
  submissionId: string,
  adminUserId: string,
  reviewMessage?: string
): Promise<ChallengeReviewResult> => {
  const { challenge, submission } = await ensureReviewableSubmission(challengeId, submissionId);
  const [progress, submittedUser] = await Promise.all([
    ChallengeProgress.findById(submission.progressId),
    User.findById(submission.userId),
  ]);

  if (!progress || !submittedUser) {
    throw new ChallengeServiceError(
      'Submission progress or user record was not found.',
      'SUBMISSION_NOT_FOUND',
      404
    );
  }

  const assignmentId = submission.assignmentId || progress.assignmentId;
  const assignment = assignmentId
    ? await ChallengeAssignment.findOne({ _id: assignmentId, challengeId: challenge._id })
    : null;
  if (!assignment) {
    throw new ChallengeServiceError(
      'The classroom assignment for this submission was not found.',
      'CHALLENGE_ASSIGNMENT_NOT_FOUND',
      409
    );
  }

  const message = cleanString(reviewMessage) || 'Manual review approved.';
  submission.status = 'accepted';
  submission.message = message;
  submission.validationResult = {
    ...submission.validationResult,
    accepted: true,
    outcome: 'accepted',
    reviewedAt: new Date(),
    reviewedBy: adminUserId,
    reviewMessage: message,
  };
  await submission.save();

  progress.lastValidationMessage = message;
  const reward = await completeChallengeProgress(challenge, assignment, submittedUser, progress);

  return {
    message,
    submission: toSubmissionDto(submission),
    progress: toProgressDto(progress),
    reward,
  };
};

export const rejectAdminChallengeSubmission = async (
  challengeId: string,
  submissionId: string,
  adminUserId: string,
  reviewMessage?: string
): Promise<ChallengeReviewResult> => {
  const { submission } = await ensureReviewableSubmission(challengeId, submissionId);
  const progress = await ChallengeProgress.findById(submission.progressId);

  if (!progress) {
    throw new ChallengeServiceError(
      'Submission progress record was not found.',
      'SUBMISSION_NOT_FOUND',
      404
    );
  }

  const message = cleanString(reviewMessage) || 'Manual review rejected.';
  submission.status = 'rejected';
  submission.message = message;
  submission.validationResult = {
    ...submission.validationResult,
    accepted: false,
    outcome: 'rejected',
    reviewedAt: new Date(),
    reviewedBy: adminUserId,
    reviewMessage: message,
  };
  await submission.save();

  progress.status = 'in_progress';
  progress.lastValidationMessage = message;
  await progress.save();

  return {
    message,
    submission: toSubmissionDto(submission),
    progress: toProgressDto(progress),
    reward: { status: 'not_required' },
  };
};

export const listAdminChallengeProgress = async (
  challengeId: string,
  options: { page?: number; limit?: number; status?: ChallengeProgressStatus } = {}
): Promise<ListResult<ReturnType<typeof toProgressDto>>> => {
  const challenge = await ensureChallengeById(challengeId);
  const { page, limit, skip } = normalizePagination(options.page, options.limit);
  const query: Record<string, unknown> = { challengeId: challenge._id };

  if (options.status) query.status = options.status;

  const [items, total] = await Promise.all([
    ChallengeProgress.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    ChallengeProgress.countDocuments(query),
  ]);

  return {
    items: items.map(toProgressDto),
    total,
    page,
    limit,
  };
};

export const testAdminChallengeValidation = async (
  challengeId: string,
  userId: string,
  payload: unknown
): Promise<{
  accepted: boolean;
  message: string;
  details?: Record<string, unknown>;
}> => {
  const challenge = await ensureChallengeById(challengeId);
  const user = await User.findById(userId);
  if (!user) {
    throw new ChallengeServiceError('User not found.', 'INVALID_CHALLENGE_INPUT', 404);
  }

  const progress =
    (await ChallengeProgress.findOne({
      userId: user._id,
      challengeId: challenge._id,
    })) ||
    new ChallengeProgress({
      userId: user._id,
      challengeId: challenge._id,
      challengeKey: challenge.key,
      challengeVersion: challenge.version,
      status: 'not_started',
      attemptCount: 0,
    });

  const result = await validateChallengeSubmission(challenge.validation, payload, {
    user,
    challenge,
    progress,
  });

  return {
    accepted: result.accepted,
    message: result.message,
    details: result.publicDetails,
  };
};
