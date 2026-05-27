const UserLocationModel = require('../models/userLocation.model');
const logger = require('../utils/logger');

/**
 * User location controller (stored in user_locations table)
 */

async function getMyLocation(req, res) {
  try {
    const loc = await UserLocationModel.findByUserId(req.user.id);
    res.json({ success: true, data: loc });
  } catch (error) {
    logger.error('Error getting user location:', error);
    res.status(500).json({ success: false, error: 'Failed to get location' });
  }
}

async function upsertMyLocation(req, res) {
  try {
    const { latitude, longitude, radius_km, notifications_enabled } = req.body;

    const loc = await UserLocationModel.upsert({
      user_id: req.user.id,
      latitude,
      longitude,
      radius_km: radius_km ?? null,
      notifications_enabled: notifications_enabled !== false
    });

    res.json({ success: true, data: loc });
  } catch (error) {
    logger.error('Error updating user location:', error);
    res.status(500).json({ success: false, error: 'Failed to update location' });
  }
}

module.exports = {
  getMyLocation,
  upsertMyLocation
};

