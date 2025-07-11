const User = require('../models/User');
const { uploadToS3, deleteFromS3 } = require('../config/aws');
const { processImage } = require('../middleware/upload');
const path = require('path');
const crypto = require('crypto');

exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const processedImage = await processImage(req.file.buffer);
    
    const fileExtension = path.extname(req.file.originalname) || '.jpg';
    // Generate unique filename with timestamp and random hash for better cache management
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const fileName = `profile-pictures/${userId}-${timestamp}-${randomHash}${fileExtension}`;
    
    const uploadResult = await uploadToS3({
      buffer: processedImage,
      mimetype: 'image/jpeg'
    }, fileName);

    // Clean up old profile picture if it exists and is not the default
    if (user.profilePicture && 
        user.profilePicture !== '/account.svg' && 
        user.profilePicture.includes(process.env.S3_BUCKET_NAME)) {
      try {
        const oldKey = user.profilePicture.split('.amazonaws.com/')[1];
        if (oldKey) {
          await deleteFromS3(oldKey);
        }
      } catch (deleteError) {
        console.error('Error deleting old profile picture:', deleteError);
      }
    }

    user.profilePicture = uploadResult.Location;
    await user.save();

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: uploadResult.Location,
      user: user.toSafeObject()
    });

  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading profile picture'
    });
  }
};
