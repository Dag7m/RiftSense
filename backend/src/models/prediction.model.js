const { query, transaction } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Prediction Model - Database operations for ML model predictions
 */
class PredictionModel {
  
  /**
   * Create a new prediction record
   * @param {Object} predictionData - Prediction data
   * @returns {Promise<Object>} Created prediction
   */
  static async create(predictionData) {
    const {
      node_id,
      data_segment_start,
      data_segment_end,
      prediction,
      confidence,
      features = null,
      model_version = 'placeholder-v1',
      processing_time_ms = null
    } = predictionData;

    const result = await query(
      `INSERT INTO predictions 
        (node_id, data_segment_start, data_segment_end, prediction, 
         confidence, features, model_version, processing_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [node_id, data_segment_start, data_segment_end, prediction,
       confidence, features ? JSON.stringify(features) : null, 
       model_version, processing_time_ms]
    );

    return result.rows[0];
  }

  /**
   * Find a prediction by ID
   * @param {string} id - Prediction UUID
   * @returns {Promise<Object|null>} Prediction or null
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM predictions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get predictions for a node
   * @param {string} nodeId - Node UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Predictions
   */
  static async findByNodeId(nodeId, options = {}) {
    const { limit = 100, hours = 24 } = options;

    const result = await query(
      `SELECT * FROM predictions 
       WHERE node_id = $1 
         AND created_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY created_at DESC
       LIMIT $2`,
      [nodeId, limit]
    );
    return result.rows;
  }

  /**
   * Get predictions by result type
   * @param {string} prediction - Prediction type (earthquake, noise, unknown)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Predictions
   */
  static async findByPrediction(prediction, options = {}) {
    const { limit = 100, hours = 24, min_confidence = 0 } = options;

    const result = await query(
      `SELECT p.*, sn.node_id as sensor_node_id, sn.name as sensor_name
       FROM predictions p
       JOIN sensor_nodes sn ON p.node_id = sn.id
       WHERE p.prediction = $1 
         AND p.confidence >= $2
         AND p.created_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY p.created_at DESC
       LIMIT $3`,
      [prediction, min_confidence, limit]
    );
    return result.rows;
  }

  /**
   * Get recent earthquake predictions
   * @param {number} hours - Hours to look back
   * @param {number} minConfidence - Minimum confidence threshold
   * @returns {Promise<Array>} Earthquake predictions
   */
  static async findRecentEarthquakes(hours = 24, minConfidence = 0.5) {
    const result = await query(
      `SELECT p.*, sn.node_id as sensor_node_id, sn.name as sensor_name,
              sn.latitude, sn.longitude
       FROM predictions p
       JOIN sensor_nodes sn ON p.node_id = sn.id
       WHERE p.prediction = 'earthquake' 
         AND p.confidence >= $1
         AND p.created_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY p.created_at DESC`,
      [minConfidence]
    );
    return result.rows;
  }

  /**
   * Get all predictions with pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Predictions with pagination
   */
  static async findAll(options = {}) {
    const { 
      page = 1, 
      limit = 50,
      prediction = null,
      min_confidence = null,
      node_id = null
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT p.*, sn.node_id as sensor_node_id, sn.name as sensor_name
      FROM predictions p
      JOIN sensor_nodes sn ON p.node_id = sn.id
      WHERE 1=1
    `;
    let countSql = 'SELECT COUNT(*) as count FROM predictions WHERE 1=1';
    const params = [];
    const countParams = [];

    if (prediction) {
      params.push(prediction);
      countParams.push(prediction);
      sql += ` AND p.prediction = $${params.length}`;
      countSql += ` AND prediction = $${countParams.length}`;
    }

    if (min_confidence) {
      params.push(min_confidence);
      countParams.push(min_confidence);
      sql += ` AND p.confidence >= $${params.length}`;
      countSql += ` AND confidence >= $${countParams.length}`;
    }

    if (node_id) {
      params.push(node_id);
      countParams.push(node_id);
      sql += ` AND p.node_id = $${params.length}`;
      countSql += ` AND node_id = $${countParams.length}`;
    }

    sql += ' ORDER BY p.created_at DESC';
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const [predictionsResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      predictions: predictionsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Delete old predictions
   * @param {number} days - Days to retain
   * @returns {Promise<number>} Number of deleted rows
   */
  static async deleteOld(days = 90) {
    const result = await query(
      `DELETE FROM predictions 
       WHERE created_at < NOW() - INTERVAL '${days} days'`
    );
    return result.rowCount;
  }

  /**
   * Get prediction statistics
   * @param {number} days - Days to analyze
   * @returns {Promise<Object>} Statistics
   */
  static async getStatistics(days = 7) {
    const result = await query(
      `SELECT 
        COUNT(*) as total_predictions,
        COUNT(*) FILTER (WHERE prediction = 'earthquake') as earthquake_count,
        COUNT(*) FILTER (WHERE prediction = 'noise') as noise_count,
        COUNT(*) FILTER (WHERE prediction = 'unknown') as unknown_count,
        AVG(confidence) as avg_confidence,
        AVG(processing_time_ms) as avg_processing_time
       FROM predictions 
       WHERE created_at > NOW() - INTERVAL '${days} days'`
    );
    return result.rows[0];
  }

  /**
   * Get model version statistics
   * @returns {Promise<Array>} Stats per model version
   */
  static async getModelVersionStats() {
    const result = await query(
      `SELECT 
        model_version,
        COUNT(*) as prediction_count,
        AVG(confidence) as avg_confidence,
        COUNT(*) FILTER (WHERE prediction = 'earthquake') as earthquake_count
       FROM predictions 
       GROUP BY model_version
       ORDER BY prediction_count DESC`
    );
    return result.rows;
  }
}

module.exports = PredictionModel;

