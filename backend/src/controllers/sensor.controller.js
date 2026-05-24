const SensorDataModel = require('../models/sensorData.model');
const SensorNodeModel = require('../models/sensorNode.model');
const PredictionModel = require('../models/prediction.model');
const EventModel = require('../models/event.model');
const mlClient = require('../utils/mlClient');
const staLta = require('../utils/staLta');
const {
  estimateMagnitudeFromPeak,
  peakMagnitudeFromSegment
} = require('../utils/magnitudeEstimate');
const logger = require('../utils/logger');
const { isValidUUID } = require('../utils/validators');

// Default lookback for node predictions list
const NODE_PREDICTIONS_DEFAULT_HOURS = 24;
const NODE_PREDICTIONS_DEFAULT_LIMIT = 100;

/**
 * Sensor Controller
 * 
 * Handles sensor data ingestion and node management.
 */

// Event detection thresholds
const EVENT_CONFIDENCE_THRESHOLD = parseFloat(process.env.EVENT_CONFIDENCE_THRESHOLD) || 0.7;
const STA_LTA_THRESHOLD = parseFloat(process.env.STA_LTA_THRESHOLD) || 3.0;
const EVENT_TIME_WINDOW_MS = parseInt(process.env.EVENT_TIME_WINDOW_MS) || 60000;
// Allow event creation based on STA/LTA alone (without ML requirement)
const STA_LTA_ONLY_EVENTS = process.env.STA_LTA_ONLY_EVENTS === 'true' || false;
// Higher STA/LTA threshold for direct event creation (more conservative)
const STA_LTA_EVENT_THRESHOLD = parseFloat(process.env.STA_LTA_EVENT_THRESHOLD) || 4.0;
const MIN_STA_LTA_SAMPLES = staLta.DEFAULT_LTA_WINDOW + staLta.DEFAULT_STA_WINDOW;

/**
 * Run STA/LTA on a time-ordered segment, then always call ML and persist the prediction.
 * Event creation remains gated on STA/LTA trigger + confidence / STA_LTA-only rules.
 */
