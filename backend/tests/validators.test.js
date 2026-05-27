const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sensorDataSchema, sensorDataBatchSchema } = require('../src/utils/validators');

describe('Request validation unit tests', () => {
  it('accepts valid single sensor reading', () => {
    const { error } = sensorDataSchema.validate({
      node_id: 'ESP32_NODE_001',
      x: 0.01,
      y: 0.02,
      z: 0.01,
      sampling_rate: 100,
      timestamp: new Date().toISOString()
    });
    assert.equal(error, undefined);
  });

  it('rejects missing node_id', () => {
    const { error } = sensorDataSchema.validate({ x: 0.1, y: 0.1, z: 0.1 });
    assert.ok(error);
  });

  it('accepts valid batch payload shape', () => {
    const points = Array.from({ length: 3 }, (_, i) => ({
      x: 0.01,
      y: 0.01,
      z: 0.01,
      timestamp: new Date(Date.now() + i * 100).toISOString()
    }));
    const { error } = sensorDataBatchSchema.validate({
      node_id: 'ESP32_NODE_001',
      sampling_rate: 100,
      data: points
    });
    assert.equal(error, undefined);
  });

  it('rejects empty batch data array', () => {
    const { error } = sensorDataBatchSchema.validate({
      node_id: 'ESP32_NODE_001',
      data: []
    });
    assert.ok(error);
  });
});
