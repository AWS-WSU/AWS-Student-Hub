import { Types } from 'mongoose';

import Challenge, {
  ChallengeDifficulty,
  ChallengeKind,
  ChallengeStatus,
  ChallengeXpMode,
  IChallengeDocument,
  IChallengeRewardConfig,
} from '../models/Challenge';
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
import { getPrizeversityStatus } from './rewardIntegrationService';

export type ChallengeErrorCode =
  | 'CHALLENGE_NOT_FOUND'
  | 'CHALLENGE_NOT_PUBLISHED'
  | 'REWARD_LINK_REQUIRED'
  | 'MAX_ATTEMPTS_REACHED'
  | 'VALIDATION_FAILED'
  | 'VALIDATOR_ERROR'
  | 'CHALLENGE_DELETE_BLOCKED'
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
  rewardIntegrationInstanceId?: string | null;
  validation?: Record<string, unknown>;
  reward?: Partial<IChallengeRewardConfig>;
}

const challengeStatuses: ChallengeStatus[] = ['draft', 'published', 'archived'];
const challengeKinds: ChallengeKind[] = ['single', 'multi_part'];
const challengeDifficulties: ChallengeDifficulty[] = ['easy', 'medium', 'hard', 'expert'];
const xpModes: ChallengeXpMode[] = ['none', 'classroom', 'custom'];
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

const getChallengeScopeId = (challenge: IChallengeDocument): string | null => {
  return challenge.rewardIntegrationInstanceId?.toString() || null;
};

const getLinkedRewardInstanceId = (user?: IUserDocument | null): string | null => {
  return user?.rewardIntegrationInstanceId?.toString() || null;
};

const resolveRewardIntegrationInstanceId = async (
  value: string | null | undefined
): Promise<Types.ObjectId | null | undefined> => {
  if (value === undefined) return undefined;

  const cleanedValue = cleanString(value);
  if (!cleanedValue) return null;

  if (!Types.ObjectId.isValid(cleanedValue)) {
    throw new ChallengeServiceError(
      'Reward integration instance was not found.',
      'INVALID_CHALLENGE_INPUT',
      400
    );
  }

  const instance = await RewardIntegrationInstance.exists({
    _id: new Types.ObjectId(cleanedValue),
    active: true,
  });

  if (!instance) {
    throw new ChallengeServiceError(
      'Reward integration instance was not found.',
      'INVALID_CHALLENGE_INPUT',
      400
    );
  }

  return new Types.ObjectId(cleanedValue);
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

const isPublishedNowQuery = () => {
  const now = new Date();
  return {
    status: 'published',
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
    ],
  };
};

const appendAndClause = (query: Record<string, unknown>, clause: Record<string, unknown>): void => {
  const existingClauses = Array.isArray(query.$and) ? query.$and : [];
  query.$and = [...existingClauses, clause];
};

