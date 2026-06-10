import type { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';

import { deleteFromS3, uploadToS3 } from '../config/aws';
import { processImage } from '../middleware/upload';
import User from '../models/User';

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const getErrorStack = (error: unknown): string | undefined => {
  return error instanceof Error ? error.stack : undefined;
};

export const uploadProfilePicture = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
      return;
    }

    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    let imageBuffer: Buffer;
    let mimetype = 'image/jpeg';

    try {
      console.log('Processing image with Sharp...');
      imageBuffer = await processImage(req.file.buffer);
      console.log('Sharp processing successful');
    } catch (sharpError: unknown) {
      console.error('Sharp processing failed:', sharpError);
      console.log('Using original image buffer as fallback');
      imageBuffer = req.file.buffer;
      mimetype = req.file.mimetype;
    }

    const fileExtension = path.extname(req.file.originalname) || '.jpg';
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const fileName = `profile-pictures/${userId}-${timestamp}-${randomHash}${fileExtension}`;

    console.log('Uploading to S3:', fileName);
    const uploadResult = await uploadToS3(
      {
        buffer: imageBuffer,
        mimetype,
      },
      fileName
    );
    console.log('S3 upload successful:', uploadResult.Location);

    if (
      user.profilePicture &&
      user.profilePicture !== '/avatar.jpg' &&
      process.env.S3_BUCKET_NAME &&
      user.profilePicture.includes(process.env.S3_BUCKET_NAME)
    ) {
      try {
        const oldKey = user.profilePicture.split('.amazonaws.com/')[1];
        if (oldKey) {
          await deleteFromS3(oldKey);
        }
      } catch (deleteError: unknown) {
        console.error('Error deleting old profile picture:', deleteError);
      }
    }

    user.profilePicture = uploadResult.Location;
    await user.save();

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: uploadResult.Location,
      user: user.toSafeObject(),
    });
  } catch (error: unknown) {
    console.error('Upload profile picture error:', error);
    console.error('Error stack:', getErrorStack(error));
    res.status(500).json({
      success: false,
      message: 'Error uploading profile picture',
      error: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined,
    });
  }
};
