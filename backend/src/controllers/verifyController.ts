import type { Request, Response } from 'express';

import User from '../models/User';
import logger from '../config/logger';

const log = logger.child({ module: 'verifyController' });

export const verifyUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, secret } = req.body as { username?: string; secret?: string };

    if (!username || !secret) {
      res.json({
        valid: false,
        message: 'Username and secret are required',
      });
      return;
    }

    const user = await User.findOne({ username }).select('+nextChallengePassword');

    if (!user || !user.nextChallengePassword) {
      res.json({
        valid: false,
      });
      return;
    }

    const isValid = user.nextChallengePassword === secret;

    res.json({
      valid: isValid,
    });
  } catch (error: unknown) {
    log.error('verify user error.', error);
    res.json({
      valid: false,
      message: 'Server error',
    });
  }
};
