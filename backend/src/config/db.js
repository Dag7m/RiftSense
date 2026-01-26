const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database connection pool configuration
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'seismic_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postash',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection not established
};

const pool = new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err) => {
  logger.error('Unexpected database pool error:', err);
});

pool.on('connect', () => {
  logger.debug('New database client connected');
});

/**
 * Test database connection with retry logic
 * @param {number} retries - Number of retry attempts
 * @param {number} delay - Delay between retries in ms
 */
async function testConnection(retries = 5, delay = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as now');
      client.release();
      logger.info(`Database connected at ${result.rows[0].now}`);
      return true;
    } catch (error) {
      logger.error(`Database connection attempt ${attempt}/${retries} failed:`, error.message);
      if (attempt === retries) {
        throw new Error(`Failed to connect to database after ${retries} attempts`);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Execute a query with optional parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    // Log full query for debugging (truncate only if very long)
    const queryText = text.length > 200 ? text.substring(0, 200) + '...' : text;
    logger.debug('Executed query', { text: queryText, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    // Log full query on error for debugging
    logger.error('Query error:', { text: text, params, error: error.message });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<PoolClient>} Database client
 */
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);
  
  // Track query time
  client.query = async (...args) => {
    const start = Date.now();
    try {
      return await originalQuery(...args);
    } finally {
      const duration = Date.now() - start;
      logger.debug('Transaction query', { duration });
    }
  };
  
  // Ensure client is released
  client.release = () => {
    client.query = originalQuery;
    client.release = originalRelease;
    return originalRelease();
  };
  
  return client;
}

/**
 * Execute a transaction with automatic rollback on error
 * @param {Function} callback - Async function receiving the client
 * @returns {Promise<any>} Result of the callback
 */
async function transaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  testConnection
};

