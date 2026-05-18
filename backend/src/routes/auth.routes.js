const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validation.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const { registerSchema, loginSchema } = require('../utils/validators');
const Joi = require('joi');

/**
 * Auth Routes
 * 
 * Endpoints for user authentication and account management.
 */

// Password change schema
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required()
});

// Refresh token schema
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

// Profile update schema
const updateProfileSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  email: Joi.string().email().max(255).optional()
}).min(1);

// ========================================
// Public Routes
// ========================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register',
  validateBody(registerSchema),
  asyncHandler(authController.register)
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login',
  validateBody(loginSchema),
  asyncHandler(authController.login)
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh',
  validateBody(refreshTokenSchema),
  asyncHandler(authController.refreshToken)
);

// ========================================
// Protected Routes
// ========================================

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Protected
 */
router.get('/me',
  authenticate,
  asyncHandler(authController.getMe)
);

/**
 * @route   PUT /api/auth/me
 * @desc    Update user profile
 * @access  Protected
 */
router.put('/me',
  authenticate,
  validateBody(updateProfileSchema),
  asyncHandler(authController.updateMe)
);

/**
 * @route   PUT /api/auth/password
 * @desc    Change password
 * @access  Protected
 */
router.put('/password',
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(authController.changePassword)
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Protected
 */
router.post('/logout',
  authenticate,
  asyncHandler(authController.logout)
);

// ========================================
// Admin Routes
// ========================================

/**
 * @route   POST /api/auth/create-admin
 * @desc    Create a new admin user
 * @access  Admin
 */
router.post('/create-admin',
  authenticate,
  requireAdmin,
  validateBody(registerSchema),
  asyncHandler(authController.createAdmin)
);

module.exports = router;

