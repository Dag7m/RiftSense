const Joi = require('joi');

/**
 * Validation Schemas and Utilities
 * 
 * Centralized validation schemas using Joi for request validation.
 */

// Common validation patterns
const patterns = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  nodeId: /^[a-zA-Z0-9_-]{3,100}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};

// ========================================
// Sensor Data Schemas
// ========================================

const sensorDataSchema = Joi.object({
  node_id: Joi.string().pattern(patterns.nodeId).required()
    .messages({ 'string.pattern.base': 'Invalid node_id format' }),
  x: Joi.number().required().min(-100).max(100),
  y: Joi.number().required().min(-100).max(100),
  z: Joi.number().required().min(-100).max(100),
  sampling_rate: Joi.number().integer().min(1).max(1000).default(100),
  timestamp: Joi.date().iso().default(() => new Date())
});

const sensorDataBatchSchema = Joi.object({
  node_id: Joi.string().pattern(patterns.nodeId).required(),
  data: Joi.array().items(
    Joi.object({
      x: Joi.number().required().min(-100).max(100),
      y: Joi.number().required().min(-100).max(100),
      z: Joi.number().required().min(-100).max(100),
      timestamp: Joi.date().iso().required()
    })
  ).min(1).max(1000).required(),
  sampling_rate: Joi.number().integer().min(1).max(1000).default(100)
});

const heartbeatSchema = Joi.object({
  node_id: Joi.string().pattern(patterns.nodeId).required(),
  status: Joi.string().valid('active', 'maintenance').optional(),
  battery_level: Joi.number().integer().min(0).max(100).optional(),
  firmware_version: Joi.string().max(50).optional()
});

// ========================================
// Sensor Node Schemas
// ========================================

const sensorNodeCreateSchema = Joi.object({
  node_id: Joi.string().pattern(patterns.nodeId).required()
    .messages({ 'string.pattern.base': 'node_id must be 3-100 alphanumeric characters, dashes, or underscores' }),
  name: Joi.string().min(1).max(255).required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  elevation: Joi.number().min(-500).max(10000).optional(),
  status: Joi.string().valid('active', 'inactive', 'maintenance').default('active'),
  firmware_version: Joi.string().max(50).optional()
});

const sensorNodeUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  elevation: Joi.number().min(-500).max(10000).optional(),
  status: Joi.string().valid('active', 'inactive', 'maintenance').optional(),
  firmware_version: Joi.string().max(50).optional()
}).min(1);

// ========================================
// Event Schemas
// ========================================

const eventUpdateSchema = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'false_positive').optional(),
  event_type: Joi.string().valid('earthquake', 'noise', 'unknown').optional(),
  description: Joi.string().max(1000).optional()
}).min(1);

const eventQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('pending', 'confirmed', 'false_positive').optional(),
  event_type: Joi.string().valid('earthquake', 'noise', 'unknown').optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
  min_confidence: Joi.number().min(0).max(1).optional()
});

// ========================================
// Felt Report Schemas
// ========================================

const feltReportSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  intensity: Joi.number().integer().min(1).max(10).required()
    .messages({ 'number.min': 'Intensity must be between 1 and 10 (Modified Mercalli scale)' }),
  description: Joi.string().max(1000).optional(),
  is_anonymous: Joi.boolean().default(false),
  reported_at: Joi.date().iso().default(() => new Date())
});

const feltNearbyQuerySchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lon: Joi.number().min(-180).max(180).required(),
  radius: Joi.number().min(1).max(500).default(50),
  hours: Joi.number().min(1).max(168).default(24)
});

// ========================================
// Auth Schemas
// ========================================

const registerSchema = Joi.object({
  email: Joi.string().email().required().max(255),
  password: Joi.string().min(8).max(128).required()
    .messages({ 'string.min': 'Password must be at least 8 characters' }),
  name: Joi.string().min(1).max(255).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// ========================================
// Admin Schemas
// ========================================

const adminStatsQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30)
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

// ========================================
// Validation Utility Functions
// ========================================

/**
 * Validate data against a schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - Joi schema
 * @returns {Object} { error, value }
 */
function validate(data, schema) {
  return schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
}

/**
 * Format Joi validation errors into readable messages
 * @param {Object} error - Joi error object
 * @returns {Array} Array of error messages
 */
function formatErrors(error) {
  if (!error || !error.details) {
    return ['Validation error'];
  }
  
  return error.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message.replace(/"/g, "'")
  }));
}

/**
 * Validate UUID format
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid
 */
function isValidUUID(uuid) {
  return patterns.uuid.test(uuid);
}

/**
 * Validate email format
 * @param {string} email - Email string to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  return patterns.email.test(email);
}

/**
 * Sanitize string input (basic XSS prevention)
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
function sanitizeString(input) {
  if (typeof input !== 'string') {
    return input;
  }
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

module.exports = {
  // Schemas
  sensorDataSchema,
  sensorDataBatchSchema,
  heartbeatSchema,
  sensorNodeCreateSchema,
  sensorNodeUpdateSchema,
  eventUpdateSchema,
  eventQuerySchema,
  feltReportSchema,
  feltNearbyQuerySchema,
  registerSchema,
  loginSchema,
  adminStatsQuerySchema,
  paginationSchema,
  
  // Functions
  validate,
  formatErrors,
  isValidUUID,
  isValidEmail,
  sanitizeString,
  
  // Patterns
  patterns
};

