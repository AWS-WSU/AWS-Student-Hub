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

    let imageBuffer;
    let mimetype = 'image/jpeg';
    
    // Try to process image with Sharp, fallback to original if it fails
    try {
      console.log('Processing image with Sharp...');
      imageBuffer = await processImage(req.file.buffer);
      console.log('Sharp processing successful');
    } catch (sharpError) {
      console.error('Sharp processing failed:', sharpError);
      console.log('Using original image buffer as fallback');
      imageBuffer = req.file.buffer;
      mimetype = req.file.mimetype;
    }
    
    const fileExtension = path.extname(req.file.originalname) || '.jpg';
    // Generate unique filename with timestamp and random hash for better cache management
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const fileName = `profile-pictures/${userId}-${timestamp}-${randomHash}${fileExtension}`;
    
    console.log('Uploading to S3:', fileName);
    const uploadResult = await uploadToS3({
      buffer: imageBuffer,
      mimetype: mimetype
    }, fileName);
    console.log('S3 upload successful:', uploadResult.Location);

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
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error uploading profile picture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
