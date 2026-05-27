const { query } = require('../config/db');

/**
 * Notification Model - per-user stored notifications/alerts.
 */
class NotificationModel {
  static async create(notification) {
    const {
      user_id,
      event_id = null,
      type = 'earthquake_alert',
      title,
      message,
      magnitude_estimate = null,
      alert_radius_km = null,
      distance_km = null
    } = notification;

    const result = await query(
      `INSERT INTO notifications
        (user_id, event_id, type, title, message, magnitude_estimate, alert_radius_km, distance_km)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, event_id, type) DO NOTHING
       RETURNING *`,
      [user_id, event_id, type, title, message, magnitude_estimate, alert_radius_km, distance_km]
    );

    return result.rows[0] || null;
  }

  static async listForUser(userId, options = {}) {
    const { limit = 50, unreadOnly = false } = options;

    const params = [userId];
    let sql = `
      SELECT *
      FROM notifications
      WHERE user_id = $1
    `;

    if (unreadOnly) {
      sql += ` AND is_read = false`;
    }

    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $2`;

    const result = await query(sql, params);
    return result.rows;
  }

  static async markRead(userId, notificationId) {
    const result = await query(
      `UPDATE notifications
       SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [notificationId, userId]
    );
    return result.rows[0] || null;
  }

  static async markAllRead(userId) {
    const result = await query(
      `UPDATE notifications
       SET is_read = true
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return result.rowCount;
  }
}

module.exports = NotificationModel;

