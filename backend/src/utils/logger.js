const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan'
};

winston.addColors(colors);

// Define format for console
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${
      info.splat !== undefined ? ` ${JSON.stringify(info.splat)}` : ''
    }${
      Object.keys(info).filter(key => !['timestamp', 'level', 'message', 'splat'].includes(key)).length > 0
        ? ` ${JSON.stringify(Object.fromEntries(
            Object.entries(info).filter(([key]) => !['timestamp', 'level', 'message', 'splat'].includes(key))
          ))}`
        : ''
    }`
  )
);

// Define format for file
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat
  })
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  transports.push(
    // Error log file
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  transports
});

// Export logger with convenience methods
module.exports = logger;

// Also export as named exports for consistency
module.exports.error = (message, meta = {}) => logger.error(message, meta);
module.exports.warn = (message, meta = {}) => logger.warn(message, meta);
module.exports.info = (message, meta = {}) => logger.info(message, meta);
module.exports.http = (message, meta = {}) => logger.http(message, meta);
module.exports.debug = (message, meta = {}) => logger.debug(message, meta);

