const { verifyToken } = require('../config/jwt');
const UserModel = require('../models/user.model');
const logger = require('../utils/logger');

/**
 * Authentication Middleware
 * 
 * Verifies JWT tokens and attaches user to request.
 */

/**
 * Authenticate user - required for protected routes
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
async function authenticate(req, res, next) {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'No authorization token provided'
            });
        }

        // Check format: "Bearer <token>"
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                success: false,
                error: 'Invalid authorization format. Use: Bearer <token>'
            });
        }

        const token = parts[1];

        // Verify token
        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }

        // Get user from database
        const user = await UserModel.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'User account is deactivated'
            });
        }

        // Attach user to request
        req.user = user;
        req.token = token;

        next();
    } catch (error) {
        logger.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
}

/**
 * Optional authentication - continues even without token
 * Useful for endpoints that behave differently for authenticated users
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            req.user = null;
            return next();
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            req.user = null;
            return next();
        }

        const token = parts[1];
        const decoded = verifyToken(token);

        if (decoded) {
            const user = await UserModel.findById(decoded.id);
            if (user && user.is_active) {
                req.user = user;
                req.token = token;
            } else {
                req.user = null;
            }
        } else {
            req.user = null;
        }

        next();
    } catch (error) {
        // Don't fail on optional auth errors
        req.user = null;
        next();
    }
}

/**
 * Require admin role
 * Must be used after authenticate middleware
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Admin access required'
        });
    }

    next();
}

/**
 * Require specific roles
 * Must be used after authenticate middleware
 * @param {Array} roles - Allowed roles
 * @returns {Function} Middleware function
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Required role: ${roles.join(' or ')}`
            });
        }

        next();
    };
}

/**
 * Rate limiting for sensor data ingestion
 * Simple in-memory rate limiting (use Redis in production for distributed systems)
 */
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 1000; // Max requests per node per minute

function sensorRateLimit(req, res, next) {
    const nodeId = req.body.node_id;

    if (!nodeId) {
        return next();
    }

    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    // Get or create rate limit entry
    if (!rateLimitStore.has(nodeId)) {
        rateLimitStore.set(nodeId, []);
    }

    const requests = rateLimitStore.get(nodeId);

    // Remove old requests outside window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);

    if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
        logger.warn(`Rate limit exceeded for node: ${nodeId}`);
        return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Too many requests from this sensor node.'
        });
    }

    validRequests.push(now);
    rateLimitStore.set(nodeId, validRequests);

    next();
}

// Clean up old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    for (const [nodeId, requests] of rateLimitStore.entries()) {
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        if (validRequests.length === 0) {
            rateLimitStore.delete(nodeId);
        } else {
            rateLimitStore.set(nodeId, validRequests);
        }
    }
}, RATE_LIMIT_WINDOW);

module.exports = {
    authenticate,
    optionalAuth,
    requireAdmin,
    requireRole,
    sensorRateLimit
};

