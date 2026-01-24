const FeltReportModel = require('../models/feltReport.model');
const EventModel = require('../models/event.model');
const geo = require('../utils/geo');
const logger = require('../utils/logger');
const { isValidUUID } = require('../utils/validators');

/**
 * Felt Controller
 * 
 * Handles crowdsourced "Felt-It" earthquake reports.
 */

// Matching thresholds
const MATCH_DISTANCE_KM = 100;    // Maximum distance to match report to event
const MATCH_TIME_MINUTES = 30;    // Maximum time difference to match

/**
 * Submit a felt report
 * POST /api/felt
 */
async function submitReport(req, res) {
  try {
    const {
      latitude,
      longitude,
      intensity,
      description,
      is_anonymous,
      reported_at
    } = req.body;

    // Get user ID if authenticated
    const userId = req.user ? req.user.id : null;

    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    // Create the report
    const report = await FeltReportModel.create({
      user_id: userId,
      latitude,
      longitude,
      intensity,
      description,
      is_anonymous: is_anonymous || !userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      reported_at: reported_at ? new Date(reported_at) : new Date()
    });

    // Try to match with a recent event
    let matchedEvent = null;
    const recentEvents = await EventModel.findNearby(
      latitude,
      longitude,
      MATCH_DISTANCE_KM,
      1 // Last hour
    );

    if (recentEvents.length > 0) {
      const match = geo.matchReportToEvent(
        {
          latitude,
          longitude,
          reported_at: report.reported_at
        },
        recentEvents,
        {
          maxDistanceKm: MATCH_DISTANCE_KM,
          maxTimeMinutes: MATCH_TIME_MINUTES
        }
      );

      if (match) {
        // Update report with event association
        await FeltReportModel.updateEventAssociation(report.id, match.event.id);
        matchedEvent = {
          id: match.event.id,
          event_type: match.event.event_type,
          magnitude_estimate: match.event.magnitude_estimate,
          distance_km: match.distance,
          time_diff_minutes: match.timeDiffMinutes
        };

        logger.info(`Felt report ${report.id} matched to event ${match.event.id}`);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id: report.id,
        latitude: report.latitude,
        longitude: report.longitude,
        intensity: report.intensity,
        reported_at: report.reported_at,
        matched_event: matchedEvent
      },
      message: matchedEvent 
        ? 'Report submitted and matched to a detected event'
        : 'Report submitted successfully'
    });
  } catch (error) {
    logger.error('Error submitting felt report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit felt report'
    });
  }
}

/**
 * Get felt reports near a location
 * GET /api/felt/nearby
 */
async function getNearbyReports(req, res) {
  try {
    const { lat, lon, radius, hours } = req.query;

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates. lat and lon are required.'
      });
    }

    const reports = await FeltReportModel.findNearby(
      latitude,
      longitude,
      parseFloat(radius) || 50,
      parseInt(hours) || 24
    );

    // Add distance to each report
    const reportsWithDistance = reports.map(report => ({
      ...report,
      distance_km: geo.haversineDistance(
        latitude, longitude,
        report.latitude, report.longitude
      )
    }));

    // Sort by distance
    reportsWithDistance.sort((a, b) => a.distance_km - b.distance_km);

    res.json({
      success: true,
      data: reportsWithDistance
    });
  } catch (error) {
    logger.error('Error getting nearby reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get nearby reports'
    });
  }
}

/**
 * Get felt reports for an event
 * GET /api/felt/event/:eventId
 */
async function getEventReports(req, res) {
  try {
    const { eventId } = req.params;

    if (!isValidUUID(eventId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event ID format'
      });
    }

    // Check event exists
    const event = await EventModel.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    const reports = await FeltReportModel.findByEventId(eventId);
    const intensityStats = await FeltReportModel.getIntensityStats(eventId);

    // Calculate intensity distribution
    const intensityDistribution = {};
    reports.forEach(report => {
      const intensity = report.intensity;
      intensityDistribution[intensity] = (intensityDistribution[intensity] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        event_id: eventId,
        reports,
        total_count: reports.length,
        stats: intensityStats,
        intensity_distribution: intensityDistribution
      }
    });
  } catch (error) {
    logger.error('Error getting event reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get event reports'
    });
  }
}

/**
 * Get recent felt reports
 * GET /api/felt/recent
 */
async function getRecentReports(req, res) {
  try {
    const { hours, limit } = req.query;

    const reports = await FeltReportModel.findRecent(
      parseInt(hours) || 24,
      parseInt(limit) || 100
    );

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    logger.error('Error getting recent reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent reports'
    });
  }
}

/**
 * Get a specific felt report
 * GET /api/felt/:id
 */
async function getReport(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report ID format'
      });
    }

    const report = await FeltReportModel.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Get associated event if any
    let event = null;
    if (report.event_id) {
      event = await EventModel.findById(report.event_id);
    }

    res.json({
      success: true,
      data: {
        ...report,
        event
      }
    });
  } catch (error) {
    logger.error('Error getting report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get report'
    });
  }
}

/**
 * Get felt report statistics
 * GET /api/felt/stats
 */
async function getReportStats(req, res) {
  try {
    const { days } = req.query;

    const stats = await FeltReportModel.getStatistics(parseInt(days) || 30);
    const total = await FeltReportModel.count();

    res.json({
      success: true,
      data: {
        ...stats,
        total_all_time: total
      }
    });
  } catch (error) {
    logger.error('Error getting report stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get report statistics'
    });
  }
}

/**
 * Delete a felt report (admin only)
 * DELETE /api/felt/:id
 */
async function deleteReport(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report ID format'
      });
    }

    const deleted = await FeltReportModel.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    logger.info(`Felt report ${id} deleted by admin ${req.user.id}`);

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete report'
    });
  }
}

/**
 * Get intensity scale reference
 * GET /api/felt/intensity-scale
 */
async function getIntensityScale(req, res) {
  // Modified Mercalli Intensity Scale
  const scale = [
    { level: 1, name: 'Not Felt', description: 'Not felt except by a very few under especially favorable conditions.' },
    { level: 2, name: 'Weak', description: 'Felt only by a few persons at rest, especially on upper floors.' },
    { level: 3, name: 'Weak', description: 'Felt quite noticeably by persons indoors. Hanging objects swing.' },
    { level: 4, name: 'Light', description: 'Felt indoors by many, outdoors by few. Dishes, windows, doors disturbed.' },
    { level: 5, name: 'Moderate', description: 'Felt by nearly everyone. Some dishes and windows broken. Unstable objects overturned.' },
    { level: 6, name: 'Strong', description: 'Felt by all. Many frightened. Some heavy furniture moved. Some plaster falls.' },
    { level: 7, name: 'Very Strong', description: 'Damage negligible in well-built buildings, slight to moderate in ordinary structures.' },
    { level: 8, name: 'Severe', description: 'Damage slight in specially designed structures, considerable in ordinary buildings.' },
    { level: 9, name: 'Violent', description: 'Damage considerable in specially designed structures. Buildings shifted off foundations.' },
    { level: 10, name: 'Extreme', description: 'Most masonry and frame structures destroyed. Rails bent. Landslides.' }
  ];

  res.json({
    success: true,
    data: {
      name: 'Modified Mercalli Intensity Scale',
      levels: scale
    }
  });
}

module.exports = {
  submitReport,
  getNearbyReports,
  getEventReports,
  getRecentReports,
  getReport,
  getReportStats,
  deleteReport,
  getIntensityScale
};

