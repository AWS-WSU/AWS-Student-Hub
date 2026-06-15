import { Router, Request, Response } from 'express';

import checkJwt from '../middleware/auth';
import User from '../models/User';
import {
  getPrizeversityStatus,
  linkPrizeversityAccount,
  unlinkPrizeversityAccount,
} from '../services/rewardIntegrationService';

const router = Router();

const getAuthenticatedUser = async (req: Request) => {
  if (!req.user?.id) return null;
  return User.findById(req.user.id);
};

router.get('/status', checkJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(await getPrizeversityStatus(user));
  } catch {
    res.status(500).json({ error: 'Unable to load Prizeversity status' });
  }
});

router.post('/link', checkJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const identifier =
      typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : undefined;
    const instanceId =
      typeof req.body?.instanceId === 'string' ? req.body.instanceId.trim() : undefined;
    await linkPrizeversityAccount(user, { identifier, instanceId });

    res.json({
      message: 'Prizeversity account linked successfully',
      status: await getPrizeversityStatus(user),
      user: user.toSafeObject(),
    });
  } catch (error: unknown) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Unable to link Prizeversity account',
    });
  }
});

router.delete('/link', checkJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await unlinkPrizeversityAccount(user);

    res.json({
      message: 'Prizeversity account unlinked successfully',
      status: await getPrizeversityStatus(user),
      user: user.toSafeObject(),
    });
  } catch {
    res.status(500).json({ error: 'Unable to unlink Prizeversity account' });
  }
});

export default router;
