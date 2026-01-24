const SensorDataModel = require('../models/sensorData.model');
const SensorNodeModel = require('../models/sensorNode.model');
const PredictionModel = require('../models/prediction.model');
const EventModel = require('../models/event.model');
const mlClient = require('../utils/mlClient');
const staLta = require('../utils/staLta');
const logger = require('../utils/logger');
const { isValidUUID } = require('../utils/validators');

/**
 * Sensor Controller
 * 
 * Handles sensor data ingestion and node management.
 */

// Event detection thresholds
const EVENT_CONFIDENCE_THRESHOLD = parseFloat(process.env.EVENT_CONFIDENCE_THRESHOLD) || 0.7;
const STA_LTA_THRESHOLD = parseFloat(process.env.STA_LTA_THRESHOLD) || 3.0;
const EVENT_TIME_WINDOW_MS = parseInt(process.env.EVENT_TIME_WINDOW_MS) || 60000;

/**
 * Ingest sensor data from ESP32 node
 * POST /api/sensors/data
 */
async function ingestData(req, res) {
  try {
    const { node_id, x, y, z, sampling_rate, timestamp } = req.body;

    // Find or validate the sensor node
    const node = await SensorNodeModel.findByNodeId(node_id);
    
    if (!node) {
      return res.status(404).json({
        success: false,
        error: `Sensor node '${node_id}' not registered`
      });
    }

    if (node.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Sensor node '${node_id}' is not active (status: ${node.status})`
      });
    }

    // Insert sensor data
    const sensorData = await SensorDataModel.insert({
      node_id: node.id,
      x_axis: x,
      y_axis: y,
      z_axis: z,
      sampling_rate: sampling_rate || 100,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    // Update node heartbeat
    await SensorNodeModel.updateHeartbeat(node_id);

    // Get recent data for analysis
    const recentData = await SensorDataModel.getRecent(node.id, { minutes: 1, limit: 500 });

    // Perform quick STA/LTA detection if we have enough data
    let detectionResult = null;
    if (recentData.length >= 100) {
      const magnitudes = recentData.map(d => parseFloat(d.magnitude));
      const staLtaResult = staLta.quickDetect(magnitudes, { triggerThreshold: STA_LTA_THRESHOLD });
      
      if (staLtaResult.triggered) {
        // Run ML prediction
        const features = mlClient.extractFeatures(recentData);
        features.sta_lta_ratio = staLtaResult.ratio;
        
        const prediction = await mlClient.predict({ features });
        
        // Store prediction
        const storedPrediction = await PredictionModel.create({
          node_id: node.id,
          data_segment_start: recentData[recentData.length - 1].time,
          data_segment_end: recentData[0].time,
          prediction: prediction.prediction,
          confidence: prediction.confidence,
          features: features,
          processing_time_ms: prediction.processing_time_ms
        });

        // If earthquake with high confidence, create or update event
        if (prediction.prediction === 'earthquake' && prediction.confidence >= EVENT_CONFIDENCE_THRESHOLD) {
          await handleEarthquakeDetection(node, recentData, prediction, staLtaResult);
        }

        detectionResult = {
          sta_lta_triggered: true,
          sta_lta_ratio: staLtaResult.ratio,
          prediction: prediction.prediction,
          confidence: prediction.confidence
        };

        logger.info(`Detection alert from node ${node_id}:`, detectionResult);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        time: sensorData.time,
        magnitude: sensorData.magnitude,
        detection: detectionResult
      }
    });
  } catch (error) {
    logger.error('Error ingesting sensor data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ingest sensor data'
    });
  }
}

/**
 * Ingest batch sensor data
 * POST /api/sensors/data/batch
 */
async function ingestBatchData(req, res) {
  try {
    const { node_id, data, sampling_rate } = req.body;

    // Find or validate the sensor node
    const node = await SensorNodeModel.findByNodeId(node_id);
    
    if (!node) {
      return res.status(404).json({
        success: false,
        error: `Sensor node '${node_id}' not registered`
      });
    }

    if (node.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Sensor node '${node_id}' is not active`
      });
    }

    // Prepare batch data
    const batchData = data.map(point => ({
      node_id: node.id,
      x_axis: point.x,
      y_axis: point.y,
      z_axis: point.z,
      sampling_rate: sampling_rate || 100,
      timestamp: new Date(point.timestamp)
    }));

    // Insert batch
    const insertedCount = await SensorDataModel.insertBatch(batchData);

    // Update node heartbeat
    await SensorNodeModel.updateHeartbeat(node_id);

    // Analyze batch for events
    const magnitudes = batchData.map(d => Math.sqrt(d.x_axis ** 2 + d.y_axis ** 2 + d.z_axis ** 2));
    const staLtaResult = staLta.quickDetect(magnitudes, { triggerThreshold: STA_LTA_THRESHOLD });

    let detectionResult = null;
    if (staLtaResult.triggered) {
      const features = {
        magnitude: Math.max(...magnitudes),
        avg_magnitude: magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length,
        sta_lta_ratio: staLtaResult.ratio,
        sample_count: magnitudes.length
      };

      const prediction = await mlClient.predict({ features });
      
      detectionResult = {
        sta_lta_triggered: true,
        sta_lta_ratio: staLtaResult.ratio,
        prediction: prediction.prediction,
        confidence: prediction.confidence
      };

      // Store prediction
      await PredictionModel.create({
        node_id: node.id,
        data_segment_start: batchData[0].timestamp,
        data_segment_end: batchData[batchData.length - 1].timestamp,
        prediction: prediction.prediction,
        confidence: prediction.confidence,
        features: features
      });

      logger.info(`Batch detection alert from node ${node_id}:`, detectionResult);
    }

    res.status(201).json({
      success: true,
      data: {
        inserted_count: insertedCount,
        detection: detectionResult
      }
    });
  } catch (error) {
    logger.error('Error ingesting batch sensor data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ingest batch sensor data'
    });
  }
}

