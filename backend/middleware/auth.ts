import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import User from '../models/User';

interface AccessTokenPayload extends jwt.JwtPayload {
  id: string;
  email?: string;
  tokenVersion?: number;
}

const getJwtSecret = (): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return process.env.JWT_SECRET;
};

const isAccessTokenPayload = (decoded: string | jwt.JwtPayload): decoded is AccessTokenPayload => {
  return typeof decoded !== 'string' && typeof decoded.id === 'string';
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
    const decoded = jwt.verify(token, getJwtSecret());

    if (!isAccessTokenPayload(decoded)) {
      res.status(401).json({
        error: 'Token is malformed',
      });
      return;
    }

    const user = await User.findById(decoded.id).select('tokenVersion status');

    if (!user) {
      res.status(401).json({
        error: 'Token is not valid - user not found',
      });
      return;
    }

    if (user.status !== 'active') {
      res.status(401).json({
        error: 'Account is not active',
      });
      return;
    }

    if (decoded.tokenVersion !== user.tokenVersion) {
      res.status(401).json({
        error: 'Token has been revoked',
      });
      return;
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      tokenVersion: decoded.tokenVersion,
    };

    next();
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Token has expired',
        expired: true,
      });
      return;
    }

    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Token is malformed',
      });
      return;
    }

    console.error('JWT verification error:', err);
    res.status(401).json({
      error: 'Token is not valid',
    });
  }
};

export default checkJwt;
