/**
 * Derive events.magnitude_estimate from peak accelerometer vector magnitude.
 * This is a display-scale proxy (not a calibrated Richter M); fits DECIMAL(4,2).
 */
function estimateMagnitudeFromPeak(peakAcceleration) {
  const peak = parseFloat(peakAcceleration);
  if (!Number.isFinite(peak) || peak <= 0) {
    return null;
  }
  const estimate = 2.0 + Math.log10(peak);
  return Math.min(9.99, Math.max(0.01, parseFloat(estimate.toFixed(2))));
}

/**
 * Peak vector magnitude from a sensor segment (same as sensor_data.magnitude).
 */
function peakMagnitudeFromSegment(sensorData, prediction) {
  const fromPrediction = prediction?.details?.input_magnitude;
  if (fromPrediction != null && Number.isFinite(parseFloat(fromPrediction))) {
    return parseFloat(fromPrediction);
  }
  if (!sensorData?.length) return 0;
  return Math.max(0, ...sensorData.map((d) => parseFloat(d.magnitude) || 0));
}

module.exports = {
  estimateMagnitudeFromPeak,
  peakMagnitudeFromSegment
};
