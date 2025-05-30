const express = require('express');
const rateLimit = require('express-rate-limit');
const { subscribe, getSubscriptions } = require('../controllers/newsletterController');

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

// GET /api/newsletter/subscriptions - Get all subscriptions
router.get('/subscriptions', getSubscriptions);

module.exports = router;
