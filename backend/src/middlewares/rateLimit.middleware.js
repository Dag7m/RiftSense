const rateLimit = require('express-rate-limit');

const isProduction = process.env.NODE_ENV === 'production';

/** Dev: off unless RATE_LIMIT_IN_DEV=true. Prod: on. */
function skipInDevelopment() {
  return !isProduction && process.env.RATE_LIMIT_IN_DEV !== 'true';
}

const tooManyRequests = {
  success: false,
  error: 'Too many requests, please try again later.',
};

/**
 * Broad limit for all /api routes (reads, auth, admin UI polling).
 * Default 500 / 15 min in production; disabled in development.
 */
const generalApiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max:
    parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) ||
    (isProduction ? 500 : 5000),
  skip: skipInDevelopment,
  message: tooManyRequests,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter cap on felt-report submissions (spam protection).
 * Default 30 / hour per IP in production; disabled in development.
 */
const feltReportLimiter = rateLimit({
  windowMs:
    parseInt(process.env.FELT_RATE_LIMIT_WINDOW_MS, 10) || 60 * 60 * 1000,
  max: parseInt(process.env.FELT_RATE_LIMIT_MAX, 10) || 30,
  skip: skipInDevelopment,
  message: {
    success: false,
    error:
      'Too many felt reports from this device. Please wait before submitting again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalApiLimiter,
  feltReportLimiter,
};
