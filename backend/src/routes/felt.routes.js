const express = require('express');
const router = express.Router();


// #swagger.tags = ['Felt']
const feltController = require('../controllers/felt.controller');
const { authenticate, requireAdmin, optionalAuth } = require('../middlewares/auth.middleware');
const { validateBody, validateQuery, validateUUID } = require('../middlewares/validation.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const { feltReportSchema, feltNearbyQuerySchema } = require('../utils/validators');

/**
 * Felt Routes
 * 
 * Endpoints for crowdsourced "Felt-It" earthquake reports.
 */

// ========================================
// Public Routes
// ========================================
    // #swagger.tags = ['Felt']
   
/**
 * @route   GET /api/felt/intensity-scale
 * @desc    Get Modified Mercalli Intensity Scale reference
 * @access  Public
 */
router.get('/intensity-scale',
      // #swagger.tags = ['Felt']
  asyncHandler(feltController.getIntensityScale)
);

/**
 * @route   POST /api/felt
 * @desc    Submit a felt report
 * @access  Public (optional auth)
 */
router.post('/',
  optionalAuth,
  validateBody(feltReportSchema),
  asyncHandler(feltController.submitReport)
);

/**
 * @route   GET /api/felt/nearby
 * @desc    Get felt reports near a location
 * @access  Public
 */
router.get('/nearby',
      // #swagger.tags = ['Felt']
    // #swagger.description = 'Get all felt sensor data'
  validateQuery(feltNearbyQuerySchema),
  asyncHandler(feltController.getNearbyReports)
);

/**
 * @route   GET /api/felt/recent
 * @desc    Get recent felt reports
 * @access  Public
 */
router.get('/recent',
  // #swagger.tags = ['Felt']
  asyncHandler(feltController.getRecentReports)
);

/**
 * @route   GET /api/felt/stats
 * @desc    Get felt report statistics
 * @access  Public
 */
router.get('/stats',
  // #swagger.tags = ['Felt']
  asyncHandler(feltController.getReportStats)
);

/**
 * @route   GET /api/felt/event/:eventId
 * @desc    Get all felt reports for an event
 * @access  Public
 */
router.get('/event/:eventId',
  // #swagger.tags = ['Felt']
  validateUUID('eventId'),
  asyncHandler(feltController.getEventReports)
);

/**
 * @route   GET /api/felt/:id
 * @desc    Get a specific felt report
 * @access  Public
 */
router.get('/:id',
  validateUUID('id'),
  // #swagger.tags = ['Felt']
  asyncHandler(feltController.getReport)
);

// ========================================
// Protected Routes (Admin only)
// ========================================

/**
 * @route   DELETE /api/felt/:id
 * @desc    Delete a felt report
 * @access  Admin
 */
router.delete('/:id',
  // #swagger.tags = ['Felt']
  authenticate,
  requireAdmin,
  validateUUID('id'),
  asyncHandler(feltController.deleteReport)
);

module.exports = router;

