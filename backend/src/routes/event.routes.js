const express = require('express');
const router = express.Router();

const eventController = require('../controllers/event.controller');
const { authenticate, requireAdmin, optionalAuth } = require('../middlewares/auth.middleware');
const { validateQuery, validateUUID } = require('../middlewares/validation.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const { eventQuerySchema } = require('../utils/validators');

/**
 * Event Routes
 * 
 * Endpoints for seismic event retrieval and management.
 */

// ========================================
// Public Routes
// ========================================

/**
 * @route   GET /api/events
 * @desc    Get all events with pagination and filters
 * @access  Public
 */
router.get('/',
  validateQuery(eventQuerySchema),
  asyncHandler(eventController.getEvents)
);

/**
 * @route   GET /api/events/recent
 * @desc    Get recent events (last 24 hours)
 * @access  Public
 */
router.get('/recent',
  asyncHandler(eventController.getRecentEvents)
);

/**
 * @route   GET /api/events/nearby
 * @desc    Get events near a location
 * @access  Public
 */
router.get('/nearby',
  asyncHandler(eventController.getNearbyEvents)
);

/**
 * @route   GET /api/events/stats
 * @desc    Get event statistics
 * @access  Public
 */
router.get('/stats',
  asyncHandler(eventController.getEventStats)
);

/**
 * @route   GET /api/events/:id
 * @desc    Get specific event with full details
 * @access  Public
 */
router.get('/:id',
  validateUUID('id'),
  asyncHandler(eventController.getEvent)
);

/**
 * @route   GET /api/events/:id/detections
 * @desc    Get detections for an event
 * @access  Public
 */
router.get('/:id/detections',
  validateUUID('id'),
  asyncHandler(eventController.getEventDetections)
);

// ========================================
// Protected Routes (Admin only)
// ========================================

/**
 * @route   POST /api/events
 * @desc    Manually create an event
 * @access  Admin
 */
router.post('/',
  authenticate,
  requireAdmin,
  asyncHandler(eventController.createEvent)
);

/**
 * @route   PUT /api/events/:id/status
 * @desc    Update event status
 * @access  Admin
 */
router.put('/:id/status',
  authenticate,
  requireAdmin,
  validateUUID('id'),
  asyncHandler(eventController.updateEventStatus)
);

/**
 * @route   DELETE /api/events/:id
 * @desc    Delete an event
 * @access  Admin
 */
router.delete('/:id',
  authenticate,
  requireAdmin,
  validateUUID('id'),
  asyncHandler(eventController.deleteEvent)
);

module.exports = router;

