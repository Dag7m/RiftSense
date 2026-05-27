const { query } = require('../config/db');
const geo = require('../utils/geo');

/**
 * UserLocation Model - stores user location/preferences for geo alerts
 */
class UserLocationModel {
  /**
   * Upsert a user's location.
   * @param {Object} data
   * @param {string} data.user_id
   * @param {number} data.latitude
   * @param {number} data.longitude
   * @param {number|null} data.radius_km
   * @param {boolean} data.notifications_enabled
   */
  static async upsert(data) {
    const {
      user_id,
      latitude,
      longitude,
      radius_km = null,
      notifications_enabled = true
    } = data;

    const result = await query(
      `INSERT INTO user_locations (user_id, latitude, longitude, radius_km, notifications_enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         radius_km = EXCLUDED.radius_km,
         notifications_enabled = EXCLUDED.notifications_enabled,
         updated_at = NOW()
       RETURNING *`,
      [user_id, latitude, longitude, radius_km, notifications_enabled]
    );

    return result.rows[0];
  }

  static async findByUserId(userId) {
    const result = await query(
      `SELECT *
       FROM user_locations
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find candidate user locations in a bounding box.
   * Caller should still haversine-filter by exact radius.
   */
  static async findCandidatesInRadiusBox({ latitude, longitude, radiusKm }) {
    const box = geo.boundingBox(latitude, longitude, radiusKm);

    const result = await query(
      `SELECT ul.user_id, ul.latitude, ul.longitude, ul.radius_km, ul.notifications_enabled
       FROM user_locations ul
       JOIN users u ON u.id = ul.user_id
       WHERE u.is_active = true
         AND ul.notifications_enabled = true
         AND ul.latitude BETWEEN $1 AND $2
         AND ul.longitude BETWEEN $3 AND $4`,
      [box.minLat, box.maxLat, box.minLon, box.maxLon]
    );

    return result.rows;
  }
}

module.exports = UserLocationModel;

