import { Request, Response } from 'express';

import {
  createRewardIntegrationInstance,
  deactivateRewardIntegrationInstance,
  listRewardIntegrationInstances,
  testRewardIntegrationInstance,
  updateRewardIntegrationInstance,
} from '../services/rewardIntegrationService';

const getAdminUserId = (req: Request): string | null => req.user?.id || null;

const getErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof Error ? error.message : fallback;
};

export const listInstances = async (req: Request, res: Response): Promise<void> => {
  try {
    const instances = await listRewardIntegrationInstances();
    res.json({ instances });
  } catch (error: unknown) {
    res.status(500).json({
      error: getErrorMessage(error, 'Unable to list reward integration instances'),
    });
  }
};

export const createInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUserId = getAdminUserId(req);
    if (!adminUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const instance = await createRewardIntegrationInstance(req.body || {}, adminUserId);
    res.status(201).json({
      message: 'Reward integration instance created',
      instance,
    });
  } catch (error: unknown) {
    res.status(400).json({
      error: getErrorMessage(error, 'Unable to create reward integration instance'),
    });
  }
};

export const updateInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUserId = getAdminUserId(req);
    if (!adminUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const instance = await updateRewardIntegrationInstance(
      req.params.instanceId,
      req.body || {},
      adminUserId
    );
    res.json({
      message: 'Reward integration instance updated',
      instance,
    });
  } catch (error: unknown) {
    res.status(400).json({
      error: getErrorMessage(error, 'Unable to update reward integration instance'),
    });
  }
};

export const testInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUserId = getAdminUserId(req);
    if (!adminUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await testRewardIntegrationInstance(req.params.instanceId, adminUserId);
    res.json({
      message: 'Reward integration instance verified',
      ...result,
    });
  } catch (error: unknown) {
    res.status(400).json({
      error: getErrorMessage(error, 'Unable to verify reward integration instance'),
    });
  }
};

export const deactivateInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUserId = getAdminUserId(req);
    if (!adminUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const instance = await deactivateRewardIntegrationInstance(req.params.instanceId, adminUserId);
    res.json({
      message: 'Reward integration instance deactivated',
      instance,
    });
  } catch (error: unknown) {
    res.status(400).json({
      error: getErrorMessage(error, 'Unable to deactivate reward integration instance'),
    });
  }
};
