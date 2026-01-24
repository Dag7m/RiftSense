const { query } = require('../config/db');

/**
 * Admin Log Model - Database operations for audit trail
 */
class AdminLogModel {
  
  /**
   * Create an admin log entry
   * @param {Object} logData - Log data
   * @returns {Promise<Object>} Created log entry
   */
  static async create(logData) {
    const {
      admin_id,
      action,
      resource_type,
      resource_id = null,
      details = null,
      ip_address = null
    } = logData;

    const result = await query(
      `INSERT INTO admin_logs 
        (admin_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [admin_id, action, resource_type, resource_id, 
       details ? JSON.stringify(details) : null, ip_address]
    );

    return result.rows[0];
  }

  /**
   * Find log entry by ID
   * @param {string} id - Log UUID
   * @returns {Promise<Object|null>} Log entry or null
   */
  static async findById(id) {
    const result = await query(
      `SELECT al.*, u.email as admin_email, u.name as admin_name
       FROM admin_logs al
       LEFT JOIN users u ON al.admin_id = u.id
       WHERE al.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all logs with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Logs with pagination
   */
  static async findAll(options = {}) {
    const { 
      page = 1, 
      limit = 50,
      admin_id = null,
      action = null,
      resource_type = null,
      start_date = null,
      end_date = null
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT al.*, u.email as admin_email, u.name as admin_name
      FROM admin_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      WHERE 1=1
    `;
    let countSql = 'SELECT COUNT(*) as count FROM admin_logs WHERE 1=1';
    const params = [];
    const countParams = [];

    if (admin_id) {
      params.push(admin_id);
      countParams.push(admin_id);
      sql += ` AND al.admin_id = $${params.length}`;
      countSql += ` AND admin_id = $${countParams.length}`;
    }

    if (action) {
      params.push(action);
      countParams.push(action);
      sql += ` AND al.action = $${params.length}`;
      countSql += ` AND action = $${countParams.length}`;
    }

    if (resource_type) {
      params.push(resource_type);
      countParams.push(resource_type);
      sql += ` AND al.resource_type = $${params.length}`;
      countSql += ` AND resource_type = $${countParams.length}`;
    }

    if (start_date) {
      params.push(start_date);
      countParams.push(start_date);
      sql += ` AND al.created_at >= $${params.length}`;
      countSql += ` AND created_at >= $${countParams.length}`;
    }

    if (end_date) {
      params.push(end_date);
      countParams.push(end_date);
      sql += ` AND al.created_at <= $${params.length}`;
      countSql += ` AND created_at <= $${countParams.length}`;
    }

    sql += ' ORDER BY al.created_at DESC';
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const [logsResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      logs: logsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get logs for a specific admin
   * @param {string} adminId - Admin UUID
   * @param {number} limit - Maximum logs
   * @returns {Promise<Array>} Logs
   */
  static async findByAdminId(adminId, limit = 100) {
    const result = await query(
      `SELECT * FROM admin_logs 
       WHERE admin_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [adminId, limit]
    );
    return result.rows;
  }

  /**
   * Get logs for a specific resource
   * @param {string} resourceType - Resource type
   * @param {string} resourceId - Resource UUID
   * @returns {Promise<Array>} Logs
   */
  static async findByResource(resourceType, resourceId) {
    const result = await query(
      `SELECT al.*, u.email as admin_email, u.name as admin_name
       FROM admin_logs al
       LEFT JOIN users u ON al.admin_id = u.id
       WHERE al.resource_type = $1 AND al.resource_id = $2
       ORDER BY al.created_at DESC`,
      [resourceType, resourceId]
    );
    return result.rows;
  }

  /**
   * Get recent activity
   * @param {number} hours - Hours to look back
   * @param {number} limit - Maximum logs
   * @returns {Promise<Array>} Recent logs
   */
  static async findRecent(hours = 24, limit = 100) {
    const result = await query(
      `SELECT al.*, u.email as admin_email, u.name as admin_name
       FROM admin_logs al
       LEFT JOIN users u ON al.admin_id = u.id
       WHERE al.created_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY al.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Delete old logs
   * @param {number} days - Days to retain
   * @returns {Promise<number>} Number of deleted rows
   */
  static async deleteOld(days = 365) {
    const result = await query(
      `DELETE FROM admin_logs 
       WHERE created_at < NOW() - INTERVAL '${days} days'`
    );
    return result.rowCount;
  }

  /**
   * Get action statistics
   * @param {number} days - Days to analyze
   * @returns {Promise<Array>} Action counts
   */
  static async getActionStats(days = 30) {
    const result = await query(
      `SELECT 
        action,
        resource_type,
        COUNT(*) as count
       FROM admin_logs 
       WHERE created_at > NOW() - INTERVAL '${days} days'
       GROUP BY action, resource_type
       ORDER BY count DESC`
    );
    return result.rows;
  }
}

module.exports = AdminLogModel;

