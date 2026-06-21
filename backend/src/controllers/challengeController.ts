import { Request, Response } from 'express';

import {
  ChallengeServiceError,
  getChallengeProgress,
  getPublishedChallenge,
  listPublishedChallenges,
  startChallenge,
  submitChallenge,
} from '../services/challengeService';

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
    const result = await listPublishedChallenges({
      userId: req.user?.id,
      tag: typeof req.query.tag === 'string' ? req.query.tag : undefined,
      difficulty:
        typeof req.query.difficulty === 'string' ? (req.query.difficulty as any) : undefined,
    });
    res.json(result);
  } catch (error: unknown) {
    res.status(getErrorStatus(error)).json(getErrorBody(error, 'Unable to list challenges'));
  }
};

export const getChallenge = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await getPublishedChallenge(req.params.slug, req.user?.id);
    res.json(result);
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 404)).json(getErrorBody(error, 'Unable to load challenge'));
  }
};

export const getProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await getChallengeProgress(req.params.slug, req.user.id);
    res.json(result);
  } catch (error: unknown) {
    res
      .status(getErrorStatus(error, 400))
      .json(getErrorBody(error, 'Unable to load challenge progress'));
  }
};

export const start = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await startChallenge(req.params.slug, req.user.id);
    res.json(result);
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 400)).json(getErrorBody(error, 'Unable to start challenge'));
  }
};

export const submit = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    await submitChallenge(req.params.slug, req.user.id, req.body?.payload);
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 400)).json(getErrorBody(error, 'Unable to submit challenge'));
  }
};
