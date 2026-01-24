const EventModel = require('../models/event.model');
const SensorNodeModel = require('../models/sensorNode.model');
const FeltReportModel = require('../models/feltReport.model');
const geo = require('../utils/geo');
const logger = require('../utils/logger');
const { isValidUUID } = require('../utils/validators');

/**
 * Event Controller
 * 
 * Handles seismic event management and retrieval.
 */

/**
 * Get all events with pagination and filters
 * GET /api/events
 */
async function getEvents(req, res) {
  try {
    const {
      page,
      limit,
      status,
      event_type,
      start_date,
      end_date,
      min_confidence
    } = req.query;

    const result = await EventModel.findAll({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status,
      event_type,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      min_confidence: min_confidence ? parseFloat(min_confidence) : null
    });

    res.json({
      success: true,
      data: result.events,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error getting events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get events'
    });
  }
}

/**
 * Get recent events (last 24 hours)
 * GET /api/events/recent
 */
async function getRecentEvents(req, res) {
  try {
    const { hours, limit } = req.query;

    const events = await EventModel.findRecent(
      parseInt(hours) || 24,
      parseInt(limit) || 50
    );

    // Enrich with detection counts
    const enrichedEvents = await Promise.all(
      events.map(async (event) => {
        const detections = await EventModel.getDetections(event.id);
        const feltReports = await FeltReportModel.findByEventId(event.id);
        
        return {
          ...event,
          detection_count: detections.length,
          felt_report_count: feltReports.length
        };
      })
    );

    res.json({
      success: true,
      data: enrichedEvents
    });
  } catch (error) {
    logger.error('Error getting recent events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent events'
    });
  }
}

/**
 * Get a specific event by ID with full details
 * GET /api/events/:id
 */
async function getEvent(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event ID format'
      });
    }

    const event = await EventModel.findByIdWithDetections(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    // Get felt reports for this event
    const feltReports = await FeltReportModel.findByEventId(id);
    const intensityStats = await FeltReportModel.getIntensityStats(id);

    // Get nearby sensor nodes
    let nearbyNodes = [];
    if (event.latitude && event.longitude) {
      const allNodes = await SensorNodeModel.findActive();
      nearbyNodes = geo.findNearbyNodes(
        { latitude: event.latitude, longitude: event.longitude },
        allNodes,
        100 // 100km radius
      );
    }

    res.json({
      success: true,
      data: {
        ...event,
        felt_reports: feltReports,
        intensity_stats: intensityStats,
        nearby_nodes: nearbyNodes
      }
    });
  } catch (error) {
    logger.error('Error getting event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get event'
    });
  }
}

/**
 * Get events near a location
 * GET /api/events/nearby
 */
async function getNearbyEvents(req, res) {
  try {
    const { lat, lon, radius, hours } = req.query;

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const radiusKm = parseFloat(radius) || 100;
    const hoursBack = parseInt(hours) || 24;

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates. lat and lon are required.'
      });
    }

    const events = await EventModel.findNearby(latitude, longitude, radiusKm, hoursBack);

    // Calculate distances
    const eventsWithDistance = events.map(event => ({
      ...event,
      distance_km: event.latitude && event.longitude
        ? geo.haversineDistance(latitude, longitude, event.latitude, event.longitude)
        : null
    }));

    // Sort by distance
    eventsWithDistance.sort((a, b) => (a.distance_km || Infinity) - (b.distance_km || Infinity));

    res.json({
      success: true,
      data: eventsWithDistance
    });
  } catch (error) {
    logger.error('Error getting nearby events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get nearby events'
    });
  }
}

/**
 * Get event statistics
 * GET /api/events/stats
 */
async function getEventStats(req, res) {
  try {
    const { days } = req.query;

    const stats = await EventModel.getStatistics(parseInt(days) || 30);
    const total = await EventModel.count();
    const confirmed = await EventModel.count({ status: 'confirmed' });

    res.json({
      success: true,
      data: {
        ...stats,
        total_all_time: total,
        confirmed_all_time: confirmed
      }
    });
  } catch (error) {
    logger.error('Error getting event stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get event statistics'
    });
  }
}

/**
 * Update event status (admin only)
 * PUT /api/events/:id/status
 */
async function updateEventStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, description } = req.body;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event ID format'
      });
    }

    const validStatuses = ['pending', 'confirmed', 'false_positive'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updateData = { status };
    if (description !== undefined) {
      updateData.description = description;
    }

    const event = await EventModel.update(id, updateData);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    logger.info(`Event ${id} status updated to ${status} by admin ${req.user.id}`);

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    logger.error('Error updating event status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update event status'
    });
  }
}

/**
 * Get event detections
 * GET /api/events/:id/detections
 */
async function getEventDetections(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event ID format'
      });
    }

    const event = await EventModel.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    const detections = await EventModel.getDetections(id);

    res.json({
      success: true,
      data: detections
    });
  } catch (error) {
    logger.error('Error getting event detections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get event detections'
    });
  }
}

/**
 * Manually create an event (admin only)
 * POST /api/events
 */
async function createEvent(req, res) {
  try {
    const {
      event_type,
      latitude,
      longitude,
      magnitude_estimate,
      detected_at,
      description
    } = req.body;

    const event = await EventModel.create({
      event_type: event_type || 'unknown',
      confidence: 1.0, // Manual events have full confidence
      latitude,
      longitude,
      magnitude_estimate,
      detected_at: detected_at ? new Date(detected_at) : new Date(),
      status: 'confirmed', // Manual events are auto-confirmed
      description
    });

    logger.info(`Manual event created by admin ${req.user.id}: ${event.id}`);

    res.status(201).json({
      success: true,
      data: event
    });
  } catch (error) {
    logger.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create event'
    });
  }
}

/**
 * Delete an event (admin only)
 * DELETE /api/events/:id
 */
async function deleteEvent(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event ID format'
      });
    }

    const deleted = await EventModel.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    logger.info(`Event ${id} deleted by admin ${req.user.id}`);

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete event'
    });
  }
}

module.exports = {
  getEvents,
  getRecentEvents,
  getEvent,
  getNearbyEvents,
  getEventStats,
  updateEventStatus,
  getEventDetections,
  createEvent,
  deleteEvent
};

