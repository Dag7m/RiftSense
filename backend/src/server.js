require('dotenv').config();

const app = require('./app');
const { pool, testConnection } = require('./config/db');
const { initializeTimescale } = require('./config/timescale');
const logger = require('./utils/logger');


const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    await testConnection();
    logger.info('Database connection established');

    // Initialize TimescaleDB (create extension and hypertables if needed)
    await initializeTimescale();
    logger.info('TimescaleDB initialized');

    // Start the server
    app.listen(PORT, () => {
      logger.info(`Seismic Sensor Backend running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

startServer();

