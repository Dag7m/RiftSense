const { query, transaction } = require('../config/db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const SALT_ROUNDS = 10;

/**
 * User Model - Database operations for users (including admins)
 */
class UserModel {
  
  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user (without password)
   */
  static async create(userData) {
    const {
      email,
      password,
      name = null,
      role = 'user'
    } = userData;

    // Hash the password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, is_active, created_at, updated_at`,
      [email, password_hash, name, role]
    );

    return result.rows[0];
  }

  /**
   * Find a user by ID
   * @param {string} id - User UUID
   * @returns {Promise<Object|null>} User (without password)
   */
  static async findById(id) {
    const result = await query(
      `SELECT id, email, name, role, is_active, last_login, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find a user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User (without password)
   */
  static async findByEmail(email) {
    const result = await query(
      `SELECT id, email, name, role, is_active, last_login, created_at, updated_at
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  /**
   * Find a user by email with password hash (for authentication)
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User with password hash
   */
  static async findByEmailWithPassword(email) {
    const result = await query(
      `SELECT id, email, password_hash, name, role, is_active, last_login
       FROM users WHERE email = $1 AND is_active = true`,
      [email.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  /**
   * Verify user password
   * @param {string} email - User email
   * @param {string} password - Plain text password
   * @returns {Promise<Object|null>} User if password matches, null otherwise
   */
  static async verifyPassword(email, password) {
    const user = await this.findByEmailWithPassword(email);
    
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return null;
    }

    // Update last login
    await this.updateLastLogin(user.id);

    // Remove password hash from return
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Update last login timestamp
   * @param {string} id - User UUID
   * @returns {Promise<void>}
   */
  static async updateLastLogin(id) {
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [id]
    );
  }

  /**
   * Get all users with pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Users with pagination
   */
  static async findAll(options = {}) {
    const { page = 1, limit = 20, role = null } = options;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT id, email, name, role, is_active, last_login, created_at, updated_at
      FROM users WHERE 1=1
    `;
    let countSql = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
    const params = [];
    const countParams = [];

    if (role) {
      params.push(role);
      countParams.push(role);
      sql += ` AND role = $${params.length}`;
      countSql += ` AND role = $${countParams.length}`;
    }

    sql += ' ORDER BY created_at DESC';
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const [usersResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      users: usersResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Update a user
   * @param {string} id - User UUID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated user
   */
  static async update(id, updateData) {
    const allowedFields = ['name', 'role', 'is_active'];
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
      `UPDATE users 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING id, email, name, role, is_active, last_login, created_at, updated_at`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Update user password
   * @param {string} id - User UUID
   * @param {string} newPassword - New plain text password
   * @returns {Promise<boolean>} Success status
   */
  static async updatePassword(id, newPassword) {
    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    const result = await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id',
      [password_hash, id]
    );
    
    return result.rowCount > 0;
  }

  /**
   * Deactivate a user (soft delete)
   * @param {string} id - User UUID
   * @returns {Promise<Object|null>} Deactivated user
   */
  static async deactivate(id) {
    const result = await query(
      `UPDATE users SET is_active = false WHERE id = $1 
       RETURNING id, email, name, role, is_active`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a user permanently
   * @param {string} id - User UUID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @returns {Promise<boolean>} True if exists
   */
  static async emailExists(email) {
    const result = await query(
      'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) as exists',
      [email.toLowerCase()]
    );
    return result.rows[0].exists;
  }

  /**
   * Get user count
   * @param {Object} filters - Optional filters
   * @returns {Promise<number>} Count
   */
  static async count(filters = {}) {
    let sql = 'SELECT COUNT(*) as count FROM users';
    const params = [];

    if (filters.role) {
      params.push(filters.role);
      sql += ` WHERE role = $${params.length}`;
    }

    const result = await query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get admin users
   * @returns {Promise<Array>} Admin users
   */
  static async findAdmins() {
    const result = await query(
      `SELECT id, email, name, role, is_active, last_login, created_at
       FROM users WHERE role = 'admin' AND is_active = true
       ORDER BY created_at ASC`
    );
    return result.rows;
  }
}

module.exports = UserModel;

