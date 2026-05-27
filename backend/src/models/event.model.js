const { query, transaction } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Event Model - Database operations for seismic events
 */
class EventModel {
  
  /**
   * Create a new seismic event
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Created event
   */
  static async create(eventData) {
    const {
      event_type = 'unknown',
      confidence = 0,
      magnitude_estimate = null,
      latitude = null,
      longitude = null,
      depth_km = null,
      detected_at,
      status = 'pending',
      description = null
    } = eventData;

    const result = await query(
      `INSERT INTO events 
        (event_type, confidence, magnitude_estimate, latitude, longitude, 
         depth_km, detected_at, status, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [event_type, confidence, magnitude_estimate, latitude, longitude,
       depth_km, detected_at, status, description]
    );

    return result.rows[0];
  }

  /**
   * Find an event by ID
   * @param {string} id - Event UUID
   * @returns {Promise<Object|null>} Event or null
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM events WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find an event with its detections
   * @param {string} id - Event UUID
   * @returns {Promise<Object|null>} Event with detections
   */
  static async findByIdWithDetections(id) {
    const eventResult = await query(
      'SELECT * FROM events WHERE id = $1',
      [id]
    );

    if (eventResult.rows.length === 0) {
      return null;
    }

    const event = eventResult.rows[0];

    const detectionsResult = await query(
      `SELECT ed.*, sn.node_id as sensor_node_id, sn.name as sensor_name,
              sn.latitude as node_latitude, sn.longitude as node_longitude
       FROM event_detections ed
       JOIN sensor_nodes sn ON ed.node_id = sn.id
       WHERE ed.event_id = $1
       ORDER BY ed.detection_time ASC`,
      [id]
    );

    event.detections = detectionsResult.rows;
    return event;
  }

  /**
   * Get all events with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Events with pagination info
   */
  static async findAll(options = {}) {
    const { 
      page = 1, 
      limit = 20, 
      status = null,
      event_type = null,
      start_date = null,
      end_date = null,
      min_confidence = null
    } = options;

    const offset = (page - 1) * limit;
    let sql = 'SELECT * FROM events WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM events WHERE 1=1';
    const params = [];
    const countParams = [];

    if (status) {
      params.push(status);
      countParams.push(status);
      sql += ` AND status = $${params.length}`;
      countSql += ` AND status = $${countParams.length}`;
    }

    if (event_type) {
      params.push(event_type);
      countParams.push(event_type);
      sql += ` AND event_type = $${params.length}`;
      countSql += ` AND event_type = $${countParams.length}`;
    }

    if (start_date) {
      params.push(start_date);
      countParams.push(start_date);
      sql += ` AND detected_at >= $${params.length}`;
      countSql += ` AND detected_at >= $${countParams.length}`;
    }

    if (end_date) {
      params.push(end_date);
      countParams.push(end_date);
      sql += ` AND detected_at <= $${params.length}`;
      countSql += ` AND detected_at <= $${countParams.length}`;
    }

    if (min_confidence) {
      params.push(min_confidence);
      countParams.push(min_confidence);
      sql += ` AND confidence >= $${params.length}`;
      countSql += ` AND confidence >= $${countParams.length}`;
    }

    sql += ' ORDER BY detected_at DESC';
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const [eventsResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      events: eventsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get recent events
   * @param {number} hours - Hours to look back
   * @param {number} limit - Maximum number of events
   * @returns {Promise<Array>} Recent events
   */
  static async findRecent(hours = 24, limit = 50) {
    const result = await query(
      `SELECT * FROM events 
       WHERE detected_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY detected_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Update an event
   * @param {string} id - Event UUID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated event
   */
  static async update(id, updateData) {
    const allowedFields = ['event_type', 'confidence', 'magnitude_estimate', 
                           'latitude', 'longitude', 'depth_km', 'status', 'description'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE events 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Update event status
   * @param {string} id - Event UUID
   * @param {string} status - New status
   * @returns {Promise<Object|null>} Updated event
   */
  static async updateStatus(id, status) {
    const result = await query(
      `UPDATE events SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete an event
   * @param {string} id - Event UUID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    const result = await query(
      'DELETE FROM events WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Add a detection to an event
   * @param {Object} detectionData - Detection data
   * @returns {Promise<Object>} Created detection
   */
  static async addDetection(detectionData) {
    const {
      event_id,
      node_id,
      detection_time,
      peak_acceleration,
      sta_lta_ratio = null,
      distance_from_epicenter = null,
      p_wave_arrival = null,
      s_wave_arrival = null
    } = detectionData;

    const result = await query(
      `INSERT INTO event_detections 
        (event_id, node_id, detection_time, peak_acceleration, 
         sta_lta_ratio, distance_from_epicenter, p_wave_arrival, s_wave_arrival)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [event_id, node_id, detection_time, peak_acceleration,
       sta_lta_ratio, distance_from_epicenter, p_wave_arrival, s_wave_arrival]
    );

    return result.rows[0];
  }

  /**
   * Get detections for an event
   * @param {string} eventId - Event UUID
   * @returns {Promise<Array>} Detections
   */
  static async getDetections(eventId) {
    const result = await query(
      `SELECT ed.*, sn.node_id as sensor_node_id, sn.name as sensor_name
       FROM event_detections ed
       JOIN sensor_nodes sn ON ed.node_id = sn.id
       WHERE ed.event_id = $1
       ORDER BY ed.detection_time ASC`,
      [eventId]
    );
    return result.rows;
  }

  /**
   * Find events near a location
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {number} radiusKm - Search radius in km
   * @param {number} hours - Hours to look back
   * @returns {Promise<Array>} Nearby events
   */
  static async findNearby(latitude, longitude, radiusKm = 100, hours = 24) {
    // pg returns DECIMAL as strings; coerce before arithmetic (avoid "37.77" + 0.45 → concat)
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return [];
    }

    // Approximate degree to km conversion (varies by latitude)
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

    const result = await query(
      `SELECT * FROM events 
       WHERE latitude BETWEEN $1 AND $2
         AND longitude BETWEEN $3 AND $4
         AND detected_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY detected_at DESC`,
      [lat - latDelta, lat + latDelta, lon - lonDelta, lon + lonDelta]
    );
    return result.rows;
  }

  /**
   * Get event count
   * @param {Object} filters - Optional filters
   * @returns {Promise<number>} Count
   */
  static async count(filters = {}) {
    let sql = 'SELECT COUNT(*) as count FROM events';
    const params = [];

    if (filters.status) {
      params.push(filters.status);
      sql += ` WHERE status = $${params.length}`;
    }

    const result = await query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get event statistics
   * @param {number} days - Days to analyze
   * @returns {Promise<Object>} Statistics
   */
  static async getStatistics(days = 30) {
    const result = await query(
      `SELECT 
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_events,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_events,
        COUNT(*) FILTER (WHERE event_type = 'earthquake') as earthquake_count,
        AVG(confidence) as avg_confidence,
        MAX(magnitude_estimate) as max_magnitude
       FROM events 
       WHERE detected_at > NOW() - INTERVAL '${days} days'`
    );
    return result.rows[0];
  }

  /**
   * Public summary stats for home page and GET /api/events/stats.
   * @returns {Promise<Object>} Counts from the events table
   */
  static async getSummaryStats() {
    const result = await query(
      `SELECT 
        COUNT(*)::int AS total_events,
        COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_earthquakes,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'false_positive')::int AS false_positives,
        COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '24 hours')::int AS last_24h,
        COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '7 days')::int AS last_7d,
        COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '30 days')::int AS last_30d
       FROM events`
    );

    const row = result.rows[0];
    const toInt = (v) => parseInt(v, 10) || 0;

    return {
      total_events: toInt(row.total_events),
      confirmed_earthquakes: toInt(row.confirmed_earthquakes),
      pending: toInt(row.pending),
      false_positives: toInt(row.false_positives),
      last_24h: toInt(row.last_24h),
      last_7d: toInt(row.last_7d),
      last_30d: toInt(row.last_30d)
    };
  }
}

module.exports = EventModel;

