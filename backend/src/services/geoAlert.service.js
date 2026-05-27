const geo = require('../utils/geo');
const UserLocationModel = require('../models/userLocation.model');
const NotificationModel = require('../models/notification.model');
const logger = require('../utils/logger');
const pushService = require('./push.service');

function magnitudeToAlertRadiusKm(magnitudeEstimate) {
  const m = parseFloat(magnitudeEstimate);
  if (!Number.isFinite(m) || m <= 0) return 5;
  if (m >= 5.5) return 150;
  if (m >= 4.5) return 75;
  if (m >= 3.5) return 30;
  if (m >= 2.5) return 15;
  return 5;
}

/**
 * Create user notifications for an earthquake event based on user location proximity.
 * Idempotent: uses a unique constraint (user_id, event_id, type).
 */
async function notifyUsersNearEvent(event) {
  try {
    const eventLat = parseFloat(event.latitude);
    const eventLon = parseFloat(event.longitude);
    if (!Number.isFinite(eventLat) || !Number.isFinite(eventLon)) return { notified: 0 };

    const magnitudeEstimate = event.magnitude_estimate;
    const baseRadiusKm = magnitudeToAlertRadiusKm(magnitudeEstimate);

    const candidates = await UserLocationModel.findCandidatesInRadiusBox({
      latitude: eventLat,
      longitude: eventLon,
      radiusKm: baseRadiusKm
    });

    let created = 0;
    for (const u of candidates) {
      const userLat = parseFloat(u.latitude);
      const userLon = parseFloat(u.longitude);
      const distance = geo.haversineDistance(eventLat, eventLon, userLat, userLon);

      const userRadius = u.radius_km != null ? parseFloat(u.radius_km) : null;
      const effectiveRadius = Number.isFinite(userRadius) ? Math.min(baseRadiusKm, userRadius) : baseRadiusKm;

      if (distance > effectiveRadius) continue;

      const title = 'Earthquake alert';
      const message = `Possible M${magnitudeEstimate ?? ''} earthquake detected near you. Distance ~${distance.toFixed(
        1
      )}km (alert radius ${effectiveRadius}km).`;

      const row = await NotificationModel.create({
        user_id: u.user_id,
        event_id: event.id,
        type: 'earthquake_alert',
        title,
        message,
        magnitude_estimate: magnitudeEstimate,
        alert_radius_km: effectiveRadius,
        distance_km: parseFloat(distance.toFixed(2))
      });

      if (row) {
        created += 1;
        // Fire-and-forget web push (if configured).
        await pushService.sendToUser(u.user_id, {
          title,
          body: message,
          event_id: event.id,
          type: 'earthquake_alert'
        });
      }
    }

    return { notified: created, baseRadiusKm, candidates: candidates.length };
  } catch (error) {
    logger.error('Geo alert notification error:', error);
    return { notified: 0, error: error.message };
  }
}

module.exports = {
  notifyUsersNearEvent,
  magnitudeToAlertRadiusKm
};

