/**
 * Generate test sensor data for STA/LTA event detection
 * Creates 550+ points: 500 low magnitude (background) + 50+ high magnitude (trigger)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const NODE_ID = 'ESP32_NODE_001';
const SAMPLING_RATE = 100;
const BASE_TIMESTAMP = '2026-01-27T16:00:00.000Z';
const BACKGROUND_POINTS = 500; // Low magnitude background noise
const TRIGGER_POINTS = 50;      // High magnitude trigger points
const TOTAL_POINTS = BACKGROUND_POINTS + TRIGGER_POINTS;

// Generate timestamp
function generateTimestamp(baseTime, index) {
    const base = new Date(baseTime);
    const milliseconds = index * 100; // 100ms intervals (10 samples per second)
    const timestamp = new Date(base.getTime() + milliseconds);
    return timestamp.toISOString();
}

// Generate background noise data (low magnitude ~0.01-0.02)
function generateBackgroundPoint(index) {
    const base = 0.01;
    const variation = (Math.random() - 0.5) * 0.02; // ±0.01 variation
    const value = base + variation;

    return {
        x: parseFloat(value.toFixed(6)),
        y: parseFloat((value + (Math.random() - 0.5) * 0.002).toFixed(6)),
        z: parseFloat((value + (Math.random() - 0.5) * 0.002).toFixed(6)),
        timestamp: generateTimestamp(BASE_TIMESTAMP, index)
    };
}

// Generate trigger data (high magnitude, increasing)
function generateTriggerPoint(index) {
    // Start at 0.5 and increase to 9.0
    const progress = (index - BACKGROUND_POINTS) / TRIGGER_POINTS;
    const magnitude = 0.5 + (progress * 8.5); // 0.5 to 9.0

    return {
        x: parseFloat(magnitude.toFixed(6)),
        y: parseFloat(magnitude.toFixed(6)),
        z: parseFloat(magnitude.toFixed(6)),
        timestamp: generateTimestamp(BASE_TIMESTAMP, index)
    };
}

// Generate all data points
const data = [];

console.log(`Generating ${TOTAL_POINTS} data points...`);

// Generate background points (low magnitude)
for (let i = 0; i < BACKGROUND_POINTS; i++) {
    data.push(generateBackgroundPoint(i));
}

// Generate trigger points (high magnitude)
for (let i = BACKGROUND_POINTS; i < TOTAL_POINTS; i++) {
    data.push(generateTriggerPoint(i));
}

// Create the complete request payload
const payload = {
    node_id: NODE_ID,
    sampling_rate: SAMPLING_RATE,
    data: data
};

// Write to JSON file
const outputPath = path.join(__dirname, 'test_batch_550_points.json');
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

console.log(`\n✅ Generated ${TOTAL_POINTS} data points`);
console.log(`📁 Saved to: ${outputPath}`);
console.log(`\n📊 Data breakdown:`);
console.log(`   - Background points: ${BACKGROUND_POINTS} (magnitude ~0.01-0.02)`);
console.log(`   - Trigger points: ${TRIGGER_POINTS} (magnitude 0.5-9.0)`);
console.log(`\n🎯 Expected behavior:`);
console.log(`   - STA/LTA ratio should be very high (>100)`);
console.log(`   - Event should be created automatically`);
console.log(`\n📋 To use:`);
console.log(`   1. Copy the JSON from ${outputPath}`);
console.log(`   2. Paste into Postman POST /api/sensors/data/batch`);
console.log(`   3. Make sure STA_LTA_ONLY_EVENTS=true in .env`);

