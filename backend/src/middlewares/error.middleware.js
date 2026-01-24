const logger = require('../utils/logger');

/**
 * Error Handling Middleware
 * 
 * Centralized error handling for consistent error responses.
 */

/**
 * Custom application error class
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Common error types
 */
const ErrorTypes = {
    VALIDATION: (message) => new AppError(message, 400, 'VALIDATION_ERROR'),
    NOT_FOUND: (resource) => new AppError(`${resource} not found`, 404, 'NOT_FOUND'),
    UNAUTHORIZED: (message = 'Unauthorized') => new AppError(message, 401, 'UNAUTHORIZED'),
    FORBIDDEN: (message = 'Forbidden') => new AppError(message, 403, 'FORBIDDEN'),
    CONFLICT: (message) => new AppError(message, 409, 'CONFLICT'),
    RATE_LIMIT: () => new AppError('Too many requests', 429, 'RATE_LIMIT'),
    INTERNAL: (message = 'Internal server error') => new AppError(message, 500, 'INTERNAL_ERROR')
};

/**
 * Handle 404 Not Found
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
function notFoundHandler(req, res, next) {
    const error = new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND');
    next(error);
}

/**
 * Global error handler
 * @param {Error} err - Error object
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
function errorHandler(err, req, res, next) {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';
    let code = err.code || 'INTERNAL_ERROR';

    // Log error
    if (statusCode >= 500) {
        logger.error('Server error:', {
            message: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            ip: req.ip
        });
    } else {
        logger.warn('Client error:', {
            message: err.message,
            code,
            path: req.path,
            method: req.method
        });
    }

    // Handle specific error types

    // PostgreSQL errors
    if (err.code === '23505') {
        // Unique constraint violation
        statusCode = 409;
        code = 'DUPLICATE_ENTRY';
        message = 'A record with this value already exists';
    } else if (err.code === '23503') {
        // Foreign key violation
        statusCode = 400;
        code = 'REFERENCE_ERROR';
        message = 'Referenced record does not exist';
    } else if (err.code === '22P02') {
        // Invalid text representation (e.g., invalid UUID)
        statusCode = 400;
        code = 'INVALID_FORMAT';
        message = 'Invalid data format';
    } else if (err.code === 'ECONNREFUSED') {
        // Database connection error
        statusCode = 503;
        code = 'DATABASE_UNAVAILABLE';
        message = 'Database service unavailable';
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        code = 'INVALID_TOKEN';
        message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        code = 'TOKEN_EXPIRED';
        message = 'Token has expired';
    }

    // Validation errors (Joi)
    if (err.isJoi) {
        statusCode = 400;
        code = 'VALIDATION_ERROR';
        message = err.details.map(d => d.message).join(', ');
    }

    // Syntax error in JSON body
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        statusCode = 400;
        code = 'INVALID_JSON';
        message = 'Invalid JSON in request body';
    }

    // Send response
    const response = {
        success: false,
        error: message,
        code
    };

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
}

/**
 * Async handler wrapper - catches async errors
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped function
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    AppError,
    ErrorTypes,
    notFoundHandler,
    errorHandler,
    asyncHandler
};

