/**
 * Geospatial Utilities
 * 
 * Functions for geographic calculations including distance,
 * bounding boxes, and event-report matching.
 */

const logger = require('./logger');

// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate bearing from point 1 to point 2
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Bearing in degrees (0-360)
 */
function bearing(lat1, lon1, lat2, lon2) {
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  let brng = toDegrees(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Calculate bounding box around a point
 * @param {number} lat - Center latitude
 * @param {number} lon - Center longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Object} Bounding box { minLat, maxLat, minLon, maxLon }
 */
function boundingBox(lat, lon, radiusKm) {
  // Approximate degree per km
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos(toRadians(lat)));
  
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta
  };
}

/**
 * Check if a point is within a bounding box
 * @param {number} lat - Point latitude
 * @param {number} lon - Point longitude
 * @param {Object} box - Bounding box
 * @returns {boolean} True if point is within box
 */
function isInBoundingBox(lat, lon, box) {
  return lat >= box.minLat && lat <= box.maxLat &&
         lon >= box.minLon && lon <= box.maxLon;
}

/**
 * Calculate centroid of multiple points
 * @param {Array} points - Array of { latitude, longitude } objects
 * @returns {Object} Centroid { latitude, longitude }
 */
function calculateCentroid(points) {
  if (!points || points.length === 0) {
    return null;
  }
  
  if (points.length === 1) {
    return {
      latitude: points[0].latitude,
      longitude: points[0].longitude
    };
  }

  // Convert to Cartesian coordinates for accurate centroid
  let x = 0, y = 0, z = 0;
  
  for (const point of points) {
    const lat = toRadians(point.latitude);
    const lon = toRadians(point.longitude);
    
    x += Math.cos(lat) * Math.cos(lon);
    y += Math.cos(lat) * Math.sin(lon);
    z += Math.sin(lat);
  }
  
  const n = points.length;
  x /= n;
  y /= n;
  z /= n;
  
  const lon = Math.atan2(y, x);
  const hyp = Math.sqrt(x * x + y * y);
  const lat = Math.atan2(z, hyp);
  
  return {
    latitude: parseFloat(toDegrees(lat).toFixed(7)),
    longitude: parseFloat(toDegrees(lon).toFixed(7))
  };
}

/**
 * Match a felt report to nearby events
 * @param {Object} report - Felt report with latitude, longitude, reported_at
 * @param {Array} events - Array of events to check
 * @param {Object} options - Matching options
 * @returns {Object|null} Matched event or null
 */
function matchReportToEvent(report, events, options = {}) {
  const {
    maxDistanceKm = 100,    // Maximum distance to consider
    maxTimeMinutes = 30,    // Maximum time difference
    preferHighConfidence = true
  } = options;
  
  if (!events || events.length === 0) {
    return null;
  }
  
  const reportTime = new Date(report.reported_at).getTime();
  const matches = [];
  
  for (const event of events) {
    // Skip events without location
    if (event.latitude == null || event.longitude == null) {
      continue;
    }
    
    // Calculate distance
    const distance = haversineDistance(
      report.latitude, report.longitude,
      event.latitude, event.longitude
    );
    
    if (distance > maxDistanceKm) {
      continue;
    }
    
    // Calculate time difference
    const eventTime = new Date(event.detected_at).getTime();
    const timeDiffMinutes = Math.abs(reportTime - eventTime) / (1000 * 60);
    
    if (timeDiffMinutes > maxTimeMinutes) {
      continue;
    }
    
    // Calculate match score (lower is better)
    const distanceScore = distance / maxDistanceKm;
    const timeScore = timeDiffMinutes / maxTimeMinutes;
    const confidenceBonus = preferHighConfidence ? (1 - (event.confidence || 0)) * 0.2 : 0;
    const score = distanceScore * 0.5 + timeScore * 0.5 + confidenceBonus;
    
    matches.push({
      event,
      distance: parseFloat(distance.toFixed(2)),
      timeDiffMinutes: parseFloat(timeDiffMinutes.toFixed(1)),
      score
    });
  }
  
  if (matches.length === 0) {
    return null;
  }
  
  // Sort by score and return best match
  matches.sort((a, b) => a.score - b.score);
  
  return matches[0];
}

/**
 * Estimate epicenter from multiple detection points (simple triangulation)
 * @param {Array} detections - Array of { latitude, longitude, detection_time, peak_acceleration }
 * @returns {Object} Estimated epicenter with uncertainty
 */
function estimateEpicenter(detections) {
  if (!detections || detections.length === 0) {
    return null;
  }
  
  if (detections.length === 1) {
    return {
      latitude: detections[0].latitude,
      longitude: detections[0].longitude,
      uncertainty_km: 50, // High uncertainty with single detection
      method: 'single_station'
    };
  }
  
  // Simple weighted centroid based on peak acceleration
  // Higher acceleration = closer to epicenter (simplified assumption)
  const weights = detections.map(d => d.peak_acceleration || 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  let weightedLat = 0;
  let weightedLon = 0;
  
  for (let i = 0; i < detections.length; i++) {
    const weight = weights[i] / totalWeight;
    weightedLat += detections[i].latitude * weight;
    weightedLon += detections[i].longitude * weight;
  }
  
  // Calculate uncertainty based on spread of detections
  const centroid = { latitude: weightedLat, longitude: weightedLon };
  const distances = detections.map(d => 
    haversineDistance(centroid.latitude, centroid.longitude, d.latitude, d.longitude)
  );
  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
  
  return {
    latitude: parseFloat(weightedLat.toFixed(7)),
    longitude: parseFloat(weightedLon.toFixed(7)),
    uncertainty_km: parseFloat(avgDistance.toFixed(2)),
    method: 'weighted_centroid',
    detection_count: detections.length
  };
}

/**
 * Find nearby sensor nodes for an event
 * @param {Object} epicenter - { latitude, longitude }
 * @param {Array} nodes - Array of sensor nodes
 * @param {number} radiusKm - Search radius
 * @returns {Array} Nearby nodes with distances
 */
function findNearbyNodes(epicenter, nodes, radiusKm = 100) {
  const nearby = [];
  
  for (const node of nodes) {
    const distance = haversineDistance(
      epicenter.latitude, epicenter.longitude,
      node.latitude, node.longitude
    );
    
    if (distance <= radiusKm) {
      nearby.push({
        ...node,
        distance_km: parseFloat(distance.toFixed(2))
      });
    }
  }
  
  // Sort by distance
  nearby.sort((a, b) => a.distance_km - b.distance_km);
  
  return nearby;
}

module.exports = {
  haversineDistance,
  bearing,
  boundingBox,
  isInBoundingBox,
  calculateCentroid,
  matchReportToEvent,
  estimateEpicenter,
  findNearbyNodes,
  toRadians,
  toDegrees,
  EARTH_RADIUS_KM
};

