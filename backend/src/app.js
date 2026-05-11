const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const sensorRoutes = require('./routes/sensor.routes');
const eventRoutes = require('./routes/event.routes');
const feltRoutes = require('./routes/felt.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');



const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const logger = require('./utils/logger');

const app = express();

// Security middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

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

//swagger

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger-output.json');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API Routes
app.use('/api/sensors', sensorRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/felt', feltRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

