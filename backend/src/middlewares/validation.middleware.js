const { formatErrors } = require('../utils/validators');
const logger = require('../utils/logger');

/**
 * Validation Middleware Factory
 * 
 * Creates middleware that validates request data against Joi schemas.
 */

/**
 * Create validation middleware for request body
 * @param {Object} schema - Joi schema
 * @returns {Function} Express middleware
 */
function validateBody(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = formatErrors(error);
            logger.debug('Validation error:', { errors, body: req.body });

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }

        // Replace body with validated/sanitized value
        req.body = value;
        next();
    };
}

/**
 * Create validation middleware for query parameters
 * @param {Object} schema - Joi schema
 * @returns {Function} Express middleware
 */
function validateQuery(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = formatErrors(error);
            logger.debug('Query validation error:', { errors, query: req.query });

            return res.status(400).json({
                success: false,
                error: 'Invalid query parameters',
                details: errors
            });
        }

        // Replace query with validated/sanitized value
        req.query = value;
        next();
    };
}

/**
 * Create validation middleware for URL parameters
 * @param {Object} schema - Joi schema
 * @returns {Function} Express middleware
 */
function validateParams(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.params, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = formatErrors(error);
            logger.debug('Params validation error:', { errors, params: req.params });

            return res.status(400).json({
                success: false,
                error: 'Invalid URL parameters',
                details: errors
            });
        }

        req.params = value;
        next();
    };
}

/**
 * Validate UUID parameter
 * @param {string} paramName - Name of the URL parameter
 * @returns {Function} Express middleware
 */
function validateUUID(paramName = 'id') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    return (req, res, next) => {
        const value = req.params[paramName];

        if (!value || !uuidRegex.test(value)) {
            return res.status(400).json({
                success: false,
                error: `Invalid ${paramName} format. Expected UUID.`
            });
        }

        next();
    };
}

/**
 * Validate latitude and longitude in query or body
 * @param {string} source - 'query' or 'body'
 * @returns {Function} Express middleware
 */
function validateCoordinates(source = 'query') {
    return (req, res, next) => {
        const data = source === 'query' ? req.query : req.body;
        const lat = parseFloat(data.latitude || data.lat);
        const lon = parseFloat(data.longitude || data.lon);

        if (isNaN(lat) || lat < -90 || lat > 90) {
            return res.status(400).json({
                success: false,
                error: 'Invalid latitude. Must be between -90 and 90.'
            });
        }

        if (isNaN(lon) || lon < -180 || lon > 180) {
            return res.status(400).json({
                success: false,
                error: 'Invalid longitude. Must be between -180 and 180.'
            });
        }

        next();
    };
}

/**
 * Sanitize request body strings (basic XSS prevention)
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
function sanitizeBody(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    next();
}

/**
 * Recursively sanitize object values
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj) {
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
    }

    if (typeof obj === 'string') {
        return obj
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .trim();
    }

    return obj;
}

module.exports = {
    validateBody,
    validateQuery,
    validateParams,
    validateUUID,
    validateCoordinates,
    sanitizeBody
};

