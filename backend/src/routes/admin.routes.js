const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');
const { validateBody, validateUUID } = require('../middlewares/validation.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const { sensorNodeCreateSchema, sensorNodeUpdateSchema, adminStatsQuerySchema } = require('../utils/validators');
// #swagger.tags = ['Admin']
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

// #swagger.tags = ['Admin']
router.get('/dashboard',
  // #swagger.tags = ['Admin']
  asyncHandler(adminController.getDashboard)
);

/**
 * @route   GET /api/admin/stats
 * @desc    Get system statistics
 * @access  Admin
 */
router.get('/stats',
  // #swagger.tags = ['Admin']
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
  // #swagger.tags = ['Admin']
  asyncHandler(adminController.getAllNodes)
);

/**
 * @route   POST /api/admin/nodes
 * @desc    Register a new sensor node
 * @access  Admin
 */
router.post('/nodes',
  // #swagger.tags = ['Admin']
  validateBody(sensorNodeCreateSchema),
  asyncHandler(adminController.createNode)
);

/**
 * @route   PUT /api/admin/nodes/:nodeId
 * @desc    Update a sensor node
 * @access  Admin
 */
router.put('/nodes/:nodeId',
  // #swagger.tags = ['Admin']
  validateBody(sensorNodeUpdateSchema),
  asyncHandler(adminController.updateNode)
);

/**
 * @route   DELETE /api/admin/nodes/:nodeId
 * @desc    Deactivate a sensor node
 * @access  Admin
 */
router.delete('/nodes/:nodeId',
  // #swagger.tags = ['Admin']
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
  // #swagger.tags = ['Admin']
  asyncHandler(adminController.getUsers)
);

/**
 * @route   PUT /api/admin/users/:userId
 * @desc    Update user role or status
 * @access  Admin
 */
router.put('/users/:userId',
  // #swagger.tags = ['Admin']
  validateUUID('userId'),
  asyncHandler(adminController.updateUser)
);

/**
 * @route   DELETE /api/admin/users/:userId
 * @desc    Deactivate a user
 * @access  Admin
 */
router.delete('/users/:userId',
  // #swagger.tags = ['Admin']
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
  // #swagger.tags = ['Admin']
  asyncHandler(adminController.getAuditLogs)
);

/**
 * @route   GET /api/admin/logs/recent
 * @desc    Get recent admin activity
 * @access  Admin
 */
router.get('/logs/recent',
  // #swagger.tags = ['Admin']
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
  // #swagger.tags = ['Admin']
  asyncHandler(adminController.getDatabaseInfo)
);

/**
 * @route   POST /api/admin/cleanup
 * @desc    Cleanup old data
 * @access  Admin
 */
router.post('/cleanup',
  // #swagger.tags = ['Admin']
  asyncHandler(adminController.cleanupOldData)
);

// ========================================
// ML Predictions
// ========================================

/**
 * @route   GET /api/admin/predictions
 * @desc    List ML predictions with filters and pagination
 * @access  Admin
 */
router.get('/predictions',
  asyncHandler(adminController.getPredictions)
);

/**
 * @route   GET /api/admin/predictions/stats
 * @desc    Aggregate prediction stats
 * @access  Admin
 */
router.get('/predictions/stats',
  asyncHandler(adminController.getPredictionStats)
);

/**
 * @route   GET /api/admin/ml/health
 * @desc    ML service / placeholder health
 * @access  Admin
 */
router.get('/ml/health',
  asyncHandler(adminController.getMlHealth)
);

module.exports = router;

