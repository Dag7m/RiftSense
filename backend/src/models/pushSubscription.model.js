const { query } = require('../config/db');

class PushSubscriptionModel {
  static async upsert({ user_id, subscription, user_agent = null }) {
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      throw new Error('Invalid push subscription payload');
    }

    const result = await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, endpoint)
       DO UPDATE SET
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         user_agent = EXCLUDED.user_agent,
         updated_at = NOW()
       RETURNING *`,
      [user_id, endpoint, p256dh, auth, user_agent]
    );

    return result.rows[0];
  }

  static async listByUserId(userId) {
    const result = await query(
      `SELECT *
       FROM push_subscriptions
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );
    return result.rows;
  }

  static async deleteByEndpoint(userId, endpoint) {
    const result = await query(
      `DELETE FROM push_subscriptions
       WHERE user_id = $1 AND endpoint = $2`,
      [userId, endpoint]
    );
    return result.rowCount;
  }
}

module.exports = PushSubscriptionModel;

