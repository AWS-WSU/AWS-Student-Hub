import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';

import User from '../models/User';

type Role = Express.UserRole;

interface AdminTokenPayload extends jwt.JwtPayload {
  id: string;
}

const roleHierarchy: Record<Role, number> = {
  member: 0,
  moderator: 1,
  admin: 2,
  superuser: 3,
};

const getJwtSecret = (): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return process.env.JWT_SECRET;
};

const isAdminTokenPayload = (decoded: string | jwt.JwtPayload): decoded is AdminTokenPayload => {
  return typeof decoded !== 'string' && typeof decoded.id === 'string';
};

export const requireRole = (minRole: Role = 'member'): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.header('Authorization');
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        res.status(401).json({
          error: 'Access denied. No token provided.',
        });
        return;
      }

      const decoded = jwt.verify(token, getJwtSecret());

      if (!isAdminTokenPayload(decoded)) {
        res.status(401).json({
          error: 'Invalid token.',
        });
        return;
      }

      const user = await User.findById(decoded.id).select('+role +status email');

      if (!user) {
        res.status(401).json({
          error: 'Invalid token. User not found.',
        });
        return;
      }

      if (user.status !== 'active') {
        res.status(403).json({
          error: `Account is ${user.status}. Access denied.`,
        });
        return;
      }

      const userRole = (user.role || 'member') as Role;
      const userRoleLevel = roleHierarchy[userRole] || 0;
      const requiredRoleLevel = roleHierarchy[minRole] || 0;

      if (userRoleLevel < requiredRoleLevel) {
        res.status(403).json({
          error: 'Insufficient permissions. Admin access required.',
        });
        return;
      }

      req.user = {
        id: String(user._id),
        email: user.email,
        role: userRole,
        status: user.status,
      };

      next();
    } catch (err: unknown) {
      console.error('admin auth middleware error.', err);
      res.status(401).json({
        error: 'Invalid token.',
      });
    }
  };
};

export const requireModerator = requireRole('moderator');
export const requireAdmin = requireRole('admin');
export const requireSuperuser = requireRole('superuser');

export const canManageUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.role) {
      res.status(401).json({
        error: 'Authentication required',
      });
      return;
    }

    const targetUserId = req.params.userId || req.body?.userId;
    const targetUser = await User.findById(targetUserId).select('role');

    if (!targetUser) {
      res.status(404).json({
        error: 'Target user not found',
      });
      return;
    }

    const currentUserLevel = roleHierarchy[req.user.role] || 0;
    const targetUserRole = (targetUser.role || 'member') as Role;
    const targetUserLevel = roleHierarchy[targetUserRole] || 0;

    if (currentUserLevel <= targetUserLevel) {
      res.status(403).json({
        error: 'Cannot manage user with equal or higher privileges',
      });
      return;
    }

    req.targetUser = { role: targetUserRole };
    next();
  } catch (error: unknown) {
    console.error('can manage user check error.', error);
    res.status(500).json({
      error: 'Error checking user permissions',
    });
  }
};
