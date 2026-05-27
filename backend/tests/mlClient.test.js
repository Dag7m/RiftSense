const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractFeatures } = require('../src/utils/mlClient');
const { loadBatchFixture } = require('./helpers/batchFixture');

describe('ML client feature extraction unit tests', () => {
  it('returns zeros for empty sensor data', () => {
    const f = extractFeatures([]);
    assert.equal(f.magnitude, 0);
    assert.equal(f.sample_count, 0);
    assert.equal(f.duration_ms, 0);
  });

  it('computes max magnitude and sample_count for batch fixture', () => {
    const { data } = loadBatchFixture('test_batch_550_points.json');
    const f = extractFeatures(data);
    assert.equal(f.sample_count, 550);
    assert.ok(f.magnitude > 0.4);
    assert.equal(f.peak_acceleration, f.magnitude);
    assert.ok(f.duration_ms > 0);
    assert.ok(f.avg_magnitude > 0);
    assert.ok(f.std_magnitude >= 0);
  });

  it('noise fixture has lower peak magnitude than earthquake fixture', () => {
    const eq = extractFeatures(loadBatchFixture('test_batch_550_points.json').data);
    const noise = extractFeatures(loadBatchFixture('test_batch_550_noise_points.json').data);
    assert.ok(noise.magnitude < eq.magnitude);
    assert.ok(noise.avg_magnitude < eq.avg_magnitude);
  });

  it('unknown fixture sits between noise and earthquake peaks', () => {
    const eq = extractFeatures(loadBatchFixture('test_batch_550_points.json').data);
    const noise = extractFeatures(loadBatchFixture('test_batch_550_noise_points.json').data);
    const unk = extractFeatures(loadBatchFixture('test_batch_550_unknown_points.json').data);
    assert.ok(unk.magnitude > noise.magnitude);
    assert.ok(unk.magnitude < eq.magnitude);
  });
});
