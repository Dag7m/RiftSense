const { query, transaction } = require('../config/db');

/**
 * Sensor Data Model - Database operations for time-series accelerometer data
 */
class SensorDataModel {

  /**
   * Insert a single sensor data point
   * @param {Object} data - Sensor data
   * @returns {Promise<Object>} Inserted data
   */
  static async insert(data) {
    const {
      node_id,
      x_axis,
      y_axis,
      z_axis,
      sampling_rate = 100,
      timestamp = new Date()
    } = data;

    // Calculate net magnitude (subtracting 1g gravity)
    const rawMagnitude = Math.sqrt(x_axis ** 2 + y_axis ** 2 + z_axis ** 2);
    const magnitude = Math.abs(rawMagnitude - 1.0);

    const result = await query(
      `INSERT INTO sensor_data 
        (time, node_id, x_axis, y_axis, z_axis, magnitude, sampling_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (time, node_id) DO NOTHING
       RETURNING *`,
      [timestamp, node_id, x_axis, y_axis, z_axis, magnitude, sampling_rate]
    );

    return result.rows[0];
  }

  /**
   * Insert multiple sensor data points (batch insert)
   * @param {Array} dataPoints - Array of sensor data points
   * @returns {Promise<number>} Number of inserted rows
   */
  static async insertBatch(dataPoints) {
    if (!dataPoints || dataPoints.length === 0) {
      return 0;
    }

    // Build batch insert query
    const values = [];
    const placeholders = [];
    let paramCount = 1;

    for (const data of dataPoints) {
      const rawMagnitude = Math.sqrt(data.x_axis ** 2 + data.y_axis ** 2 + data.z_axis ** 2);
      const magnitude = Math.abs(rawMagnitude - 1.0);

      placeholders.push(
        `($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6})`
      );

      values.push(
        data.timestamp || new Date(),
        data.node_id,
        data.x_axis,
        data.y_axis,
        data.z_axis,
        magnitude,
        data.sampling_rate || 100
      );

      paramCount += 7;
    }

    const result = await query(
      `INSERT INTO sensor_data 
        (time, node_id, x_axis, y_axis, z_axis, magnitude, sampling_rate)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (time, node_id) DO NOTHING`,
      values
    );

    return result.rowCount;
  }

  /**
   * Get recent sensor data for a node
   * @param {string} nodeId - Node UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Sensor data points
   */
  static async getRecent(nodeId, options = {}) {
    const {
      limit = 1000,
      minutes = 5,
      startTime = null,
      endTime = null
    } = options;

    const params = [nodeId];
    let sql = `
      SELECT time, x_axis, y_axis, z_axis, magnitude, sampling_rate 
      FROM sensor_data 
      WHERE node_id = $1
    `;

    if (startTime && endTime) {
      params.push(startTime, endTime);
      sql += ` AND time BETWEEN $2 AND $3`;
    } else if (Number.isFinite(minutes) && minutes > 0) {
      // minutes=0 means "latest N rows" only (no wall-clock window) — for live charts when device clock skews
      sql += ` AND time > NOW() - INTERVAL '${minutes} minutes'`;
    }

    // Add limit parameter - calculate index after all other params are added
    const limitParamIndex = params.length + 1;
    params.push(limit);
    sql += ` ORDER BY time DESC LIMIT $${limitParamIndex}`;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get data for a specific time range (for event analysis)
   * @param {string} nodeId - Node UUID
   * @param {Date} startTime - Start timestamp
   * @param {Date} endTime - End timestamp
   * @returns {Promise<Array>} Sensor data points
   */
  static async getTimeRange(nodeId, startTime, endTime) {
    const result = await query(
      `SELECT time, x_axis, y_axis, z_axis, magnitude, sampling_rate 
       FROM sensor_data 
       WHERE node_id = $1 
         AND time BETWEEN $2 AND $3
       ORDER BY time ASC`,
      [nodeId, startTime, endTime]
    );
    return result.rows;
  }

  /**
   * Get latest data point for a node
   * @param {string} nodeId - Node UUID
   * @returns {Promise<Object|null>} Latest data point
   */
  static async getLatest(nodeId) {
    const result = await query(
      `SELECT time, x_axis, y_axis, z_axis, magnitude, sampling_rate 
       FROM sensor_data 
       WHERE node_id = $1 
       ORDER BY time DESC 
       LIMIT 1`,
      [nodeId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get peak magnitude in a time range
   * @param {string} nodeId - Node UUID
   * @param {Date} startTime - Start timestamp
   * @param {Date} endTime - End timestamp
   * @returns {Promise<Object>} Peak data
   */
  static async getPeakMagnitude(nodeId, startTime, endTime) {
    const result = await query(
      `SELECT MAX(magnitude) as peak_magnitude,
              AVG(magnitude) as avg_magnitude,
              MIN(magnitude) as min_magnitude,
              COUNT(*) as sample_count
       FROM sensor_data 
       WHERE node_id = $1 
         AND time BETWEEN $2 AND $3`,
      [nodeId, startTime, endTime]
    );
    return result.rows[0];
  }

  /**
   * Get hourly aggregates for a node
   * @param {string} nodeId - Node UUID
   * @param {number} hours - Number of hours to look back
   * @returns {Promise<Array>} Hourly aggregates
   */
  static async getHourlyAggregates(nodeId, hours = 24) {
    const result = await query(
      `SELECT 
        time_bucket('1 hour', time) as bucket,
        AVG(magnitude) as avg_magnitude,
        MAX(magnitude) as max_magnitude,
        MIN(magnitude) as min_magnitude,
        COUNT(*) as sample_count
       FROM sensor_data 
       WHERE node_id = $1 
         AND time > NOW() - INTERVAL '${hours} hours'
       GROUP BY bucket
       ORDER BY bucket DESC`,
      [nodeId]
    );
    return result.rows;
  }

  /**
   * Get aggregates across all nodes for a time period
   * @param {number} minutes - Minutes to look back
   * @returns {Promise<Array>} Aggregates per node
   */
  static async getNetworkStats(minutes = 5) {
    const result = await query(
      `SELECT 
        node_id,
        AVG(magnitude) as avg_magnitude,
        MAX(magnitude) as max_magnitude,
        COUNT(*) as sample_count,
        MAX(time) as last_reading
       FROM sensor_data 
       WHERE time > NOW() - INTERVAL '${minutes} minutes'
       GROUP BY node_id`,
      []
    );
    return result.rows;
  }

  /**
   * Delete old data (for retention policy)
   * @param {number} days - Days to retain
   * @returns {Promise<number>} Number of deleted rows
   */
  static async deleteOld(days = 30) {
    const result = await query(
      `DELETE FROM sensor_data 
       WHERE time < NOW() - INTERVAL '${days} days'`,
      []
    );
    return result.rowCount;
  }

  /**
   * Get data count for a node
   * @param {string} nodeId - Node UUID
   * @returns {Promise<number>} Count
   */
  static async count(nodeId) {
    const result = await query(
      'SELECT COUNT(*) as count FROM sensor_data WHERE node_id = $1',
      [nodeId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get total data count across all nodes
   * @returns {Promise<number>} Count
   */
  static async totalCount() {
    const result = await query(
      'SELECT COUNT(*) as count FROM sensor_data'
    );
    return parseInt(result.rows[0].count, 10);
  }
}

module.exports = SensorDataModel;

