import { Request, Response } from 'express';

import {
  ChallengeServiceError,
  archiveAdminChallenge,
  createAdminChallenge,
  getAdminChallenge,
  listAdminChallengeProgress,
  listAdminChallengeSubmissions,
  listAdminChallenges,
  publishAdminChallenge,
  testAdminChallengeValidation,
  updateAdminChallenge,
} from '../services/challengeService';

const getAdminUserId = (req: Request): string | null => req.user?.id || null;

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
      status: typeof req.query.status === 'string' ? (req.query.status as any) : undefined,
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

export const listSubmissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await listAdminChallengeSubmissions(req.params.challengeId, {
      page: Number(req.query.page),
      limit: Number(req.query.limit),
    });
    res.json(result);
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 400)).json(getErrorBody(error, 'Unable to list submissions'));
  }
};

export const listProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await listAdminChallengeProgress(req.params.challengeId, {
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      status: typeof req.query.status === 'string' ? (req.query.status as any) : undefined,
    });
    res.json(result);
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 400)).json(getErrorBody(error, 'Unable to list progress'));
  }
};

export const testValidation = async (_req: Request, res: Response): Promise<void> => {
  try {
    await testAdminChallengeValidation();
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 501)).json(getErrorBody(error, 'Unable to test validation'));
  }
};
