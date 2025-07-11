const rateLimit = require('express-rate-limit');

// Custom key generator for Lambda/API Gateway environment
const customKeyGenerator = (req) => {
  // In Lambda/API Gateway, use the source IP from the event
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    // Try to get real IP from various headers in API Gateway
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           'unknown';
  }
  // For local development, use default behavior
  return req.ip;
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many authentication attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  // Skip validation errors in Lambda environment
  validate: {
    trustProxy: false,
    xForwardedForHeader: false
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false
  }
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: 'Too many password reset attempts. Please try again in 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false
  }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3, 
  message: {
    error: 'Too many signup attempts. Please try again in 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false
  }
});

module.exports = {
  authLimiter,
  loginLimiter,
  passwordResetLimiter,
  signupLimiter
}; 