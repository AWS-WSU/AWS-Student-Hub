const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
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

const UNAUTHORIZED_RESPONSE = { success: false, message: 'Unauthorized: Admin access required.' };
const ADMIN_TOKEN_HEADER = 'x-admin-token';

// Load and validate ADMIN_TOKEN at module initialization
const adminToken = process.env.ADMIN_TOKEN;
if (!adminToken) {
  throw new Error('Server misconfiguration: ADMIN_TOKEN is not set in environment variables.');
}
const adminBuf = Buffer.from(adminToken, 'utf8');

/**
 * Middleware to protect admin-only endpoints using a static token.
 * Checks for the x-admin-token header and compares it to the ADMIN_TOKEN environment variable using constant-time comparison.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {void} Responds with 401 if not authorized, otherwise calls next()
 */
function adminCheck(req, res, next) {
  // Always get the header as a string (Express will join multiple headers with ',')
  const providedToken = req.get(ADMIN_TOKEN_HEADER);
  if (typeof providedToken !== 'string') {
    return res.status(401).json(UNAUTHORIZED_RESPONSE);
  }
  // Use constant-time comparison
  const providedBuf = Buffer.from(providedToken, 'utf8');
  if (adminBuf.length !== providedBuf.length || !crypto.timingSafeEqual(adminBuf, providedBuf)) {
    return res.status(401).json(UNAUTHORIZED_RESPONSE);
  }
  next();
}

// POST /api/newsletter/subscribe - Subscribe to newsletter
router.post('/subscribe', subscribe);

// POST /api/newsletter/unsubscribe - Unsubscribe from newsletter
router.post('/unsubscribe', unsubscribe);

// GET /api/newsletter/subscriptions - Get all subscriptions (admin only)
router.get('/subscriptions', adminCheck, getAllSubscriptions);

module.exports = router;
