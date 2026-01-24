const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');
const { validateBody, validateUUID } = require('../middlewares/validation.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const { sensorNodeCreateSchema, sensorNodeUpdateSchema, adminStatsQuerySchema } = require('../utils/validators');

/**
 * Admin Routes
 * 
 * All routes require admin authentication.
 */

// Apply authentication and admin check to all routes
router.use(authenticate);
router.use(requireAdmin);

// ========================================
// Dashboard & Statistics
// ========================================

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard data
 * @access  Admin
 */
router.get('/dashboard',
  asyncHandler(adminController.getDashboard)
);

/**
 * @route   GET /api/admin/stats
 * @desc    Get system statistics
 * @access  Admin
 */
router.get('/stats',
  asyncHandler(adminController.getSystemStats)
);

// ========================================
// Sensor Node Management
// ========================================

/**
 * @route   GET /api/admin/nodes
 * @desc    Get all sensor nodes
 * @access  Admin
 */
router.get('/nodes',
  asyncHandler(adminController.getAllNodes)
);

/**
 * @route   POST /api/admin/nodes
 * @desc    Register a new sensor node
 * @access  Admin
 */
router.post('/nodes',
  validateBody(sensorNodeCreateSchema),
  asyncHandler(adminController.createNode)
);

/**
 * @route   PUT /api/admin/nodes/:nodeId
 * @desc    Update a sensor node
 * @access  Admin
 */
router.put('/nodes/:nodeId',
  validateBody(sensorNodeUpdateSchema),
  asyncHandler(adminController.updateNode)
);

/**
 * @route   DELETE /api/admin/nodes/:nodeId
 * @desc    Deactivate a sensor node
 * @access  Admin
 */
router.delete('/nodes/:nodeId',
  asyncHandler(adminController.deactivateNode)
);

// ========================================
// User Management
// ========================================

/**
 * @route   GET /api/admin/users
 * @desc    Get all users
 * @access  Admin
 */
router.get('/users',
  asyncHandler(adminController.getUsers)
);

/**
 * @route   PUT /api/admin/users/:userId
 * @desc    Update user role or status
 * @access  Admin
 */
router.put('/users/:userId',
  validateUUID('userId'),
  asyncHandler(adminController.updateUser)
);

/**
 * @route   DELETE /api/admin/users/:userId
 * @desc    Deactivate a user
 * @access  Admin
 */
router.delete('/users/:userId',
  validateUUID('userId'),
  asyncHandler(adminController.deactivateUser)
);

// ========================================
// Audit Logs
// ========================================

/**
 * @route   GET /api/admin/logs
 * @desc    Get admin audit logs
 * @access  Admin
 */
router.get('/logs',
  asyncHandler(adminController.getAuditLogs)
);

/**
 * @route   GET /api/admin/logs/recent
 * @desc    Get recent admin activity
 * @access  Admin
 */
router.get('/logs/recent',
  asyncHandler(adminController.getRecentActivity)
);

// ========================================
// Database Management
// ========================================

/**
 * @route   GET /api/admin/database
 * @desc    Get database information
 * @access  Admin
 */
router.get('/database',
  asyncHandler(adminController.getDatabaseInfo)
);

/**
 * @route   POST /api/admin/cleanup
 * @desc    Cleanup old data
 * @access  Admin
 */
router.post('/cleanup',
  asyncHandler(adminController.cleanupOldData)
);

module.exports = router;

