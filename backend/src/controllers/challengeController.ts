import { Request, Response } from 'express';

import type { ChallengeDifficulty } from '../models/Challenge';
import {
  ChallengeServiceError,
  getCipheredSealRouteState,
  getChallengeProgress,
  getPublishedChallenge,
  listPublishedChallenges,
  resolveCipheredSealRouteSeed,
  startChallenge,
  submitChallenge,
} from '../services/challengeService';

const parseChallengeDifficulty = (value: unknown): ChallengeDifficulty | undefined => {
  if (value === 'easy' || value === 'medium' || value === 'hard' || value === 'expert') {
    return value;
  }
  return undefined;
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
    const result = await listPublishedChallenges({
      userId: req.user?.id,
      tag: typeof req.query.tag === 'string' ? req.query.tag : undefined,
      difficulty: parseChallengeDifficulty(req.query.difficulty),
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

export const getCipheredSealState = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await getCipheredSealRouteState(req.params.routeKey, req.user.id);
    res.json(result);
  } catch (error: unknown) {
    res
      .status(getErrorStatus(error, 404))
      .json(getErrorBody(error, 'Unable to load Ciphered Seal Protocol'));
  }
};

export const resolveCipheredSealSeed = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await resolveCipheredSealRouteSeed(
      req.params.routeKey,
      req.user.id,
      req.body?.seedNumber
    );
    res.json(result);
  } catch (error: unknown) {
    res
      .status(getErrorStatus(error, 400))
      .json(getErrorBody(error, 'Unable to resolve the seal values'));
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

    const result = await submitChallenge(req.params.slug, req.user.id, req.body?.payload);
    res.json(result);
  } catch (error: unknown) {
    res.status(getErrorStatus(error, 400)).json(getErrorBody(error, 'Unable to submit challenge'));
  }
};