/**
 * Handle earthquake detection - create or update event
 */
async function handleEarthquakeDetection(node, sensorData, prediction, staLtaResult) {
  try {
    // Check for existing recent event
    const recentEvents = await EventModel.findNearby(
      node.latitude,
      node.longitude,
      50, // 50km radius
      1   // Last hour
    );

    const pendingEvent = recentEvents.find(e => e.status === 'pending');

    if (pendingEvent) {
      // Add detection to existing event
      await EventModel.addDetection({
        event_id: pendingEvent.id,
        node_id: node.id,
        detection_time: new Date(),
        peak_acceleration: prediction.details?.input_magnitude || 0,
        sta_lta_ratio: staLtaResult.ratio
      });

      // Update event confidence (average of detections)
      const newConfidence = (pendingEvent.confidence + prediction.confidence) / 2;
      await EventModel.update(pendingEvent.id, { confidence: newConfidence });

      logger.info(`Added detection to existing event ${pendingEvent.id}`);
    } else {
      // Create new event
      const newEvent = await EventModel.create({
        event_type: 'earthquake',
        confidence: prediction.confidence,
        latitude: node.latitude,
        longitude: node.longitude,
        detected_at: new Date(),
        status: 'pending'
      });

      // Add first detection
      await EventModel.addDetection({
        event_id: newEvent.id,
        node_id: node.id,
        detection_time: new Date(),
        peak_acceleration: prediction.details?.input_magnitude || 0,
        sta_lta_ratio: staLtaResult.ratio
      });

      logger.info(`Created new earthquake event ${newEvent.id}`);
    }
  } catch (error) {
    logger.error('Error handling earthquake detection:', error);
  }
}

/**
 * Receive heartbeat from sensor node
 * POST /api/sensors/heartbeat
 */
