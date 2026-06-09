import express from 'express';

import * as uploadController from '../controllers/uploadController';
import checkJwt from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = express.Router();

router.post(
  '/profile-picture',
  checkJwt,
  upload.single('profilePicture'),
  uploadController.uploadProfilePicture
);

export default router;
