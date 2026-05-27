/**
 * STA/LTA (Short-Term Average / Long-Term Average) Algorithm
 * 
 * Classic seismology algorithm for automatic earthquake detection.
 * Compares short-term signal average to long-term average to detect
 * sudden increases in ground motion.
 * 
 * When the ratio exceeds a threshold, it indicates a potential seismic event.
 */

const logger = require('./logger');

// Default parameters
const DEFAULT_STA_WINDOW = 50;    // Short-term window (samples) - typically 0.5-2 seconds
const DEFAULT_LTA_WINDOW = 500;   // Long-term window (samples) - typically 5-30 seconds
const DEFAULT_TRIGGER = 2.0;      // Trigger threshold
const DEFAULT_DETRIGGER = 1.5;    // Detrigger threshold

/**
 * Calculate STA/LTA ratio for a single point in the signal
 * @param {Array} signal - Signal array (magnitudes)
 * @param {number} index - Current index
 * @param {number} staWindow - Short-term window size
 * @param {number} ltaWindow - Long-term window size
 * @returns {number} STA/LTA ratio
 */
function calculateRatio(signal, index, staWindow = DEFAULT_STA_WINDOW, ltaWindow = DEFAULT_LTA_WINDOW) {
  if (index < ltaWindow) {
    return 0; // Not enough data for LTA
  }

  // Calculate STA (short-term average) - most recent samples
  const staStart = Math.max(0, index - staWindow + 1);
  let staSum = 0;
  for (let i = staStart; i <= index; i++) {
    staSum += Math.abs(signal[i]);
  }
  const sta = staSum / staWindow;

  // Calculate LTA (long-term average) - preceding samples (excluding STA window)
  const ltaStart = Math.max(0, index - ltaWindow - staWindow + 1);
  const ltaEnd = index - staWindow;
  let ltaSum = 0;
  let ltaCount = 0;
  for (let i = ltaStart; i <= ltaEnd; i++) {
    ltaSum += Math.abs(signal[i]);
    ltaCount++;
  }
  const lta = ltaCount > 0 ? ltaSum / ltaCount : 1;

  // Avoid division by zero
  if (lta === 0) {
    return sta > 0 ? Infinity : 0;
  }

  return sta / lta;
}

/**
 * Process entire signal and calculate STA/LTA ratios
 * @param {Array} magnitudes - Array of magnitude values
 * @param {Object} options - Algorithm options
 * @returns {Object} Analysis results
 */
function analyze(magnitudes, options = {}) {
  const {
    staWindow = DEFAULT_STA_WINDOW,
    ltaWindow = DEFAULT_LTA_WINDOW,
    triggerThreshold = DEFAULT_TRIGGER,
    detriggerThreshold = DEFAULT_DETRIGGER
  } = options;

  if (!magnitudes || magnitudes.length === 0) {
    return {
      ratios: [],
      triggers: [],
      maxRatio: 0,
      triggered: false
    };
  }

  const ratios = [];
  const triggers = [];
  let isTriggered = false;
  let maxRatio = 0;
  let triggerStart = null;

  for (let i = 0; i < magnitudes.length; i++) {
    const ratio = calculateRatio(magnitudes, i, staWindow, ltaWindow);
    ratios.push(ratio);
    maxRatio = Math.max(maxRatio, ratio);

    // Check for trigger/detrigger
    if (!isTriggered && ratio >= triggerThreshold) {
      isTriggered = true;
      triggerStart = i;
      logger.debug(`STA/LTA trigger at index ${i}, ratio: ${ratio.toFixed(2)}`);
    } else if (isTriggered && ratio < detriggerThreshold) {
      triggers.push({
        start: triggerStart,
        end: i,
        peakRatio: Math.max(...ratios.slice(triggerStart, i + 1)),
        duration: i - triggerStart
      });
      isTriggered = false;
      triggerStart = null;
    }
  }

  // Handle case where signal ends while still triggered
  if (isTriggered && triggerStart !== null) {
    triggers.push({
      start: triggerStart,
      end: magnitudes.length - 1,
      peakRatio: Math.max(...ratios.slice(triggerStart)),
      duration: magnitudes.length - 1 - triggerStart,
      ongoing: true
    });
  }

  return {
    ratios,
    triggers,
    maxRatio,
    triggered: triggers.length > 0 || isTriggered,
    params: { staWindow, ltaWindow, triggerThreshold, detriggerThreshold }
  };
}

/**
 * Quick check if current signal indicates an event
 * @param {Array} magnitudes - Recent magnitude values
 * @param {Object} options - Options
 * @returns {Object} Quick detection result
 */
function quickDetect(magnitudes, options = {}) {
  const {
    staWindow = DEFAULT_STA_WINDOW,
    ltaWindow = DEFAULT_LTA_WINDOW,
    triggerThreshold = DEFAULT_TRIGGER
  } = options;

  if (!magnitudes || magnitudes.length < ltaWindow + staWindow) {
    return {
      triggered: false,
      ratio: 0,
      message: 'Insufficient data for STA/LTA analysis'
    };
  }

  // Calculate ratio for most recent point
  const ratio = calculateRatio(magnitudes, magnitudes.length - 1, staWindow, ltaWindow);
  const triggered = ratio >= triggerThreshold;

  return {
    triggered,
    ratio: parseFloat(ratio.toFixed(4)),
    threshold: triggerThreshold,
    message: triggered ? 'Potential seismic event detected' : 'Normal background activity'
  };
}

/**
 * Process sensor data objects (with time, magnitude fields)
 * @param {Array} sensorData - Array of sensor data objects
 * @param {Object} options - Algorithm options
 * @returns {Object} Analysis results with timing info
 */
function analyzeSensorData(sensorData, options = {}) {
  if (!sensorData || sensorData.length === 0) {
    return {
      triggered: false,
      triggers: [],
      maxRatio: 0
    };
  }

  // Sort by time
  const sorted = [...sensorData].sort((a, b) => 
    new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  // Extract magnitudes
  const magnitudes = sorted.map(d => parseFloat(d.magnitude) || 0);
  const times = sorted.map(d => new Date(d.time));

  // Run analysis
  const result = analyze(magnitudes, options);

  // Add timing information to triggers
  const triggersWithTime = result.triggers.map(t => ({
    ...t,
    startTime: times[t.start],
    endTime: times[t.end],
    peakMagnitude: Math.max(...magnitudes.slice(t.start, t.end + 1))
  }));

  return {
    ...result,
    triggers: triggersWithTime,
    dataPoints: sensorData.length,
    timeRange: {
      start: times[0],
      end: times[times.length - 1]
    }
  };
}

/**
 * Calculate optimal window sizes based on sampling rate
 * @param {number} samplingRate - Samples per second
 * @param {Object} durations - Desired window durations in seconds
 * @returns {Object} Window sizes in samples
 */
function calculateWindowSizes(samplingRate, durations = {}) {
  const {
    staSeconds = 1,    // 1 second STA window
    ltaSeconds = 10    // 10 second LTA window
  } = durations;

  return {
    staWindow: Math.round(samplingRate * staSeconds),
    ltaWindow: Math.round(samplingRate * ltaSeconds)
  };
}

module.exports = {
  analyze,
  analyzeSensorData,
  quickDetect,
  calculateRatio,
  calculateWindowSizes,
  DEFAULT_STA_WINDOW,
  DEFAULT_LTA_WINDOW,
  DEFAULT_TRIGGER,
  DEFAULT_DETRIGGER
};

