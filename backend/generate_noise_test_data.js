/**
 * Generate 550-point noise batch for STA/LTA + ML testing.
 * Same JSON shape as generate_test_data.js / test_batch_550_points.json,
 * but all samples stay low magnitude (no earthquake trigger tail).
 */

const fs = require('fs');
const path = require('path');

const NODE_ID = 'ESP32_NODE_001';
const SAMPLING_RATE = 100;
const INTERVAL_MS = 100;
const TOTAL_POINTS = 550;

const BATCH_END_MS = Date.now();
const BATCH_START_MS = BATCH_END_MS - (TOTAL_POINTS - 1) * INTERVAL_MS;

function generateTimestamp(index) {
  return new Date(BATCH_START_MS + index * INTERVAL_MS).toISOString();
}

/** Random unit vector for spreading scalar noise across x/y/z */
function randomDirection() {
  let x = Math.random() - 0.5;
  let y = Math.random() - 0.5;
  let z = Math.random() - 0.5;
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

/**
 * One noise sample: low steady vibration (~0.008–0.028 magnitude).
 */
function generateNoisePoint(index, direction, bgBase) {
  const variation = (Math.random() - 0.5) * 0.014;
  const scalar = Math.max(0.001, Math.min(0.038, bgBase + variation));
  const jx = 1 + (Math.random() - 0.5) * 0.06;
  const jy = 1 + (Math.random() - 0.5) * 0.06;
  const jz = 1 + (Math.random() - 0.5) * 0.06;

  return {
    x: parseFloat((scalar * direction.x * jx).toFixed(6)),
    y: parseFloat((scalar * direction.y * jy).toFixed(6)),
    z: parseFloat((scalar * direction.z * jz).toFixed(6)),
    timestamp: generateTimestamp(index)
  };
}

const direction = randomDirection();
const bgBase = 0.008 + Math.random() * 0.012;

const data = [];
for (let i = 0; i < TOTAL_POINTS; i++) {
  data.push(generateNoisePoint(i, direction, bgBase));
}

const payload = {
  node_id: NODE_ID,
  sampling_rate: SAMPLING_RATE,
  data
};

const outputPath = path.join(__dirname, 'test_batch_550_noise_points.json');
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

console.log(`Generated ${TOTAL_POINTS} noise data points`);
console.log(`Timestamps: ${new Date(BATCH_START_MS).toISOString()} -> ${new Date(BATCH_END_MS).toISOString()}`);
console.log(`Saved to: ${outputPath}`);
console.log(`Magnitude range: ~0.008-0.028 (no trigger spike)`);
console.log(`Expected: low STA/LTA (~1), ML label likely "noise"`);
console.log(`POST to /api/sensors/data/batch with this JSON`);
