import express from 'express';

import * as eventController from '../controllers/eventController';
import { requireAdmin } from '../middleware/adminAuth';
import { upload } from '../middleware/upload';

const router = express.Router();

router.get('/public', eventController.listPublicEvents);
router.get('/admin', requireAdmin, eventController.adminList);
router.get('/:eventId', eventController.getEvent);
router.post('/', requireAdmin, upload.single('thumbnail'), eventController.createEvent);
router.put('/:eventId', requireAdmin, upload.single('thumbnail'), eventController.updateEvent);
router.delete('/:eventId', requireAdmin, eventController.deleteEvent);
router.post('/:eventId/notify', requireAdmin, eventController.sendEventNotification);

export default router;
