const logger = require('./logger');

/**
 * ML Client - Placeholder for machine learning earthquake detection
 * 
 * This is a placeholder implementation that simulates ML model predictions.
 * In production, this would call an actual ML service (e.g., Python Flask/FastAPI)
 * that runs a trained model on the sensor data.
 * 
 * The placeholder uses simple heuristics based on magnitude thresholds
 * to simulate realistic predictions for development and testing.
 */

// Configuration
const ML_ENABLED = process.env.ML_ENABLED === 'true';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

// Thresholds for placeholder classification
const THRESHOLDS = {
  EARTHQUAKE_MAGNITUDE: 0.1,     // Magnitude above which may indicate earthquake
  HIGH_CONFIDENCE_MAG: 0.5,      // Magnitude for high confidence earthquake
  NOISE_CEILING: 0.05,           // Typical noise level ceiling
  STA_LTA_TRIGGER: 3.0           // STA/LTA ratio trigger threshold
};

/**
 * Placeholder ML prediction based on magnitude and features
 * @param {Object} data - Input data for prediction
 * @returns {Object} Prediction result
 */
function placeholderPredict(data) {
  const startTime = Date.now();
  
  const {
    magnitude = 0,
    sta_lta_ratio = 0,
    peak_acceleration = 0,
    duration_ms = 0,
    frequency_content = null
  } = data;

  let prediction = 'unknown';
  let confidence = 0.5;
  let details = {};

  // Simple heuristic-based classification
  if (magnitude < THRESHOLDS.NOISE_CEILING && sta_lta_ratio < 1.5) {
    // Low magnitude and low STA/LTA = likely noise
    prediction = 'noise';
    confidence = 0.8 + (Math.random() * 0.15);
  } else if (magnitude > THRESHOLDS.HIGH_CONFIDENCE_MAG || sta_lta_ratio > THRESHOLDS.STA_LTA_TRIGGER) {
    // High magnitude or high STA/LTA = likely earthquake
    prediction = 'earthquake';
    confidence = 0.7 + (Math.min(magnitude, 1) * 0.2) + (Math.random() * 0.08);
  } else if (magnitude > THRESHOLDS.EARTHQUAKE_MAGNITUDE) {
    // Moderate activity - could be either
    if (sta_lta_ratio > 2.0) {
      prediction = 'earthquake';
      confidence = 0.5 + (sta_lta_ratio / 10) + (Math.random() * 0.15);
    } else {
      prediction = Math.random() > 0.6 ? 'earthquake' : 'noise';
      confidence = 0.4 + (Math.random() * 0.2);
    }
  } else {
    // Ambiguous - classify as unknown
    prediction = 'unknown';
    confidence = 0.3 + (Math.random() * 0.2);
  }

  // Cap confidence at 0.99
  confidence = Math.min(confidence, 0.99);
  confidence = parseFloat(confidence.toFixed(4));

  const processingTime = Date.now() - startTime;

  details = {
    input_magnitude: magnitude,
    input_sta_lta: sta_lta_ratio,
    thresholds_used: THRESHOLDS,
    model: 'placeholder-heuristic-v1'
  };

  logger.debug('ML Placeholder prediction:', {
    prediction,
    confidence,
    processing_time_ms: processingTime
  });

  return {
    prediction,
    confidence,
    processing_time_ms: processingTime,
    model_version: 'placeholder-v1',
    details
  };
}

/**
 * Extract features from raw sensor data
 * @param {Array} sensorData - Array of sensor data points
 * @returns {Object} Extracted features
 */
function extractFeatures(sensorData) {
  if (!sensorData || sensorData.length === 0) {
    return {
      magnitude: 0,
      peak_acceleration: 0,
      avg_magnitude: 0,
      std_magnitude: 0,
      duration_ms: 0,
      sample_count: 0
    };
  }

  const magnitudes = sensorData.map(d => parseFloat(d.magnitude) || 0);
  const times = sensorData.map(d => new Date(d.time).getTime());

  // Calculate statistics
  const sum = magnitudes.reduce((a, b) => a + b, 0);
  const avg = sum / magnitudes.length;
  const max = Math.max(...magnitudes);
  const min = Math.min(...magnitudes);

  // Standard deviation
  const squareDiffs = magnitudes.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  const std = Math.sqrt(avgSquareDiff);

  // Duration
  const duration = times.length > 1 ? Math.max(...times) - Math.min(...times) : 0;

  return {
    magnitude: max,
    peak_acceleration: max,
    avg_magnitude: avg,
    min_magnitude: min,
    std_magnitude: std,
    duration_ms: duration,
    sample_count: sensorData.length
  };
}

/**
 * Main prediction function - calls ML service or placeholder
 * @param {Object} options - Prediction options
 * @returns {Promise<Object>} Prediction result
 */
async function predict(options) {
  const {
    sensorData = null,
    features = null,
    node_id = null
  } = options;

  // Extract features if raw sensor data is provided
  let inputFeatures = features;
  if (!inputFeatures && sensorData) {
    inputFeatures = extractFeatures(sensorData);
  }

  if (!inputFeatures) {
    throw new Error('Either sensorData or features must be provided');
  }

  // If ML service is enabled and configured, call it
  if (ML_ENABLED && ML_SERVICE_URL) {
    try {
      return await callMLService(inputFeatures);
    } catch (error) {
      logger.warn('ML service call failed, falling back to placeholder:', error.message);
      // Fall through to placeholder
    }
  }

  // Use placeholder prediction
  return placeholderPredict(inputFeatures);
}

/**
 * Call external ML service (for future implementation)
 * @param {Object} features - Feature vector
 * @returns {Promise<Object>} Prediction from ML service
 */
async function callMLService(features) {
  // This would be implemented when the actual ML model is ready
  // Example implementation:
  /*
  const response = await fetch(`${ML_SERVICE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ features })
  });
  
  if (!response.ok) {
    throw new Error(`ML service returned ${response.status}`);
  }
  
  return await response.json();
  */
  
  throw new Error('ML service not implemented - using placeholder');
}

/**
 * Batch prediction for multiple data segments
 * @param {Array} segments - Array of data segments
 * @returns {Promise<Array>} Array of predictions
 */
async function predictBatch(segments) {
  const predictions = [];
  
  for (const segment of segments) {
    try {
      const prediction = await predict(segment);
      predictions.push({
        ...prediction,
        segment_id: segment.segment_id
      });
    } catch (error) {
      logger.error('Batch prediction error for segment:', error);
      predictions.push({
        segment_id: segment.segment_id,
        error: error.message,
        prediction: 'unknown',
        confidence: 0
      });
    }
  }
  
  return predictions;
}

/**
 * Check if ML service is healthy
 * @returns {Promise<Object>} Health status
 */
async function healthCheck() {
  return {
    enabled: ML_ENABLED,
    service_url: ML_SERVICE_URL,
    status: ML_ENABLED ? 'external_service' : 'placeholder_active',
    placeholder_version: 'placeholder-v1',
    thresholds: THRESHOLDS
  };
}

module.exports = {
  predict,
  predictBatch,
  extractFeatures,
  placeholderPredict,
  healthCheck,
  THRESHOLDS
};

