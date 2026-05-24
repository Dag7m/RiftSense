const express = require('express');
const router = express.Router();

const sensorController = require('../controllers/sensor.controller');
const { authenticate, requireAdmin, sensorRateLimit } = require('../middlewares/auth.middleware');
const { validateBody, validateQuery } = require('../middlewares/validation.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const { 
  sensorDataSchema, 
  sensorDataBatchSchema, 
  heartbeatSchema 
} = require('../utils/validators');



/**
 * Sensor Routes
 * 
 * Endpoints for sensor data ingestion and node information.
 */

// ========================================
// Public Routes (for ESP32 nodes)
// ========================================

/**
 * @route   POST /api/sensors/data
 * @desc    Ingest single sensor data point
 * @access  Public (sensor nodes)
 */
router.post('/data',
  // #swagger.tags = ['Sensors']
  sensorRateLimit,
  validateBody(sensorDataSchema),
  asyncHandler(sensorController.ingestData)
);

/**
 * @route   POST /api/sensors/data/batch
 * @desc    Ingest batch sensor data
 * @access  Public (sensor nodes)
 */
router.post('/data/batch',
  // #swagger.tags = ['Sensors']
  sensorRateLimit,
  validateBody(sensorDataBatchSchema),
  asyncHandler(sensorController.ingestBatchData)
);

/**
 * @route   POST /api/sensors/heartbeat
 * @desc    Receive sensor node heartbeat
 * @access  Public (sensor nodes)
 */
router.post('/heartbeat',
  // #swagger.tags = ['Sensors']
  validateBody(heartbeatSchema),
  asyncHandler(sensorController.heartbeat)
);

// ========================================
// Protected Routes (require authentication)
// ========================================

/**
 * @route   GET /api/sensors/nodes
 * @desc    Get all sensor nodes
 * @access  Admin
 */
router.get('/nodes',
  // #swagger.tags = ['Sensors']
  authenticate,
  requireAdmin,
  asyncHandler(sensorController.getNodes)
);

/**
 * @route   GET /api/sensors/nodes/:nodeId
 * @desc    Get specific sensor node details
 * @access  Admin
 */
router.get('/nodes/:nodeId',
  // #swagger.tags = ['Sensors']
  authenticate,
  requireAdmin,
  asyncHandler(sensorController.getNode)
);

/**
 * @route   GET /api/sensors/data/:nodeId
 * @desc    Get sensor data for a node
 * @access  Admin
 */
router.get('/data/:nodeId',
  // #swagger.tags = ['Sensors']
  authenticate,
  requireAdmin,
  asyncHandler(sensorController.getNodeData)
);

/**
 * @route   GET /api/sensors/data/:nodeId/aggregates
 * @desc    Get aggregated sensor data
 * @access  Admin
 */
router.get('/data/:nodeId/aggregates',
  // #swagger.tags = ['Sensors']
  authenticate,
  requireAdmin,
  asyncHandler(sensorController.getNodeAggregates)
);

/**
 * @route   GET /api/sensors/nodes/:nodeId/predictions
 * @desc    Recent ML predictions for a node
 * @access  Admin
 */
router.get('/nodes/:nodeId/predictions',
  authenticate,
  requireAdmin,
  asyncHandler(sensorController.getNodePredictions)
);

module.exports = router;

