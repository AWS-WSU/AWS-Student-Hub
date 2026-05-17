const Event = require('../models/Event');
const User = require('../models/User');
const { Upload } = require('@aws-sdk/lib-storage');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { sendBulkEventNotification } = require('../services/emailService');

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  region: process.env.S3_REGION,
});

exports.createEvent = async (req, res) => {
  try {
    const {
      title,
      startTime,
      isRemote,
      zoomLink,
      address,
      directions,
      locationName,
      meetupUrl,
      status,
      description,
    } = req.body;

    if (!title || !startTime || typeof isRemote === 'undefined') {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    if (!isRemote && directions && directions.length > 250) {
      return res
        .status(400)
        .json({ success: false, error: 'Directions must be at most 250 characters' });
    }

    let thumbnailUrl = '';

    if (req.file) {
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: process.env.AWS_HUB_EVENT_THUMBNAILS,
          Key: `event-thumbnails/${Date.now()}-${req.file.originalname}`,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          CacheControl: 'public, max-age=31536000',
        },
      });
      const result = await upload.done();
      thumbnailUrl = result.Location;
    }

    const isRemoteBool = String(isRemote) === 'true';

    const event = await Event.create({
      title,
      startTime: new Date(startTime),
      isRemote: isRemoteBool,
      zoomLink: isRemoteBool ? zoomLink || '' : '',
      address: !isRemoteBool ? address || '' : '',
      directions: !isRemoteBool ? directions || '' : '',
      locationName: !isRemoteBool ? locationName || '' : '',
      description: description || '',
      meetupUrl: meetupUrl || '',
      thumbnailUrl,
      status: status || 'published',
      createdBy: req.user.id,
    });

    res.json({ success: true, event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ success: false, error: 'Error creating event' });
  }
};

exports.listPublicEvents = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const now = new Date();
    const events = await Event.find({ status: 'published', startTime: { $gte: now } })
      .sort({ startTime: 1 })
      .limit(limit)
      .select('-__v');
    res.json({ success: true, events });
  } catch (error) {
    console.error('List events error:', error);
    // Check if it's a MongoDB connection error
    if (
      error.name === 'MongoServerSelectionError' ||
      error.name === 'MongoNetworkError' ||
      error.message?.includes('connection')
    ) {
      return res
        .status(503)
        .json({ success: false, error: 'Service temporarily unavailable. Please try again.' });
    }
    res.status(500).json({ success: false, error: 'Error fetching events' });
  }
};

exports.getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    res.json({ success: true, event });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ success: false, error: 'Error fetching event' });
  }
};

exports.adminList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const [events, total] = await Promise.all([
      Event.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Event.countDocuments(),
    ]);
    res.json({
      success: true,
      events,
      pagination: { page, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Admin list events error:', error);
    res.status(500).json({ success: false, error: 'Error fetching events' });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const {
      title,
      startTime,
      isRemote,
      zoomLink,
      address,
      directions,
      locationName,
      meetupUrl,
      status,
      description,
    } = req.body;

    if (typeof isRemote !== 'undefined' && !isRemote && directions && directions.length > 250) {
      return res
        .status(400)
        .json({ success: false, error: 'Directions must be at most 250 characters' });
    }

    const update = {};
    if (title !== undefined) update.title = title;
    if (startTime !== undefined) update.startTime = new Date(startTime);
    if (typeof isRemote !== 'undefined') update.isRemote = String(isRemote) === 'true';
    if (meetupUrl !== undefined) update.meetupUrl = meetupUrl;
    if (status !== undefined) update.status = status;
    if (description !== undefined) update.description = description;

    if (typeof isRemote !== 'undefined') {
      if (String(isRemote) === 'true') {
        update.zoomLink = zoomLink || '';
        update.address = '';
        update.directions = '';
        update.locationName = '';
      } else {
        update.zoomLink = '';
        update.address = address || '';
        update.directions = directions || '';
        update.locationName = locationName || '';
      }
    } else {
      if (zoomLink !== undefined) update.zoomLink = zoomLink;
      if (address !== undefined) update.address = address;
      if (directions !== undefined) update.directions = directions;
      if (locationName !== undefined) update.locationName = locationName;
    }

    if (req.file) {
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: process.env.AWS_HUB_EVENT_THUMBNAILS,
          Key: `event-thumbnails/${Date.now()}-${req.file.originalname}`,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          CacheControl: 'public, max-age=31536000',
        },
      });
      const result = await upload.done();
      update.thumbnailUrl = result.Location;
    }

    const event = await Event.findByIdAndUpdate(req.params.eventId, update, { new: true });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    res.json({ success: true, event });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ success: false, error: 'Error updating event' });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    try {
      if (event.thumbnailUrl && event.thumbnailUrl.includes('.amazonaws.com/')) {
        const key = event.thumbnailUrl.split('.amazonaws.com/')[1];
        if (key) {
          await s3Client.send(
            new DeleteObjectCommand({ Bucket: process.env.AWS_HUB_EVENT_THUMBNAILS, Key: key })
          );
        }
      }
    } catch (_) {
      /* S3 cleanup is best-effort */
    }
    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ success: false, error: 'Error deleting event' });
  }
};

exports.sendEventNotification = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { customMessage } = req.body || {};

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const users = await User.find({
      status: 'active',
    }).select('email fullName');

    if (users.length === 0) {
      return res.json({
        success: true,
        message: 'No active users to notify',
        emailsSent: 0,
        emailsFailed: 0,
      });
    }

    const results = await sendBulkEventNotification(users, event, customMessage);

    res.json({
      success: true,
      message: `Event notification sent successfully`,
      emailsSent: results.sent,
      emailsFailed: results.failed,
      totalRecipients: users.length,
    });
  } catch (error) {
    console.error('Send event notification error:', error);
    res.status(500).json({ success: false, error: 'Error sending event notifications' });
  }
};
