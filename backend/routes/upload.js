const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/upload');
const uploadController = require('../controllers/uploadController');
const checkJwt = require('../middleware/auth');

router.post('/profile-picture', 
  checkJwt, 
  upload.single('profilePicture'), 
  uploadController.uploadProfilePicture
);

module.exports = router;
