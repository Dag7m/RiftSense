const { query, transaction } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Sensor Node Model - Database operations for sensor nodes
 */
class SensorNodeModel {
  
  /**
   * Create a new sensor node
   * @param {Object} nodeData - Node data
   * @returns {Promise<Object>} Created node
   */
  static async create(nodeData) {
    const {
      node_id,
      name,
      latitude,
      longitude,
      elevation = null,
      status = 'active',
      firmware_version = null
    } = nodeData;

    const result = await query(
      `INSERT INTO sensor_nodes 
        (node_id, name, latitude, longitude, elevation, status, firmware_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [node_id, name, latitude, longitude, elevation, status, firmware_version]
    );

    return result.rows[0];
  }

  /**
   * Find a node by its UUID
   * @param {string} id - Node UUID
   * @returns {Promise<Object|null>} Node or null
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM sensor_nodes WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find a node by its node_id (ESP32 identifier)
   * @param {string} nodeId - ESP32 node identifier
   * @returns {Promise<Object|null>} Node or null
   */
  static async findByNodeId(nodeId) {
    const result = await query(
      'SELECT * FROM sensor_nodes WHERE node_id = $1',
      [nodeId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all sensor nodes with optional filtering
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} List of nodes
   */
  static async findAll(options = {}) {
    const { status, limit = 100, offset = 0 } = options;

    let sql = 'SELECT * FROM sensor_nodes';
    const params = [];

    if (status) {
      params.push(status);
      sql += ` WHERE status = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';
    
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get active nodes
   * @returns {Promise<Array>} List of active nodes
   */
  static async findActive() {
    const result = await query(
      `SELECT * FROM sensor_nodes 
       WHERE status = 'active' 
       ORDER BY last_heartbeat DESC NULLS LAST`
    );
    return result.rows;
  }

  /**
   * Update a sensor node
   * @param {string} id - Node UUID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated node
   */
  static async update(id, updateData) {
    const allowedFields = ['name', 'latitude', 'longitude', 'elevation', 'status', 'firmware_version'];
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
      `UPDATE sensor_nodes 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Update node heartbeat
   * @param {string} nodeId - ESP32 node identifier
   * @param {Object} data - Heartbeat data (battery_level, status)
   * @returns {Promise<Object|null>} Updated node
   */
  static async updateHeartbeat(nodeId, data = {}) {
    const { battery_level, status } = data;
    
    let sql = `UPDATE sensor_nodes SET last_heartbeat = NOW()`;
    const params = [];
    let paramCount = 1;

    if (battery_level !== undefined) {
      params.push(battery_level);
      sql += `, battery_level = $${paramCount}`;
      paramCount++;
    }

    if (status !== undefined) {
      params.push(status);
      sql += `, status = $${paramCount}`;
      paramCount++;
    }

    params.push(nodeId);
    sql += ` WHERE node_id = $${paramCount} RETURNING *`;

    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Deactivate a node (soft delete)
   * @param {string} id - Node UUID
   * @returns {Promise<Object|null>} Deactivated node
   */
  static async deactivate(id) {
    const result = await query(
      `UPDATE sensor_nodes 
       SET status = 'inactive' 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a node permanently
   * @param {string} id - Node UUID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    const result = await query(
      'DELETE FROM sensor_nodes WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Get nodes within a geographic bounding box
   * @param {Object} bounds - { minLat, maxLat, minLon, maxLon }
   * @returns {Promise<Array>} Nodes within bounds
   */
  static async findInBounds(bounds) {
    const { minLat, maxLat, minLon, maxLon } = bounds;
    
    const result = await query(
      `SELECT * FROM sensor_nodes 
       WHERE latitude BETWEEN $1 AND $2 
         AND longitude BETWEEN $3 AND $4
         AND status = 'active'`,
      [minLat, maxLat, minLon, maxLon]
    );
    return result.rows;
  }

  /**
   * Get total count of nodes
   * @param {Object} filters - Optional filters
   * @returns {Promise<number>} Count
   */
  static async count(filters = {}) {
    let sql = 'SELECT COUNT(*) as count FROM sensor_nodes';
    const params = [];

    if (filters.status) {
      params.push(filters.status);
      sql += ` WHERE status = $${params.length}`;
    }

    const result = await query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get nodes that haven't sent heartbeat recently
   * @param {number} minutes - Minutes threshold
   * @returns {Promise<Array>} Offline nodes
   */
  static async findOffline(minutes = 5) {
    const result = await query(
      `SELECT * FROM sensor_nodes 
       WHERE status = 'active' 
         AND (last_heartbeat IS NULL 
              OR last_heartbeat < NOW() - INTERVAL '${minutes} minutes')`,
      []
    );
    return result.rows;
  }
}

module.exports = SensorNodeModel;

