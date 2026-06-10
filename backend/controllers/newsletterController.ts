import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import validator from 'validator';

import Newsletter from '../models/Newsletter';

const getMongoErrorCode = (error: unknown): number | undefined => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'number' ? code : undefined;
  }
  return undefined;
};

export const subscribe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };

    if (!email || !validator.isEmail(email)) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
      return;
    }

    if (mongoose.connection.readyState !== 1) {
      res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable. Please try again later.',
      });
      return;
    }

    const normalizedEmail = email.toLowerCase();

    const newSubscription = new Newsletter({ email: normalizedEmail });
    await newSubscription.save();

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter! Thank you for joining us.',
    });
  } catch (error: unknown) {
    console.error('newsletter subscription error.', error);

    if (getMongoErrorCode(error) === 11000) {
      res.status(409).json({
        success: false,
        message: 'This email is already subscribed to our newsletter',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
    });
  }
};

export const getSubscriptions = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 1) {
      res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable. Please try again later.',
      });
      return;
    }

    const subscriptions = await Newsletter.find({})
      .select('email subscribedAt')
      .sort({ subscribedAt: -1 });

    res.status(200).json({
      success: true,
      data: subscriptions,
      count: subscriptions.length,
    });
  } catch (error: unknown) {
    console.error('get subscriptions error.', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving subscriptions',
    });
  }
};
