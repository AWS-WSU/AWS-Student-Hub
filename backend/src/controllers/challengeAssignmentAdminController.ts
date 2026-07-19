import { Request, Response } from 'express';

import {
  createInstanceChallengeAssignment,
  listInstanceChallengeAssignments,
  removeInstanceChallengeAssignment,
  updateInstanceChallengeAssignment,
} from '../services/challengeAssignmentService';
import { ChallengeServiceError } from '../services/challengeService';

const sendError = (res: Response, error: unknown, fallback: string): void => {
  if (error instanceof ChallengeServiceError) {
    res.status(error.status).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
    return;
  }
  res.status(500).json({ error: error instanceof Error ? error.message : fallback });
};

export const listAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await listInstanceChallengeAssignments(req.params.instanceId));
  } catch (error: unknown) {
    sendError(res, error, 'Unable to list challenge assignments');
  }
};

export const createAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const assignment = await createInstanceChallengeAssignment(
      req.params.instanceId,
      req.body || {},
      req.user.id
    );
    res.status(201).json({ message: 'Challenge assigned', assignment });
  } catch (error: unknown) {
    sendError(res, error, 'Unable to assign challenge');
  }
};

export const updateAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const assignment = await updateInstanceChallengeAssignment(
      req.params.instanceId,
      req.params.assignmentId,
      req.body || {},
      req.user.id
    );
    res.json({ message: 'Challenge assignment updated', assignment });
  } catch (error: unknown) {
    sendError(res, error, 'Unable to update challenge assignment');
  }
};

export const removeAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const result = await removeInstanceChallengeAssignment(
      req.params.instanceId,
      req.params.assignmentId,
      req.user.id
    );
    res.json({
      message: result.archived
        ? 'Challenge assignment archived because student progress exists'
        : 'Challenge assignment removed',
      ...result,
    });
  } catch (error: unknown) {
    sendError(res, error, 'Unable to remove challenge assignment');
  }
};
