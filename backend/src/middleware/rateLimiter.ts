import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

import env from '../config/env';

const getHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const customKeyGenerator = (req: Request): string => {
  if (env.IS_LAMBDA) {
    const forwardedFor = getHeaderValue(req.headers['x-forwarded-for']);
    const realIp = getHeaderValue(req.headers['x-real-ip']);

    return (
      forwardedFor?.split(',')[0]?.trim() ||
      realIp ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  return req.ip || 'unknown';
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many authentication attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: 'Too many password reset attempts. Please try again in 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: 'Too many signup attempts. Please try again in 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});
