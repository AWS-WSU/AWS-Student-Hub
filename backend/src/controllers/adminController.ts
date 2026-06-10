import type { Request, Response } from 'express';

import logger from '../config/logger';
import Newsletter from '../models/Newsletter';
import User from '../models/User';
import {
  getQueueEntries,
  getQueueStats,
  processEmailQueue,
  retryFailedEmail,
} from '../services/emailService';

const log = logger.child({ module: 'adminController' });

const parseInteger = (value: unknown, fallback: number): number => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const queryString = (value: unknown): string => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' ? rawValue : '';
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

export const getDashboardStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalUsers, activeUsers, bannedUsers, adminUsers, recentSignups, newsletterSubscribers] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ status: 'active' }),
        User.countDocuments({ status: 'banned' }),
        User.countDocuments({ role: { $in: ['admin', 'superuser'] } }),
        User.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        }),
        Newsletter.countDocuments(),
      ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        bannedUsers,
        adminUsers,
        recentSignups,
        newsletterSubscribers,
      },
    });
  } catch (error: unknown) {
    log.error('get dashboard stats error.', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching dashboard stats',
    });
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInteger(req.query.page, 1);
    const limit = parseInteger(req.query.limit, 20);
    const skip = (page - 1) * limit;
    const search = queryString(req.query.search);
    const roleFilter = queryString(req.query.role);
    const statusFilter = queryString(req.query.status);

    const filter: Record<string, unknown> = {};

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (roleFilter) {
      filter.role = roleFilter;
    }

    if (statusFilter) {
      filter.status = statusFilter;
    }

    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select(
          'username fullName email role status profilePicture createdAt lastLogin bannedAt bannedBy banReason'
        )
        .populate('bannedBy', 'username fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalUsers / limit);

    res.json({
      success: true,
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error: unknown) {
    log.error('get all users error.', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching users',
    });
  }
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body as { role?: string };

    if (!role || !['member', 'moderator', 'admin', 'superuser'].includes(role)) {
      res.status(400).json({
        success: false,
        error: 'Invalid role specified',
      });
      return;
    }

    if ((role === 'admin' || role === 'superuser') && req.user?.role !== 'superuser') {
      res.status(403).json({
        success: false,
        error: 'Only superusers can assign admin or superuser roles',
      });
      return;
    }

    const user = await User.findByIdAndUpdate(userId, { role }, { new: true }).select(
      'username fullName email role status'
    );

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user,
    });
  } catch (error: unknown) {
    log.error('update user role error.', error);
    res.status(500).json({
      success: false,
      error: 'Error updating user role',
    });
  }
};

export const banUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { reason } = req.body as { reason?: string };

    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        status: 'banned',
        bannedAt: new Date(),
        bannedBy: req.user.id,
        banReason: reason || 'No reason provided',
      },
      { new: true }
    ).select('username fullName email role status bannedAt banReason');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'User banned successfully',
      user,
    });
  } catch (error: unknown) {
    log.error('ban user error.', error);
    res.status(500).json({
      success: false,
      error: 'Error banning user',
    });
  }
};

export const unbanUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        status: 'active',
        bannedAt: null,
        bannedBy: null,
        banReason: null,
      },
      { new: true }
    ).select('username fullName email role status');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'User unbanned successfully',
      user,
    });
  } catch (error: unknown) {
    log.error('unban user error.', error);
    res.status(500).json({
      success: false,
      error: 'Error unbanning user',
    });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (req.targetUser?.role === 'superuser' && req.user?.role !== 'superuser') {
      res.status(403).json({
        success: false,
        error: 'Cannot delete superuser account',
      });
      return;
    }

    if (userId === req.user?.id) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete your own account',
      });
      return;
    }

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: unknown) {
    log.error('delete user error.', error);
    res.status(500).json({
      success: false,
      error: 'Error deleting user',
    });
  }
};

export const getUserDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select(
        'username fullName email role status profilePicture createdAt lastLogin bannedAt bannedBy banReason'
      )
      .populate('bannedBy', 'username fullName');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      user,
    });
  } catch (error: unknown) {
    log.error('get user details error.', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching user details',
    });
  }
};

export const getEmailQueueStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getQueueStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error: unknown) {
    log.error('get email queue stats error.', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching email queue stats',
    });
  }
};

export const getEmailQueueEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = queryString(req.query.status) || null;
    const page = parseInteger(req.query.page, 1);
    const limit = parseInteger(req.query.limit, 20);
    const result = await getQueueEntries(status, page, limit);
    res.json({
      success: true,
      ...((result as Record<string, unknown>) || {}),
    });
  } catch (error: unknown) {
    log.error('get email queue entries error.', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching email queue entries',
    });
  }
};

export const retryQueuedEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { queueId } = req.params;
    const result = await retryFailedEmail(queueId);
    res.json({
      success: true,
      message: 'Email retry initiated',
      result,
    });
  } catch (error: unknown) {
    log.error('retry queued email error.', error);
    res.status(500).json({
      success: false,
      error: getErrorMessage(error) || 'Error retrying email',
    });
  }
};

export const processQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const batchSize = parseInteger(req.query.batchSize, 10);
    const result = await processEmailQueue(batchSize);
    res.json({
      success: true,
      message: 'Queue processing completed',
      result,
    });
  } catch (error: unknown) {
    log.error('process queue error.', error);
    res.status(500).json({
      success: false,
      error: 'Error processing email queue',
    });
  }
};
