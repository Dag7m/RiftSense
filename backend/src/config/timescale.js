const fs = require('fs');
const path = require('path');
// Load environment variables before requiring db.js
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
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
 * Parse SQL statements, handling DO blocks and functions with $$ delimiters
 * @param {string} sql - SQL content
 * @returns {Array<string>} Array of SQL statements
 */
function parseSQLStatements(sql) {
  const statements = [];
  let currentStatement = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let i = 0;

  // Remove single-line comments (but preserve them inside dollar-quoted strings)
  // We'll handle this more carefully in the loop

  while (i < sql.length) {
    const char = sql[i];

    // Check for dollar-quoted strings ($$, $tag$, etc.)
    if (char === '$' && !inDollarQuote) {
      // Look ahead to find the dollar tag end
      let j = i + 1;
      while (j < sql.length && sql[j] !== '$') {
        j++;
      }
      if (j < sql.length) {
        dollarTag = sql.substring(i, j + 1);
        inDollarQuote = true;
        currentStatement += dollarTag;
        i = j + 1;
        continue;
      }
    } else if (inDollarQuote && sql.substring(i, i + dollarTag.length) === dollarTag) {
      // End of dollar-quoted string
      currentStatement += dollarTag;
      i += dollarTag.length;
      inDollarQuote = false;
      dollarTag = '';
      continue;
    }

    // If we're in a dollar-quoted block, just add the character (including semicolons and comments)
    if (inDollarQuote) {
      currentStatement += char;
      i++;
      continue;
    }

    // Skip single-line comments when not in dollar quotes
    if (char === '-' && sql[i + 1] === '-') {
      // Skip to end of line
      while (i < sql.length && sql[i] !== '\n') {
        i++;
      }
      continue;
    }

    // Check for semicolon (statement terminator)
    if (char === ';') {
      currentStatement += char;
      const trimmed = currentStatement.trim();
      if (trimmed.length > 0 && !trimmed.match(/^\s*;?\s*$/)) {
        statements.push(trimmed);
      }
      currentStatement = '';
      i++;
      continue;
    }

    currentStatement += char;
    i++;
  }

  // Add any remaining statement
  const trimmed = currentStatement.trim();
  if (trimmed.length > 0 && !trimmed.match(/^\s*;?\s*$/)) {
    statements.push(trimmed);
  }

  return statements.filter(s => s.trim().length > 0);
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

      // Parse SQL statements properly handling DO blocks and functions
      const statements = parseSQLStatements(sql);

      for (const statement of statements) {
        try {
          // Skip empty statements
          if (!statement || statement.trim() === '') continue;

          await query(statement);
        } catch (error) {
          // Some statements may fail if objects already exist, that's ok
          if (!error.message.includes('already exists') &&
            !error.message.includes('does not exist') &&
            !error.message.includes('duplicate key') &&
            !error.message.includes('already a hypertable') &&
            !error.message.includes('duplicate_object')) {
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

