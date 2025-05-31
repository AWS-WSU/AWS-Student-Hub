const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const checkJwt = require('../middleware/auth');

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
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).*$/)
    .withMessage('Password must contain at least one number, one uppercase and one lowercase letter')
];

const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Routes
router.post('/signup', validateSignup, authController.signup);
router.post('/login', validateLogin, authController.login);
router.get('/me', checkJwt, authController.getCurrentUser);

module.exports = router; 