const UserModel = require('../models/user.model');
const { generateToken, generateRefreshToken, verifyToken } = require('../config/jwt');
const logger = require('../utils/logger');

/**
 * Auth Controller
 * 
 * Handles user authentication: registration, login, and token management.
 */

/**
 * Register a new user
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    const { email, password, name } = req.body;

    // Check if email already exists
    const existingUser = await UserModel.emailExists(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email is already registered'
      });
    }

    // Create user (default role is 'user')
    const user = await UserModel.create({
      email: email.toLowerCase(),
      password,
      name
    });

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token,
        refreshToken
      },
      message: 'Registration successful'
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Verify credentials
    const user = await UserModel.verifyPassword(email, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token,
        refreshToken
      },
      message: 'Login successful'
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
}

/**
 * Get current user profile
 * GET /api/auth/me
 */
async function getMe(req, res) {
  try {
    // User is attached by auth middleware
    const user = await UserModel.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at,
        last_login: user.last_login
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
}

/**
 * Update user profile
 * PUT /api/auth/me
 */
async function updateMe(req, res) {
  try {
    const { name, email } = req.body;
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase();
      const existing = await UserModel.findByEmail(normalizedEmail);
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({
          success: false,
          error: 'Email is already in use'
        });
      }
      updateData.email = normalizedEmail;
    }

    const user = await UserModel.update(req.user.id, updateData);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    logger.info(`User profile updated: ${user.email}`);

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
}

/**
 * Change password
 * PUT /api/auth/password
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const user = await UserModel.verifyPassword(req.user.email, currentPassword);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    await UserModel.updatePassword(req.user.id, newPassword);

    logger.info(`Password changed for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
}

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
async function refreshToken(req, res) {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = verifyToken(token);

    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // Get user
    const user = await UserModel.findById(decoded.id);

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive'
      });
    }

    // Generate new tokens
    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token'
    });
  }
}

/**
 * Logout (client-side token invalidation)
 * POST /api/auth/logout
 */
async function logout(req, res) {
  // In a stateless JWT setup, logout is handled client-side
  // For enhanced security, you could maintain a token blacklist
  
  logger.info(`User logged out: ${req.user.email}`);

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}

/**
 * Create admin user (for initial setup - admin only)
 * POST /api/auth/create-admin
 */
async function createAdmin(req, res) {
  try {
    const { email, password, name } = req.body;

    // Only existing admins can create new admins
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can create admin accounts'
      });
    }

    // Check if email already exists
    const existingUser = await UserModel.emailExists(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email is already registered'
      });
    }

    // Create admin user
    const user = await UserModel.create({
      email: email.toLowerCase(),
      password,
      name,
      role: 'admin'
    });

    logger.info(`Admin user created: ${user.email} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      message: 'Admin account created successfully'
    });
  } catch (error) {
    logger.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create admin account'
    });
  }
}

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  refreshToken,
  logout,
  createAdmin
};

