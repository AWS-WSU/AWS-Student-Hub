import { Types } from 'mongoose';

import type { IChallengeDocument, IChallengeRewardConfig } from '../models/Challenge';
import type { IChallengeProgressDocument } from '../models/ChallengeProgress';
import RewardIntegrationEmission from '../models/RewardIntegrationEmission';
import type { IUserDocument } from '../models/User';
import { grantPrizeversityChallengeReward } from './rewardIntegrationService';

export interface ChallengeCompletionEvent {
  eventId: string;
  userId: Types.ObjectId;
  challengeId: Types.ObjectId;
  challengeKey: string;
  challengeTitle: string;
  progressId: Types.ObjectId;
  completedAt: Date;
  rewardIntegrationInstanceId?: string | null;
  reward: IChallengeRewardConfig;
}

export interface RewardGrantResult {
  status: 'not_required' | 'sent' | 'already_sent' | 'failed';
  emissionId?: string;
  message?: string;
  response?: Record<string, unknown> | null;
}

export class ChallengeRewardError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ChallengeRewardError';
    this.status = status;
  }
}

export const buildChallengeCompletionEvent = (
  user: IUserDocument,
  challenge: IChallengeDocument,
  progress: IChallengeProgressDocument
): ChallengeCompletionEvent => {
  const completedAt = progress.completedAt || new Date();
  return {
    eventId: `challenge-completed:${String(user._id)}:${challenge.key}`,
    userId: user._id,
    challengeId: challenge._id,
    challengeKey: challenge.key,
    challengeTitle: challenge.title,
    progressId: progress._id,
    completedAt,
    rewardIntegrationInstanceId: challenge.rewardIntegrationInstanceId?.toString() || null,
    reward: challenge.reward,
  };
};

const getCompletionXp = (reward: IChallengeRewardConfig) => {
  if (reward.xpMode === 'none') return { mode: 'none' as const };
  if (reward.xpMode === 'classroom') return { mode: 'classroom' as const };
  return {
    mode: 'custom' as const,
    xpAmount: reward.xpAmount || 0,
  };
};

export const hasRewardIdentity = (user: IUserDocument): boolean => {
  return Boolean(user.prizeversityUserId && user.prizeversityClassroomId);
};

export const grantChallengeCompletionReward = async (
  event: ChallengeCompletionEvent,
  user: IUserDocument
): Promise<RewardGrantResult> => {
  if (!event.reward?.enabled) {
    return {
      status: 'not_required',
      message: 'Challenge has no reward configured.',
    };
  }

  if (!hasRewardIdentity(user)) {
    throw new ChallengeRewardError(
      'Link your Prizeversity account before completing rewardable challenges.',
      403
    );
  }

  try {
    const targetRewardIntegrationInstanceId =
      event.rewardIntegrationInstanceId || user.rewardIntegrationInstanceId?.toString();

    if (
      event.rewardIntegrationInstanceId &&
      user.rewardIntegrationInstanceId?.toString() !== event.rewardIntegrationInstanceId
    ) {
      throw new ChallengeRewardError(
        'This challenge belongs to a different Prizeversity classroom.',
        403
      );
    }

    const result = await grantPrizeversityChallengeReward({
      awsUserId: event.userId,
      prizeversityUserId: user.prizeversityUserId as string,
      rewardIntegrationInstanceId: targetRewardIntegrationInstanceId,
      classroomId: user.prizeversityClassroomId,
      challengeKey: event.challengeKey,
      activityName: event.reward.activityName || event.challengeTitle,
      description: event.reward.description || `Completed ${event.challengeTitle}`,
      bits: event.reward.bits || 0,
      stats: event.reward.stats || {},
      completionXP: getCompletionXp(event.reward),
      applyGroupMultipliers: event.reward.applyGroupMultipliers !== false,
      applyPersonalMultipliers: event.reward.applyPersonalMultipliers !== false,
    });

    return {
      status: result.alreadySent ? 'already_sent' : 'sent',
      emissionId: result.emissionId,
      response: result.response,
      message: result.alreadySent ? 'Reward already sent.' : 'Reward sent.',
    };
  } catch (error: unknown) {
    const emission = await RewardIntegrationEmission.findOne({
      awsUserId: event.userId,
      classroomId: user.prizeversityClassroomId,
      challengeKey: event.challengeKey,
    });

    return {
      status: 'failed',
      emissionId: emission?._id?.toString(),
      message: error instanceof Error ? error.message : 'Reward emission failed.',
    };
  }
};
