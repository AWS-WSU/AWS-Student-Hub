import type { Request, Response } from 'express';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

import env from '../config/env';
import Event from '../models/Event';
import User from '../models/User';
import { sendBulkEventNotification } from '../services/emailService';
import logger from '../config/logger';

const log = logger.child({ module: 'eventController' });

const s3Region = env.S3_REGION || env.AWS_REGION || 'us-east-1';

const credentials =
  env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      }
    : undefined;

const s3Client = new S3Client({
  credentials,
  region: s3Region,
  followRegionRedirects: true,
});

const parseInteger = (value: unknown, fallback: number): number => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const isConnectionError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'MongoServerSelectionError' ||
    error.name === 'MongoNetworkError' ||
    error.message.includes('connection')
  );
};

interface ThumbnailFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
}

const uploadEventThumbnail = async (file: ThumbnailFile): Promise<string> => {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: env.AWS_HUB_EVENT_THUMBNAILS || '',
      Key: `event-thumbnails/${Date.now()}-${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: 'public, max-age=31536000',
    },
  });

  const result = await upload.done();
  return result.Location || '';
};

export const createEvent = async (req: Request, res: Response): Promise<void> => {
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
    } = req.body as Record<string, string | undefined>;

    if (!title || !startTime || typeof isRemote === 'undefined') {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const isRemoteBool = String(isRemote) === 'true';

    if (!isRemoteBool && directions && directions.length > 250) {
      res.status(400).json({ success: false, error: 'Directions must be at most 250 characters' });
      return;
    }

    if (!req.user?.id) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    let thumbnailUrl = '';

    if (req.file) {
      thumbnailUrl = await uploadEventThumbnail(req.file);
    }

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
  } catch (error: unknown) {
    log.error('create event error.', error);
    res.status(500).json({ success: false, error: 'Error creating event' });
  }
};

export const listPublicEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInteger(req.query.limit, 6);
    const now = new Date();
    const events = await Event.find({ status: 'published', startTime: { $gte: now } })
      .sort({ startTime: 1 })
      .limit(limit)
      .select('-__v');
    res.json({ success: true, events });
  } catch (error: unknown) {
    log.error('list events error.', error);
    if (isConnectionError(error)) {
      res
        .status(503)
        .json({ success: false, error: 'Service temporarily unavailable. Please try again.' });
      return;
    }
    res.status(500).json({ success: false, error: 'Error fetching events' });
  }
};

export const getEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }
    res.json({ success: true, event });
  } catch (error: unknown) {
    log.error('get event error.', error);
    res.status(500).json({ success: false, error: 'Error fetching event' });
  }
};

export const adminList = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInteger(req.query.page, 1);
    const limit = parseInteger(req.query.limit, 20);
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
  } catch (error: unknown) {
    log.error('admin list events error.', error);
    res.status(500).json({ success: false, error: 'Error fetching events' });
  }
};

export const updateEvent = async (req: Request, res: Response): Promise<void> => {
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
    } = req.body as Record<string, string | undefined>;

    const isRemoteProvided = typeof isRemote !== 'undefined';
    const isRemoteBool = String(isRemote) === 'true';

    if (isRemoteProvided && !isRemoteBool && directions && directions.length > 250) {
      res.status(400).json({ success: false, error: 'Directions must be at most 250 characters' });
      return;
    }

    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = title;
    if (startTime !== undefined) update.startTime = new Date(startTime);
    if (isRemoteProvided) update.isRemote = isRemoteBool;
    if (meetupUrl !== undefined) update.meetupUrl = meetupUrl;
    if (status !== undefined) update.status = status;
    if (description !== undefined) update.description = description;

    if (isRemoteProvided) {
      if (isRemoteBool) {
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
      update.thumbnailUrl = await uploadEventThumbnail(req.file);
    }

    const event = await Event.findByIdAndUpdate(req.params.eventId, update, { new: true });
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }
    res.json({ success: true, event });
  } catch (error: unknown) {
    log.error('update event error.', error);
    res.status(500).json({ success: false, error: 'Error updating event' });
  }
};

export const deleteEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const event = await Event.findByIdAndDelete(req.params.eventId);
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }
    try {
      if (event.thumbnailUrl && event.thumbnailUrl.includes('.amazonaws.com/')) {
        const key = event.thumbnailUrl.split('.amazonaws.com/')[1];
        if (key) {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: env.AWS_HUB_EVENT_THUMBNAILS || '',
              Key: key,
            })
          );
        }
      }
    } catch (error: unknown) {
      log.error('event thumbnail cleanup error.', error);
    }
    res.json({ success: true, message: 'Event deleted' });
  } catch (error: unknown) {
    log.error('delete event error.', error);
    res.status(500).json({ success: false, error: 'Error deleting event' });
  }
};

export const sendEventNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { customMessage } = (req.body || {}) as { customMessage?: string };

    const event = await Event.findById(eventId);
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    const users = await User.find({
      status: 'active',
    }).select('email fullName');

    if (users.length === 0) {
      res.json({
        success: true,
        message: 'No active users to notify',
        emailsSent: 0,
        emailsFailed: 0,
      });
      return;
    }

    const results = await sendBulkEventNotification(users, event, customMessage);

    res.json({
      success: true,
      message: 'Event notification sent successfully',
      emailsSent: results.sent,
      emailsFailed: results.failed,
      totalRecipients: users.length,
    });
  } catch (error: unknown) {
    log.error('send event notification error.', error);
    res.status(500).json({ success: false, error: 'Error sending event notifications' });
  }
};
