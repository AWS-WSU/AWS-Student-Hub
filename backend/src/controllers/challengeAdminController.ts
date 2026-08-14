import { Request, Response } from 'express';

import {
  ChallengeServiceError,
  archiveAdminChallenge,
  approveAdminChallengeSubmission,
  createAdminChallenge,
  deleteAdminChallenge,
  getAdminChallenge,
  listAdminChallengeProgress,
  listAdminChallengeSubmissions,
  listAdminChallenges,
  publishAdminChallenge,
  rejectAdminChallengeSubmission,
  testAdminChallengeValidation,
  updateAdminChallenge,
} from '../services/challengeService';
import type { ChallengeStatus } from '../models/Challenge';
import type { ChallengeProgressStatus } from '../models/ChallengeProgress';
import type { ChallengeSubmissionStatus } from '../models/ChallengeSubmission';

const getAdminUserId = (req: Request): string | null => req.user?.id || null;
const challengeStatuses: ChallengeStatus[] = ['draft', 'published', 'archived'];
const progressStatuses: ChallengeProgressStatus[] = [
  'not_started',
  'in_progress',
  'pending_review',
  'completed',
  'reward_pending',
  'reward_sent',
  'reward_failed',
];
const submissionStatuses: ChallengeSubmissionStatus[] = [
  'accepted',
  'pending_review',
  'rejected',
  'error',
];

const parseChallengeStatus = (value: unknown): ChallengeStatus | undefined => {
  return typeof value === 'string' && challengeStatuses.includes(value as ChallengeStatus)
    ? (value as ChallengeStatus)
    : undefined;
};

const parseProgressStatus = (value: unknown): ChallengeProgressStatus | undefined => {
  return typeof value === 'string' && progressStatuses.includes(value as ChallengeProgressStatus)
    ? (value as ChallengeProgressStatus)
    : undefined;
};

const parseSubmissionStatus = (value: unknown): ChallengeSubmissionStatus | undefined => {
  return typeof value === 'string' &&
    submissionStatuses.includes(value as ChallengeSubmissionStatus)
    ? (value as ChallengeSubmissionStatus)
    : undefined;
};

const getErrorBody = (error: unknown, fallback: string) => {
  if (error instanceof ChallengeServiceError) {
    return {
      error: error.message,
      code: error.code,
      details: error.details,
    };
  }

  return {
    error: error instanceof Error ? error.message : fallback,
  };
};

const getErrorStatus = (error: unknown, fallback = 500): number => {
  if (error instanceof ChallengeServiceError) return error.status;
  return fallback;
};

export const listChallenges = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await listAdminChallenges({
      status: parseChallengeStatus(req.query.status),
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page: Number(req.query.page),
      limit: Number(req.query.limit),
    });
    res.json(result);
  } catch (error: unknown) {
    res.status(getErrorStatus(error)).json(getErrorBody(error, 'Unable to list challenges'));
  }
};

export const createChallenge = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUserId = getAdminUserId(req);
    if (!adminUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const challenge = await createAdminChallenge(req.body || {}, adminUserId);
    res.status(201).json({
      message: 'Challenge created',
      challenge,
    });
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 400)).json(getErrorBody(error, 'Unable to create challenge'));
  }
};

export const getChallenge = async (req: Request, res: Response): Promise<void> => {
  try {
    const challenge = await getAdminChallenge(req.params.challengeId);
    res.json({ challenge });
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 404)).json(getErrorBody(error, 'Unable to load challenge'));
  }
};

export const updateChallenge = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUserId = getAdminUserId(req);
    if (!adminUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const challenge = await updateAdminChallenge(
      req.params.challengeId,
      req.body || {},
      adminUserId
    );
    res.json({
      message: 'Challenge updated',
      challenge,
    });
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 400)).json(getErrorBody(error, 'Unable to update challenge'));
  }
};

export const publishChallenge = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUserId = getAdminUserId(req);
    if (!adminUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const challenge = await publishAdminChallenge(req.params.challengeId, adminUserId);
    res.json({
      message: 'Challenge published',
      challenge,
    });
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 400)).json(getErrorBody(error, 'Unable to publish challenge'));
  }
};

export const archiveChallenge = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUserId = getAdminUserId(req);
    if (!adminUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const challenge = await archiveAdminChallenge(req.params.challengeId, adminUserId);
    res.json({
      message: 'Challenge archived',
      challenge,
    });
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 400)).json(getErrorBody(error, 'Unable to archive challenge'));
  }
};

export const deleteChallenge = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await deleteAdminChallenge(req.params.challengeId);
    res.json({
      message: 'Challenge deleted',
      ...result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 400)).json(getErrorBody(error, 'Unable to delete challenge'));
  }
};

export const listSubmissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUserId = getAdminUserId(req);
    if (!adminUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await listAdminChallengeSubmissions(req.params.challengeId, adminUserId, {
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      status: parseSubmissionStatus(req.query.status),
      rewardIntegrationInstanceId:
        typeof req.query.rewardIntegrationInstanceId === 'string'
          ? req.query.rewardIntegrationInstanceId
          : undefined,
    });
    res.json(result);
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 400)).json(getErrorBody(error, 'Unable to list submissions'));
  }
};

export const approveSubmission = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUserId = getAdminUserId(req);
    if (!adminUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await approveAdminChallengeSubmission(
      req.params.challengeId,
      req.params.submissionId,
      adminUserId,
      req.body?.message
    );
    res.json(result);
  } catch (error: unknown) {
    res
      .status(getErrorStatus(error, 400))
      .json(getErrorBody(error, 'Unable to approve submission'));
  }
};

export const rejectSubmission = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUserId = getAdminUserId(req);
    if (!adminUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await rejectAdminChallengeSubmission(
      req.params.challengeId,
      req.params.submissionId,
      adminUserId,
      req.body?.message
    );
    res.json(result);
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 400)).json(getErrorBody(error, 'Unable to reject submission'));
  }
};

export const listProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUserId = getAdminUserId(req);
    if (!adminUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await listAdminChallengeProgress(req.params.challengeId, adminUserId, {
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      status: parseProgressStatus(req.query.status),
      rewardIntegrationInstanceId:
        typeof req.query.rewardIntegrationInstanceId === 'string'
          ? req.query.rewardIntegrationInstanceId
          : undefined,
    });
    res.json(result);
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 400)).json(getErrorBody(error, 'Unable to list progress'));
  }
};

export const testValidation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId =
      typeof req.body?.userId === 'string' && req.body.userId.trim()
        ? req.body.userId.trim()
        : req.user?.id;
    if (!userId) {
      res.status(400).json({ error: 'A userId is required to test challenge validation.' });
      return;
    }

    const result = await testAdminChallengeValidation(
      req.params.challengeId,
      userId,
      req.body?.payload
    );
    res.json(result);
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 501)).json(getErrorBody(error, 'Unable to test validation'));
  }
};
