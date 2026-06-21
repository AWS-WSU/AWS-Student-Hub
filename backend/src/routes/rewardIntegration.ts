import { Router, Request, Response } from 'express';

import checkJwt from '../middleware/auth';
import User from '../models/User';
import {
  getPrizeversityStatus,
  startPrizeversityAccountLink,
  unlinkPrizeversityAccount,
  verifyPrizeversityAccountLink,
} from '../services/rewardIntegrationService';

const router = Router();

const getAuthenticatedUser = async (req: Request) => {
  if (!req.user?.id) return null;
  return User.findById(req.user.id);
};

const getErrorStatus = (error: unknown, fallback = 400): number => {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' && status >= 400 && status < 600 ? status : fallback;
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
    const verification = await startPrizeversityAccountLink(user, { identifier, instanceId });

    res.json({
      message: `Verification code sent to ${verification.maskedEmail}`,
      ...verification,
      status: await getPrizeversityStatus(user),
      user: user.toSafeObject(),
    });
  } catch (error: unknown) {
    res.status(getErrorStatus(error)).json({
      error: error instanceof Error ? error.message : 'Unable to link Prizeversity account',
    });
  }
});

router.post('/link/verify', checkJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    await verifyPrizeversityAccountLink(user, code);

    res.json({
      message: 'Prizeversity account linked successfully',
      status: await getPrizeversityStatus(user),
      user: user.toSafeObject(),
    });
  } catch (error: unknown) {
    res.status(getErrorStatus(error)).json({
      error: error instanceof Error ? error.message : 'Unable to verify Prizeversity link code',
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
