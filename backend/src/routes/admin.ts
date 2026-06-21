import express from 'express';

import * as adminController from '../controllers/adminController';
import * as challengeAdminController from '../controllers/challengeAdminController';
import * as rewardIntegrationAdminController from '../controllers/rewardIntegrationAdminController';
import { canManageUser, requireAdmin, requireModerator } from '../middleware/adminAuth';

const router = express.Router();

router.get('/dashboard/stats', requireModerator, adminController.getDashboardStats);
router.get('/users', requireModerator, adminController.getAllUsers);
router.get('/users/:userId', requireModerator, adminController.getUserDetails);
router.put('/users/:userId/role', requireAdmin, canManageUser, adminController.updateUserRole);
router.put('/users/:userId/ban', requireModerator, canManageUser, adminController.banUser);
router.put('/users/:userId/unban', requireModerator, canManageUser, adminController.unbanUser);
router.delete('/users/:userId', requireAdmin, canManageUser, adminController.deleteUser);
router.get('/email-queue/stats', requireAdmin, adminController.getEmailQueueStats);
router.get('/email-queue/entries', requireAdmin, adminController.getEmailQueueEntries);
router.post('/email-queue/:queueId/retry', requireAdmin, adminController.retryQueuedEmail);
router.post('/email-queue/process', requireAdmin, adminController.processQueue);
router.get('/challenges', requireAdmin, challengeAdminController.listChallenges);
router.post('/challenges', requireAdmin, challengeAdminController.createChallenge);
router.get('/challenges/:challengeId', requireAdmin, challengeAdminController.getChallenge);
router.patch('/challenges/:challengeId', requireAdmin, challengeAdminController.updateChallenge);
router.post(
  '/challenges/:challengeId/publish',
  requireAdmin,
  challengeAdminController.publishChallenge
);
router.post(
  '/challenges/:challengeId/archive',
  requireAdmin,
  challengeAdminController.archiveChallenge
);
router.get(
  '/challenges/:challengeId/submissions',
  requireAdmin,
  challengeAdminController.listSubmissions
);
router.get(
  '/challenges/:challengeId/progress',
  requireAdmin,
  challengeAdminController.listProgress
);
router.post(
  '/challenges/:challengeId/test-validation',
  requireAdmin,
  challengeAdminController.testValidation
);
router.get('/reward-integrations', requireAdmin, rewardIntegrationAdminController.listInstances);
router.post('/reward-integrations', requireAdmin, rewardIntegrationAdminController.createInstance);
router.put(
  '/reward-integrations/:instanceId',
  requireAdmin,
  rewardIntegrationAdminController.updateInstance
);
router.post(
  '/reward-integrations/:instanceId/test',
  requireAdmin,
  rewardIntegrationAdminController.testInstance
);
router.delete(
  '/reward-integrations/:instanceId',
  requireAdmin,
  rewardIntegrationAdminController.deactivateInstance
);

export default router;
