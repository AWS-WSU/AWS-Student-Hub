const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { requireAdmin } = require('../middleware/adminAuth');
const { upload } = require('../middleware/upload');

router.get('/public', eventController.listPublicEvents);

router.get('/admin', requireAdmin, eventController.adminList);
router.get('/:eventId', eventController.getEvent);
router.post('/', requireAdmin, upload.single('thumbnail'), eventController.createEvent);
router.put('/:eventId', requireAdmin, upload.single('thumbnail'), eventController.updateEvent);
router.delete('/:eventId', requireAdmin, eventController.deleteEvent);
router.post('/:eventId/notify', requireAdmin, eventController.sendEventNotification);

module.exports = router;