const getVisibilityScopeClause = (rewardIntegrationInstanceId?: string | null) => {
  const globalChallengeClauses: Record<string, unknown>[] = [
    { rewardIntegrationInstanceId: null },
    { rewardIntegrationInstanceId: { $exists: false } },
  ];

  if (!rewardIntegrationInstanceId || !Types.ObjectId.isValid(rewardIntegrationInstanceId)) {
    return { $or: globalChallengeClauses };
  }

  return {
    $or: [
      ...globalChallengeClauses,
      { rewardIntegrationInstanceId: new Types.ObjectId(rewardIntegrationInstanceId) },
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

const toProgressDto = (progress: IChallengeProgressDocument | null) => {
  if (!progress) {
    return {
      status: 'not_started' as ChallengeProgressStatus,
      attemptCount: 0,
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
  progress?: IChallengeProgressDocument | null
) => ({
  id: String(challenge._id),
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
  startsAt: challenge.startsAt,
  endsAt: challenge.endsAt,
  rewardIntegrationInstanceId: getChallengeScopeId(challenge),
  reward: toRewardPreview(challenge.reward),
  progress: progress === undefined ? undefined : toProgressDto(progress),
});

const toAdminChallengeDto = (challenge: IChallengeDocument) => ({
  ...toPublicChallengeDto(challenge),
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

const ensureChallengeScopeAccess = async (
  challenge: IChallengeDocument,
  userId?: string
): Promise<IUserDocument | null> => {
  const requiredInstanceId = getChallengeScopeId(challenge);
  if (!requiredInstanceId) return null;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new ChallengeServiceError(
      'Link your Prizeversity classroom account before opening this challenge.',
      'REWARD_LINK_REQUIRED',
      403,
      { rewardIntegrationInstanceId: requiredInstanceId }
    );
  }

  const user = await User.findById(userId);
  if (!user || getLinkedRewardInstanceId(user) !== requiredInstanceId) {
    throw new ChallengeServiceError(
      'This challenge belongs to a different Prizeversity classroom. Link the matching classroom account to continue.',
      'REWARD_LINK_REQUIRED',
      403,
      { rewardIntegrationInstanceId: requiredInstanceId }
    );
  }

  return user;
};

const ensureUserMatchesChallengeScope = (
  challenge: IChallengeDocument,
  user: IUserDocument
): void => {
  const requiredInstanceId = getChallengeScopeId(challenge);
  if (!requiredInstanceId) return;

  if (getLinkedRewardInstanceId(user) !== requiredInstanceId) {
    throw new ChallengeServiceError(
      'This challenge belongs to a different Prizeversity classroom. Link the matching classroom account to continue.',
      'REWARD_LINK_REQUIRED',
      403,
      { rewardIntegrationInstanceId: requiredInstanceId }
    );
  }
};

const ensurePublishedChallenge = async (slug: string): Promise<IChallengeDocument> => {
  const challenge = await Challenge.findOne({
    slug: slugify(slug),
    ...isPublishedNowQuery(),
  });

  if (!challenge) {
    throw new ChallengeServiceError('Challenge not found.', 'CHALLENGE_NOT_FOUND', 404);
  }

  return challenge;
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
  userId: string
): Promise<IChallengeProgressDocument> => {
  const userObjectId = new Types.ObjectId(userId);
  let progress = await ChallengeProgress.findOne({
    userId: userObjectId,
    challengeId: challenge._id,
  });

  if (!progress) {
    progress = await ChallengeProgress.create({
      userId: userObjectId,
      challengeId: challenge._id,
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
  user: IUserDocument,
  progress: IChallengeProgressDocument
): Promise<RewardGrantResult> => {
  const completedAt = new Date();
  progress.status = challenge.reward?.enabled ? 'reward_pending' : 'completed';
  progress.completedAt = progress.completedAt || completedAt;
  progress.completionEventId =
    progress.completionEventId || `challenge-completed:${String(user._id)}:${challenge.key}`;
  await progress.save();

  const event = buildChallengeCompletionEvent(user, challenge, progress);
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
  const query: Record<string, unknown> = isPublishedNowQuery();
  const user =
    options.userId && Types.ObjectId.isValid(options.userId)
      ? await User.findById(options.userId)
      : null;

  appendAndClause(query, getVisibilityScopeClause(getLinkedRewardInstanceId(user)));

  if (options.tag) query.tags = cleanString(options.tag).toLowerCase();
  if (options.difficulty && challengeDifficulties.includes(options.difficulty)) {
    query.difficulty = options.difficulty;
  }

  const challenges = await Challenge.find(query).sort({ publishedAt: -1, createdAt: -1 });
  const progressByChallengeId = new Map<string, IChallengeProgressDocument>();

  if (user && challenges.length) {
    const progressRecords = await ChallengeProgress.find({
      userId: user._id,
      challengeId: { $in: challenges.map((challenge) => challenge._id) },
    });

    progressRecords.forEach((progress) => {
      progressByChallengeId.set(progress.challengeId.toString(), progress);
    });
  }

  return {
    challenges: challenges.map((challenge) =>
      toPublicChallengeDto(challenge, progressByChallengeId.get(String(challenge._id)) || null)
    ),
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
  const challenge = await ensurePublishedChallenge(slug);
  await ensureChallengeScopeAccess(challenge, userId);
  const progress =
    userId && Types.ObjectId.isValid(userId)
      ? await ChallengeProgress.findOne({
          userId: new Types.ObjectId(userId),
          challengeId: challenge._id,
        })
      : null;

  return {
    challenge: toPublicChallengeDto(challenge, userId ? progress || null : undefined),
    rewardLink: await getRewardLinkSummary(userId, getChallengeScopeId(challenge)),
  };
};

export const getChallengeProgress = async (
  slug: string,
  userId: string
): Promise<{
  challenge: ReturnType<typeof toPublicChallengeDto>;
  progress: ReturnType<typeof toProgressDto>;
}> => {
  const challenge = await ensurePublishedChallenge(slug);
  await ensureChallengeScopeAccess(challenge, userId);
  const progress = await ChallengeProgress.findOne({
    userId: new Types.ObjectId(userId),
    challengeId: challenge._id,
  });

  return {
    challenge: toPublicChallengeDto(challenge),
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
  const challenge = await ensurePublishedChallenge(slug);
  await ensureChallengeScopeAccess(challenge, userId);
  const progress = await getOrCreateProgress(challenge, userId);

  return {
    challenge: toPublicChallengeDto(challenge),
    progress: toProgressDto(progress),
  };
};

export const submitChallenge = async (
  slug: string,
  userId: string,
  payload: unknown
): Promise<ChallengeSubmitResult> => {
  const challenge = await ensurePublishedChallenge(slug);
  const user = await User.findById(userId);
  if (!user) {
    throw new ChallengeServiceError('User not found.', 'INVALID_CHALLENGE_INPUT', 404);
  }

  ensureUserMatchesChallengeScope(challenge, user);

  if (challenge.reward?.enabled && !hasRewardIdentity(user)) {
    throw new ChallengeServiceError(
      'Link your Prizeversity account before completing rewardable challenges.',
      'REWARD_LINK_REQUIRED',
      403
    );
  }

  const progress = await getOrCreateProgress(challenge, userId);

  if (completedStatuses.includes(progress.status)) {
    return {
      accepted: true,
      completed: true,
      message: 'Challenge is already completed.',
      progress: toProgressDto(progress),
      reward: challenge.reward?.enabled
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

  if (challenge.maxAttempts && progress.attemptCount >= challenge.maxAttempts) {
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

  const reward = await completeChallengeProgress(challenge, user, progress);

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
  const rewardIntegrationInstanceId = await resolveRewardIntegrationInstanceId(
    input.rewardIntegrationInstanceId
  );
  const now = new Date();

  const challenge = await Challenge.create({
    key,
    slug,
    title,
    summary,
    description,
    instructions: cleanString(input.instructions) || undefined,
    status,
    kind: challengeKinds.includes(input.kind as ChallengeKind) ? input.kind : 'single',
    difficulty: challengeDifficulties.includes(input.difficulty as ChallengeDifficulty)
      ? input.difficulty
      : 'easy',
    estimatedMinutes: normalizeNumber(input.estimatedMinutes),
    tags: normalizeTags(input.tags),
    version: 1,
    publishedAt: status === 'published' ? now : null,
    archivedAt: status === 'archived' ? now : null,
    startsAt,
    endsAt,
    maxAttempts: normalizeNumber(input.maxAttempts),
    rewardIntegrationInstanceId: rewardIntegrationInstanceId || null,
    validation: normalizeValidation(input.validation, true),
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
  if (input.rewardIntegrationInstanceId !== undefined) {
    challenge.rewardIntegrationInstanceId =
      (await resolveRewardIntegrationInstanceId(input.rewardIntegrationInstanceId)) || null;
  }
  if (input.validation !== undefined) {
    challenge.validation = normalizeValidation(input.validation, true) as Record<string, unknown>;
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

  if (challenge.status === 'published') {
    throw new ChallengeServiceError(
      'Archive the challenge before deleting it.',
      'CHALLENGE_DELETE_BLOCKED',
      409,
      { status: challenge.status }
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
  options: { page?: number; limit?: number; status?: ChallengeSubmissionStatus } = {}
): Promise<ListResult<ReturnType<typeof toSubmissionDto>>> => {
  const challenge = await ensureChallengeById(challengeId);
  const { page, limit, skip } = normalizePagination(options.page, options.limit);
  const query: Record<string, unknown> = { challengeId: challenge._id };

  if (options.status) query.status = options.status;

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
  const reward = await completeChallengeProgress(challenge, submittedUser, progress);

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
