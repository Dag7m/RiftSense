const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const sensorRoutes = require('./routes/sensor.routes');
const eventRoutes = require('./routes/event.routes');
const feltRoutes = require('./routes/felt.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const locationRoutes = require('./routes/location.routes');
const notificationRoutes = require('./routes/notification.routes');
const pushRoutes = require('./routes/push.routes');

const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const { generalApiLimiter } = require('./middlewares/rateLimit.middleware');
const logger = require('./utils/logger');

const app = express();

// JSON APIs should always return a body; default ETags cause 304 + empty responses in browsers.
app.set('etag', false);

// Security middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));

// Rate limiting (relaxed in development; see rateLimit.middleware.js)
app.use('/api/', generalApiLimiter);

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Seismic Sensor Backend is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/sensors', sensorRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/felt', feltRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

