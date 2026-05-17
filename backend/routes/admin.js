const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin, requireModerator, canManageUser } = require('../middleware/adminAuth');

// Dashboard routes
router.get('/dashboard/stats', requireModerator, adminController.getDashboardStats);

// User management routes
router.get('/users', requireModerator, adminController.getAllUsers);
router.get('/users/:userId', requireModerator, adminController.getUserDetails);

// Role management (admin only)
router.put('/users/:userId/role', requireAdmin, canManageUser, adminController.updateUserRole);

// User moderation (moderator can ban, admin can delete)
router.put('/users/:userId/ban', requireModerator, canManageUser, adminController.banUser);
router.put('/users/:userId/unban', requireModerator, canManageUser, adminController.unbanUser);
router.delete('/users/:userId', requireAdmin, canManageUser, adminController.deleteUser);

// Email Queue management (admin only)
router.get('/email-queue/stats', requireAdmin, adminController.getEmailQueueStats);
router.get('/email-queue/entries', requireAdmin, adminController.getEmailQueueEntries);
router.post('/email-queue/:queueId/retry', requireAdmin, adminController.retryQueuedEmail);
router.post('/email-queue/process', requireAdmin, adminController.processQueue);

module.exports = router;