async function heartbeat(req, res) {
  try {
    const { node_id, status, battery_level, firmware_version } = req.body;

    const node = await SensorNodeModel.updateHeartbeat(node_id, {
      battery_level,
      status: status === 'maintenance' ? 'maintenance' : undefined
    });

    if (!node) {
      return res.status(404).json({
        success: false,
        error: `Sensor node '${node_id}' not registered`
      });
    }

    res.json({
      success: true,
      message: 'Heartbeat received',
      data: {
        node_id: node.node_id,
        status: node.status,
        last_heartbeat: node.last_heartbeat
      }
    });
  } catch (error) {
    logger.error('Error processing heartbeat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process heartbeat'
    });
  }
}

/**
 * Get all sensor nodes
 * GET /api/sensors/nodes
 */
async function getNodes(req, res) {
  try {
    const { status, limit, offset } = req.query;
    
    const nodes = await SensorNodeModel.findAll({
      status,
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0
    });

    const total = await SensorNodeModel.count({ status });

    res.json({
      success: true,
      data: {
        nodes,
        total
      }
    });
  } catch (error) {
    logger.error('Error getting sensor nodes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sensor nodes'
    });
  }
}

/**
 * Get a specific sensor node
 * GET /api/sensors/nodes/:nodeId
 */
async function getNode(req, res) {
  try {
    const { nodeId } = req.params;

    let node;
    if (isValidUUID(nodeId)) {
      node = await SensorNodeModel.findById(nodeId);
    } else {
      node = await SensorNodeModel.findByNodeId(nodeId);
    }

    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Sensor node not found'
      });
    }

    // Get latest data for this node
    const latestData = await SensorDataModel.getLatest(node.id);
    const dataCount = await SensorDataModel.count(node.id);

    res.json({
      success: true,
      data: {
        ...node,
        latest_reading: latestData,
        total_readings: dataCount
      }
    });
  } catch (error) {
    logger.error('Error getting sensor node:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sensor node'
    });
  }
}

/**
 * Get sensor data for a node
 * GET /api/sensors/data/:nodeId
 */
async function getNodeData(req, res) {
  try {
    const { nodeId } = req.params;
    const { minutes, limit, start, end } = req.query;

    let node;
    if (isValidUUID(nodeId)) {
      node = await SensorNodeModel.findById(nodeId);
    } else {
      node = await SensorNodeModel.findByNodeId(nodeId);
    }

    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Sensor node not found'
      });
    }

    let data;
    if (start && end) {
      data = await SensorDataModel.getTimeRange(node.id, new Date(start), new Date(end));
    } else {
      data = await SensorDataModel.getRecent(node.id, {
        minutes: parseInt(minutes) || 5,
        limit: parseInt(limit) || 1000
      });
    }

    res.json({
      success: true,
      data: {
        node_id: node.node_id,
        readings: data,
        count: data.length
      }
    });
  } catch (error) {
    logger.error('Error getting sensor data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sensor data'
    });
  }
}

/**
 * Get aggregated sensor data
 * GET /api/sensors/data/:nodeId/aggregates
 */
async function getNodeAggregates(req, res) {
  try {
    const { nodeId } = req.params;
    const { hours } = req.query;

    let node;
    if (isValidUUID(nodeId)) {
      node = await SensorNodeModel.findById(nodeId);
    } else {
      node = await SensorNodeModel.findByNodeId(nodeId);
    }

    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Sensor node not found'
      });
    }

    const aggregates = await SensorDataModel.getHourlyAggregates(
      node.id,
      parseInt(hours) || 24
    );

    res.json({
      success: true,
      data: {
        node_id: node.node_id,
        aggregates
      }
    });
  } catch (error) {
    logger.error('Error getting sensor aggregates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sensor aggregates'
    });
  }
}

module.exports = {
  ingestData,
  ingestBatchData,
  heartbeat,
  getNodes,
  getNode,
  getNodeData,
  getNodeAggregates
};

