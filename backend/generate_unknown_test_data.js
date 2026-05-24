/**
 * Generate 550-point "unknown" batch for STA/LTA + ML testing.
 * Ambiguous motion: moderate vibration, mild mid-window bump, gentle tail
 * (not a sharp earthquake spike). Same JSON shape as other test batch files.
 */

const fs = require('fs');
const path = require('path');

const NODE_ID = 'ESP32_NODE_001';
const SAMPLING_RATE = 100;
const INTERVAL_MS = 100;
const TOTAL_POINTS = 550;
const STA_WINDOW = 50;

const BATCH_END_MS = Date.now();
const BATCH_START_MS = BATCH_END_MS - (TOTAL_POINTS - 1) * INTERVAL_MS;

function generateTimestamp(index) {
  return new Date(BATCH_START_MS + index * INTERVAL_MS).toISOString();
}

function randomDirection() {
  let x = Math.random() - 0.5;
  let y = Math.random() - 0.5;
  let z = Math.random() - 0.5;
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

function xyzFromScalar(scalar, direction) {
  const jx = 1 + (Math.random() - 0.5) * 0.08;
  const jy = 1 + (Math.random() - 0.5) * 0.08;
  const jz = 1 + (Math.random() - 0.5) * 0.08;
  return {
    x: parseFloat((scalar * direction.x * jx).toFixed(6)),
    y: parseFloat((scalar * direction.y * jy).toFixed(6)),
    z: parseFloat((scalar * direction.z * jz).toFixed(6))
  };
}

const direction = randomDirection();
const baseLevel = 0.02 + Math.random() * 0.035;
const wanderAmplitude = 0.015 + Math.random() * 0.03;
const mildBumpCenter = 300 + Math.floor(Math.random() * 150);
const mildBumpStrength = 0.05 + Math.random() * 0.07;
const tailBoost = 0.04 + Math.random() * 0.06;
const phaseCycles = 2 + Math.random() * 3;

const data = [];
for (let i = 0; i < TOTAL_POINTS; i++) {
  const phase = (i / TOTAL_POINTS) * Math.PI * phaseCycles;
  let scalar = baseLevel + wanderAmplitude * Math.sin(phase) + (Math.random() - 0.5) * 0.016;

  const dist = Math.abs(i - mildBumpCenter) / 40;
  scalar += mildBumpStrength * Math.exp(-(dist * dist));

  if (i >= TOTAL_POINTS - STA_WINDOW) {
    const tailProgress = (i - (TOTAL_POINTS - STA_WINDOW)) / STA_WINDOW;
    scalar += tailBoost * (0.4 + 0.6 * tailProgress);
  }

  scalar = Math.max(0.02, Math.min(0.22, scalar));
  const xyz = xyzFromScalar(scalar, direction);
  data.push({
    ...xyz,
    timestamp: generateTimestamp(i)
  });
}

const payload = {
  node_id: NODE_ID,
  sampling_rate: SAMPLING_RATE,
  data
};

const outputPath = path.join(__dirname, 'test_batch_550_unknown_points.json');
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

console.log(`Generated ${TOTAL_POINTS} unknown data points`);
console.log(`Timestamps: ${new Date(BATCH_START_MS).toISOString()} -> ${new Date(BATCH_END_MS).toISOString()}`);
console.log(`Saved to: ${outputPath}`);
console.log(`Magnitude range: ~0.10-0.22 (ambiguous, no quake spike)`);
console.log(`Expected: STA/LTA ~1.2-2.7, ML label likely "unknown"`);
console.log(`POST to /api/sensors/data/batch with this JSON`);
