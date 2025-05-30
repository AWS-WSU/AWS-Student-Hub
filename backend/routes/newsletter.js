const express = require('express');
const rateLimit = require('express-rate-limit');
const { subscribe, getAllSubscriptions, unsubscribe } = require('../controllers/newsletterController');

const router = express.Router();

// Rate limiting for newsletter endpoints
const newsletterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all newsletter routes
router.use(newsletterLimiter);

// POST /api/newsletter/subscribe - Subscribe to newsletter
router.post('/subscribe', subscribe);

// POST /api/newsletter/unsubscribe - Unsubscribe from newsletter
router.post('/unsubscribe', unsubscribe);

// GET /api/newsletter/subscriptions - Get all subscriptions (admin only)
router.get('/subscriptions', getAllSubscriptions);

module.exports = router;
