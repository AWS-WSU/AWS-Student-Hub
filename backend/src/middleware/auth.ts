import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import env from '../config/env';
import User from '../models/User';
import logger from '../config/logger';

const log = logger.child({ module: 'auth' });
type UserStatus = Express.UserStatus;

interface AccessTokenPayload extends jwt.JwtPayload {
  id: string;
  email?: string;
  tokenVersion?: number;
}

const getJwtSecret = (): string => {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return env.JWT_SECRET;
};

const isAccessTokenPayload = (decoded: string | jwt.JwtPayload): decoded is AccessTokenPayload => {
  return typeof decoded !== 'string' && typeof decoded.id === 'string';
};

const authenticateAccessToken = async (token: string): Promise<Express.UserPayload> => {
  const decoded = jwt.verify(token, getJwtSecret());

  if (!isAccessTokenPayload(decoded)) {
    throw new jwt.JsonWebTokenError('Token is malformed');
  }

  const user = await User.findById(decoded.id).select('tokenVersion status');

  if (!user) {
    throw new jwt.JsonWebTokenError('Token is not valid - user not found');
  }

  const userStatus = (user.status || 'active') as UserStatus;

  if (userStatus !== 'active') {
    throw new jwt.JsonWebTokenError('Account is not active');
  }

  if (decoded.tokenVersion !== user.tokenVersion) {
    throw new jwt.JsonWebTokenError('Token has been revoked');
  }

  return {
    id: decoded.id,
    email: decoded.email,
    tokenVersion: decoded.tokenVersion,
  };
};

const sendJwtError = (res: Response, err: unknown): void => {
  if (err instanceof jwt.TokenExpiredError) {
    res.status(401).json({
      error: 'Token has expired',
      expired: true,
    });
    return;
  }

  if (err instanceof jwt.JsonWebTokenError) {
    res.status(401).json({
      error: err.message || 'Token is malformed',
    });
    return;
  }

  log.error('jwt verification error.', err);
  res.status(401).json({
    error: 'Token is not valid',
  });
};

const checkJwt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      error: 'No token, authorization denied',
    });
    return;
  }

  try {
    req.user = await authenticateAccessToken(token);
    next();
  } catch (err: unknown) {
    sendJwtError(res, err);
  }
};

export const optionalJwt = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    req.user = await authenticateAccessToken(token);
    next();
  } catch (err: unknown) {
    sendJwtError(res, err);
  }
};

export default checkJwt;
