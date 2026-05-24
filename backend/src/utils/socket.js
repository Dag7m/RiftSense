const { Server } = require('socket.io');
const logger = require('./logger');

let io;

/**
 * Initialize Socket.io
 * @param {Object} httpServer - Node.js HTTP server 
 */
function init(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    logger.info(`New client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });

    // Handle joining specific sensor rooms
    socket.on('subscribe', (node_id) => {
      socket.join(`sensor:${node_id}`);
      logger.debug(`Client ${socket.id} subscribed to sensor: ${node_id}`);
    });

    socket.on('unsubscribe', (node_id) => {
      socket.leave(`sensor:${node_id}`);
      logger.debug(`Client ${socket.id} unsubscribed from sensor: ${node_id}`);
    });
  });

  return io;
}

/**
 * Get Socket.io instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}

/**
 * Emit sensor data to subscribers
 * @param {string} node_id - Sensor node ID
 * @param {Object} data - Sensor data
 */
function emitSensorData(node_id, data) {
  if (io) {
    io.emit('sensor_data_all', data); // Broadcast to everyone for overview
    io.to(`sensor:${node_id}`).emit('sensor_data', data); // Broadcast to specific room
  }
}

/**
 * Emit seismic event alert
 * @param {Object} event - Event details
 */
function emitSeismicEvent(event) {
  if (io) {
    io.emit('seismic_event', event);
  }
}

module.exports = {
  init,
  getIO,
  emitSensorData,
  emitSeismicEvent
};
