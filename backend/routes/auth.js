const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const checkJwt = require('../middleware/auth');
const { authLimiter, loginLimiter, passwordResetLimiter, signupLimiter } = require('../middleware/rateLimiter');

// Validation middleware
const validateSignup = [
  body('fullName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Full name must be at least 2 characters long'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*\d)(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
    .withMessage('Password must contain at least one number, one uppercase letter, and one special character')
];

const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email or username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const validateForgotPassword = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Email or username is required')
];

const validateResetPassword = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Email or username is required'),
  body('code')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Reset code must be 6 digits'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*\d)(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
    .withMessage('Password must contain at least one number, one uppercase letter, and one special character')
];

// Routes
router.post('/signup', signupLimiter, validateSignup, authController.signup);
router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/forgot-password', passwordResetLimiter, validateForgotPassword, authController.forgotPassword);
router.post('/verify-email', passwordResetLimiter, authController.verifyEmail);
router.post('/verify-reset-code', authLimiter, authController.verifyResetCode);
router.post('/reset-password', authLimiter, validateResetPassword, authController.resetPassword);
router.get('/me', checkJwt, authController.getCurrentUser);
router.post('/check-username', checkJwt, authController.checkUsername);
router.put('/profile', checkJwt, authController.updateProfile);
router.get('/recent-users', authController.getRecentUsers);

router.get('/profile/:username', authController.getPublicProfile);

module.exports = router;