async function runStaLtaAndMl(node, chronologicalData, logLabel = 'ingest') {
  if (chronologicalData.length < MIN_STA_LTA_SAMPLES) {
    return {
      sta_lta_triggered: false,
      sta_lta_ratio: 0,
      message: `Insufficient data for STA/LTA (need ${MIN_STA_LTA_SAMPLES} points, got ${chronologicalData.length})`,
      event_created: false,
      prediction: null,
      confidence: null,
      model_version: null,
      ml_called: false
    };
  }

  const magnitudes = chronologicalData.map((d) => parseFloat(d.magnitude));
  const staLtaResult = staLta.quickDetect(magnitudes, { triggerThreshold: STA_LTA_THRESHOLD });

  const features = mlClient.extractFeatures(chronologicalData);
  features.sta_lta_ratio = staLtaResult.ratio;

  let prediction = null;
  let mlCalled = false;

  try {
    prediction = await mlClient.predict({ features });
    mlCalled = true;

    await PredictionModel.create({
      node_id: node.id,
      data_segment_start: chronologicalData[0].time,
      data_segment_end: chronologicalData[chronologicalData.length - 1].time,
      prediction: prediction.prediction,
      confidence: prediction.confidence,
      features,
      model_version: prediction.model_version || 'ml-service',
      processing_time_ms: prediction.processing_time_ms
    });

    logger.info(`ML prediction after STA/LTA (${logLabel}):`, {
      node_id: node.node_id,
      sta_lta_ratio: staLtaResult.ratio,
      prediction: prediction.prediction,
      confidence: prediction.confidence,
      model_version: prediction.model_version
    });
  } catch (error) {
    logger.warn(`ML prediction failed after STA/LTA (${logLabel}):`, error.message);
  }

  let shouldCreateEvent = false;
  if (
    prediction &&
    prediction.prediction === 'earthquake' &&
    prediction.confidence >= EVENT_CONFIDENCE_THRESHOLD
  ) {
    shouldCreateEvent = true;
  }

  let eventCreated = false;
  if (staLtaResult.triggered) {
    if (shouldCreateEvent || (STA_LTA_ONLY_EVENTS && staLtaResult.ratio >= STA_LTA_EVENT_THRESHOLD)) {
      const eventPrediction = prediction || {
        prediction: 'earthquake',
        confidence: Math.min(0.85, 0.5 + staLtaResult.ratio / 10),
        details: { sta_lta_only: true }
      };

      eventCreated = await handleEarthquakeDetection(
        node,
        chronologicalData,
        eventPrediction,
        staLtaResult
      );
    }

    logger.info(`STA/LTA trigger (${logLabel}):`, {
      node_id: node.node_id,
      sta_lta_ratio: staLtaResult.ratio,
      event_created: eventCreated
    });
  }

  return {
    sta_lta_triggered: staLtaResult.triggered,
    sta_lta_ratio: staLtaResult.ratio,
    message: staLtaResult.message,
    prediction: prediction?.prediction ?? null,
    confidence: prediction?.confidence ?? null,
    model_version: prediction?.model_version ?? null,
    event_created: eventCreated,
    ml_called: mlCalled
  };
}

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

    // Get recent data for STA/LTA + ML (need 550 samples for a valid ratio)
    const recentData = await SensorDataModel.getRecent(node.id, { minutes: 1, limit: 600 });
    const chronologicalData = [...recentData].reverse();
    const detectionResult = await runStaLtaAndMl(node, chronologicalData, `single:${node_id}`);

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

    // Analyze the batch we just received (not wall-clock "last 1 minute" from DB).
    // Postman/file ingest often has timestamps from generate_test_data.js that are
    // minutes old by post time; getRecent(minutes:1) would return 0 rows and skip detection.
    const chronologicalData = batchData
      .map((d) => ({
        time: d.timestamp,
        x_axis: d.x_axis,
        y_axis: d.y_axis,
        z_axis: d.z_axis,
        magnitude: Math.sqrt(d.x_axis ** 2 + d.y_axis ** 2 + d.z_axis ** 2),
        sampling_rate: d.sampling_rate
      }))
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    const detectionResult = await runStaLtaAndMl(node, chronologicalData, `batch:${node_id}`);

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
  const peakAcceleration = peakMagnitudeFromSegment(sensorData, prediction);
  const magnitudeEstimate = estimateMagnitudeFromPeak(peakAcceleration);

  try {
    const latitude = parseFloat(node.latitude);
    const longitude = parseFloat(node.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      logger.error('Cannot create event: sensor node missing valid latitude/longitude');
      return false;
    }

    // Check for existing recent event
    const recentEvents = await EventModel.findNearby(
      latitude,
      longitude,
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
        peak_acceleration: peakAcceleration,
        sta_lta_ratio: staLtaResult.ratio
      });

      // Update event confidence (average of detections) and keep strongest magnitude
      const priorConfidence = parseFloat(pendingEvent.confidence) || 0;
      const newConfidence = (priorConfidence + prediction.confidence) / 2;
      const priorMagnitude = parseFloat(pendingEvent.magnitude_estimate);
      const updatedMagnitude =
        magnitudeEstimate != null
          ? Math.max(Number.isFinite(priorMagnitude) ? priorMagnitude : 0, magnitudeEstimate)
          : pendingEvent.magnitude_estimate;

      await EventModel.update(pendingEvent.id, {
        confidence: newConfidence,
        magnitude_estimate: updatedMagnitude
      });

      logger.info(`Added detection to existing event ${pendingEvent.id}`);
    } else {
      // Create new event
      const newEvent = await EventModel.create({
        event_type: 'earthquake',
        confidence: prediction.confidence,
        magnitude_estimate: magnitudeEstimate,
        latitude,
        longitude,
        detected_at: new Date(),
        status: 'pending'
      });

      // Add first detection
      await EventModel.addDetection({
        event_id: newEvent.id,
        node_id: node.id,
        detection_time: new Date(),
        peak_acceleration: peakAcceleration,
        sta_lta_ratio: staLtaResult.ratio
      });

      logger.info(`Created new earthquake event ${newEvent.id}`);
    }

    return true;
  } catch (error) {
    logger.error('Error handling earthquake detection:', error);
    return false;
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
    // Accept both 'start/end' and 'start_time/end_time' for compatibility
    const {
      minutes,
      limit,
      start,
      end,
      start_time,
      end_time
    } = req.query;

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

    // Use start_time/end_time if provided, otherwise use start/end
    const startDate = start_time || start;
    const endDate = end_time || end;

    let data;
    if (startDate && endDate) {
      // Use time range query
      data = await SensorDataModel.getTimeRange(
        node.id,
        new Date(startDate),
        new Date(endDate)
      );
    } else {
      // minutes=0 → latest `limit` rows by time (no NOW() window); omit → default 5 minutes
      const minutesParam =
        minutes !== undefined && minutes !== ''
          ? parseInt(minutes, 10)
          : 5;
      data = await SensorDataModel.getRecent(node.id, {
        minutes: Number.isFinite(minutesParam) ? minutesParam : 5,
        limit: parseInt(limit, 10) || 1000
      });
    }

    // Calculate time range for response
    let timeRange = null;
    if (data.length > 0) {
      timeRange = {
        start: data[data.length - 1].time,
        end: data[0].time
      };
    }

    res.json({
      success: true,
      data: {
        node_id: node.node_id,
        readings: data,
        count: data.length,
        time_range: timeRange
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

/**
 * Get recent ML predictions for a node.
 * GET /api/sensors/nodes/:nodeId/predictions
 *
 * Query params: hours (default 24), limit (default 100)
 */
async function getNodePredictions(req, res) {
  try {
    const { nodeId } = req.params;
    const hours = parseInt(req.query.hours, 10) || NODE_PREDICTIONS_DEFAULT_HOURS;
    const limit = Math.min(
      parseInt(req.query.limit, 10) || NODE_PREDICTIONS_DEFAULT_LIMIT,
      500
    );

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

    const predictions = await PredictionModel.findByNodeId(node.id, { hours, limit });

    res.json({
      success: true,
      data: {
        node_id: node.node_id,
        hours,
        count: predictions.length,
        predictions
      }
    });
  } catch (error) {
    logger.error('Error getting node predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get node predictions'
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
  getNodeAggregates,
  getNodePredictions
};

