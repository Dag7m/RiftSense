const { query, transaction } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Felt Report Model - Database operations for crowdsourced "Felt-It" reports
 */
class FeltReportModel {
  
  /**
   * Create a new felt report
   * @param {Object} reportData - Report data
   * @returns {Promise<Object>} Created report
   */
  static async create(reportData) {
    const {
      user_id = null,
      event_id = null,
      latitude,
      longitude,
      intensity,
      description = null,
      is_anonymous = false,
      ip_address = null,
      user_agent = null,
      reported_at = new Date()
    } = reportData;

    const result = await query(
      `INSERT INTO felt_reports 
        (user_id, event_id, latitude, longitude, intensity, description,
         is_anonymous, ip_address, user_agent, reported_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [user_id, event_id, latitude, longitude, intensity, description,
       is_anonymous, ip_address, user_agent, reported_at]
    );

    return result.rows[0];
  }

  /**
   * Find a report by ID
   * @param {string} id - Report UUID
   * @returns {Promise<Object|null>} Report or null
   */
  static async findById(id) {
    const result = await query(
      `SELECT fr.*, u.name as user_name, u.email as user_email
       FROM felt_reports fr
       LEFT JOIN users u ON fr.user_id = u.id
       WHERE fr.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all reports with pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Reports with pagination
   */
  static async findAll(options = {}) {
    const { 
      page = 1, 
      limit = 20,
      event_id = null,
      user_id = null,
      min_intensity = null,
      start_date = null,
      end_date = null
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT fr.*, u.name as user_name
      FROM felt_reports fr
      LEFT JOIN users u ON fr.user_id = u.id
      WHERE 1=1
    `;
    let countSql = 'SELECT COUNT(*) as count FROM felt_reports WHERE 1=1';
    const params = [];
    const countParams = [];

    if (event_id) {
      params.push(event_id);
      countParams.push(event_id);
      sql += ` AND fr.event_id = $${params.length}`;
      countSql += ` AND event_id = $${countParams.length}`;
    }

    if (user_id) {
      params.push(user_id);
      countParams.push(user_id);
      sql += ` AND fr.user_id = $${params.length}`;
      countSql += ` AND user_id = $${countParams.length}`;
    }

    if (min_intensity) {
      params.push(min_intensity);
      countParams.push(min_intensity);
      sql += ` AND fr.intensity >= $${params.length}`;
      countSql += ` AND intensity >= $${countParams.length}`;
    }

    if (start_date) {
      params.push(start_date);
      countParams.push(start_date);
      sql += ` AND fr.reported_at >= $${params.length}`;
      countSql += ` AND reported_at >= $${countParams.length}`;
    }

    if (end_date) {
      params.push(end_date);
      countParams.push(end_date);
      sql += ` AND fr.reported_at <= $${params.length}`;
      countSql += ` AND reported_at <= $${countParams.length}`;
    }

    sql += ' ORDER BY fr.reported_at DESC';
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const [reportsResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      reports: reportsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get reports for an event
   * @param {string} eventId - Event UUID
   * @returns {Promise<Array>} Reports
   */
  static async findByEventId(eventId) {
    const result = await query(
      `SELECT fr.*, u.name as user_name
       FROM felt_reports fr
       LEFT JOIN users u ON fr.user_id = u.id
       WHERE fr.event_id = $1
       ORDER BY fr.reported_at DESC`,
      [eventId]
    );
    return result.rows;
  }

  /**
   * Get reports near a location
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {number} radiusKm - Search radius in km
   * @param {number} hours - Hours to look back
   * @returns {Promise<Array>} Nearby reports
   */
  static async findNearby(latitude, longitude, radiusKm = 50, hours = 24) {
    // Approximate degree to km conversion
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

    const result = await query(
      `SELECT fr.*, u.name as user_name
       FROM felt_reports fr
       LEFT JOIN users u ON fr.user_id = u.id
       WHERE fr.latitude BETWEEN $1 AND $2
         AND fr.longitude BETWEEN $3 AND $4
         AND fr.reported_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY fr.reported_at DESC`,
      [latitude - latDelta, latitude + latDelta,
       longitude - lonDelta, longitude + lonDelta]
    );
    return result.rows;
  }

  /**
   * Update a report's event association
   * @param {string} id - Report UUID
   * @param {string} eventId - Event UUID to associate
   * @returns {Promise<Object|null>} Updated report
   */
  static async updateEventAssociation(id, eventId) {
    const result = await query(
      `UPDATE felt_reports SET event_id = $1 WHERE id = $2 RETURNING *`,
      [eventId, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a report
   * @param {string} id - Report UUID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    const result = await query(
      'DELETE FROM felt_reports WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Get intensity statistics for an event
   * @param {string} eventId - Event UUID
   * @returns {Promise<Object>} Intensity stats
   */
  static async getIntensityStats(eventId) {
    const result = await query(
      `SELECT 
        COUNT(*) as total_reports,
        AVG(intensity) as avg_intensity,
        MAX(intensity) as max_intensity,
        MIN(intensity) as min_intensity,
        MODE() WITHIN GROUP (ORDER BY intensity) as most_common_intensity
       FROM felt_reports 
       WHERE event_id = $1`,
      [eventId]
    );
    return result.rows[0];
  }

  /**
   * Get recent reports
   * @param {number} hours - Hours to look back
   * @param {number} limit - Maximum reports
   * @returns {Promise<Array>} Recent reports
   */
  static async findRecent(hours = 24, limit = 100) {
    const result = await query(
      `SELECT fr.*, u.name as user_name, e.event_type, e.magnitude_estimate
       FROM felt_reports fr
       LEFT JOIN users u ON fr.user_id = u.id
       LEFT JOIN events e ON fr.event_id = e.id
       WHERE fr.reported_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY fr.reported_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Get total report count
   * @returns {Promise<number>} Count
   */
  static async count() {
    const result = await query('SELECT COUNT(*) as count FROM felt_reports');
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get report statistics
   * @param {number} days - Days to analyze
   * @returns {Promise<Object>} Statistics
   */
  static async getStatistics(days = 30) {
    const result = await query(
      `SELECT 
        COUNT(*) as total_reports,
        COUNT(*) FILTER (WHERE is_anonymous = true) as anonymous_reports,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL) as matched_reports,
        AVG(intensity) as avg_intensity
       FROM felt_reports 
       WHERE reported_at > NOW() - INTERVAL '${days} days'`
    );
    return result.rows[0];
  }
}

module.exports = FeltReportModel;

