const fs = require('fs');
const path = require('path');
const { query, transaction } = require('./db');
const logger = require('../utils/logger');

/**
 * Initialize TimescaleDB - run migrations and set up hypertables
 */
async function initializeTimescale() {
  try {
    // Check if TimescaleDB extension exists
    const extensionCheck = await query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
      ) as exists
    `);

    if (!extensionCheck.rows[0].exists) {
      logger.info('TimescaleDB extension not found, running migrations...');
      await runMigrations();
    } else {
      logger.info('TimescaleDB extension already installed');
      
      // Check if tables exist
      const tablesCheck = await query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'sensor_data'
        ) as exists
      `);

      if (!tablesCheck.rows[0].exists) {
        logger.info('Tables not found, running migrations...');
        await runMigrations();
      } else {
        logger.info('Database schema already initialized');
      }
    }

    // Verify hypertable is set up
    await verifyHypertable();

  } catch (error) {
    logger.error('TimescaleDB initialization error:', error);
    throw error;
  }
}

/**
 * Run database migrations from SQL files
 */
async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../../migrations');
  
  try {
    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      logger.warn('Migrations directory not found, skipping migrations');
      return;
    }

    // Get all SQL files sorted by name
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      logger.warn('No migration files found');
      return;
    }

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      logger.info(`Running migration: ${file}`);
      
      // Split by statement and execute each
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        try {
          // Skip empty statements
          if (!statement || statement === '') continue;
          
          await query(statement);
        } catch (error) {
          // Some statements may fail if objects already exist, that's ok
          if (!error.message.includes('already exists') && 
              !error.message.includes('does not exist') &&
              !error.message.includes('duplicate key')) {
            logger.error(`Migration statement failed: ${statement.substring(0, 100)}...`);
            throw error;
          }
          logger.debug(`Skipped (already exists): ${statement.substring(0, 50)}...`);
        }
      }
      
      logger.info(`Migration completed: ${file}`);
    }

  } catch (error) {
    logger.error('Migration error:', error);
    throw error;
  }
}

/**
 * Verify that sensor_data is a hypertable
 */
async function verifyHypertable() {
  try {
    const result = await query(`
      SELECT * FROM timescaledb_information.hypertables 
      WHERE hypertable_name = 'sensor_data'
    `);

    if (result.rows.length > 0) {
      logger.info('sensor_data hypertable verified');
      return true;
    } else {
      logger.warn('sensor_data is not a hypertable, attempting to convert...');
      
      // Try to create hypertable
      try {
        await query(`
          SELECT create_hypertable('sensor_data', 'time', 
            if_not_exists => TRUE,
            chunk_time_interval => INTERVAL '1 day'
          )
        `);
        logger.info('sensor_data converted to hypertable');
        return true;
      } catch (error) {
        if (error.message.includes('already a hypertable')) {
          logger.info('sensor_data is already a hypertable');
          return true;
        }
        throw error;
      }
    }
  } catch (error) {
    // TimescaleDB might not be installed
    if (error.message.includes('does not exist')) {
      logger.warn('TimescaleDB views not found, extension may not be installed');
      return false;
    }
    throw error;
  }
}

/**
 * Get hypertable statistics
 */
async function getHypertableStats() {
  try {
    const result = await query(`
      SELECT 
        hypertable_name,
        num_chunks,
        compression_enabled,
        total_chunks
      FROM timescaledb_information.hypertables
      WHERE hypertable_name = 'sensor_data'
    `);
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting hypertable stats:', error);
    return null;
  }
}

/**
 * Get chunk information for sensor_data
 */
async function getChunkInfo() {
  try {
    const result = await query(`
      SELECT 
        chunk_name,
        range_start,
        range_end,
        is_compressed
      FROM timescaledb_information.chunks
      WHERE hypertable_name = 'sensor_data'
      ORDER BY range_start DESC
      LIMIT 10
    `);
    
    return result.rows;
  } catch (error) {
    logger.error('Error getting chunk info:', error);
    return [];
  }
}

// If run directly, execute migrations
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  
  const { testConnection } = require('./db');
  
  (async () => {
    try {
      await testConnection();
      await runMigrations();
      await verifyHypertable();
      console.log('Migrations completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  initializeTimescale,
  runMigrations,
  verifyHypertable,
  getHypertableStats,
  getChunkInfo
};

