const express = require('express');
const rateLimit = require('express-rate-limit');
const { subscribe, getSubscriptions } = require('../controllers/newsletterController');

const router = express.Router();

const newsletterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(newsletterLimiter);

router.post('/subscribe', subscribe);

router.get('/subscriptions', getSubscriptions);

module.exports = router;
