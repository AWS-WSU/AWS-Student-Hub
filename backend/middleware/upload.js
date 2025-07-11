const multer = require('multer');

// Make sharp optional for Lambda compatibility
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.warn('⚠️ Sharp module not available - image processing disabled:', error.message);
  sharp = null;
}

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const processImage = async (buffer) => {
  if (!sharp) {
    console.warn('⚠️ Sharp not available - returning original image buffer');
    return buffer; // Return original buffer if sharp is not available
  }
  
  try {
    return await sharp(buffer)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (error) {
    console.warn('⚠️ Image processing failed - returning original:', error.message);
    return buffer; // Fallback to original buffer
  }
};

module.exports = {
  upload,
  processImage
};
