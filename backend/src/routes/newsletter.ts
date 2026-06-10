import express from 'express';
import rateLimit from 'express-rate-limit';

import { getSubscriptions, subscribe } from '../controllers/newsletterController';

const router = express.Router();

const newsletterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(newsletterLimiter);
router.post('/subscribe', subscribe);
router.get('/subscriptions', getSubscriptions);

export default router;
