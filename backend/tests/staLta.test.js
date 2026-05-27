const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const staLta = require('../src/utils/staLta');
const { loadBatchFixture, magnitudesFromData } = require('./helpers/batchFixture');

describe('STA/LTA unit tests', () => {
  it('returns insufficient data when fewer than 550 samples', () => {
    const mags = new Array(100).fill(0.01);
    const result = staLta.quickDetect(mags);
    assert.equal(result.triggered, false);
    assert.match(result.message, /Insufficient/);
  });

  it('triggers on earthquake-like batch fixture', () => {
    const { data } = loadBatchFixture('test_batch_550_points.json');
    const mags = magnitudesFromData(data);
    const result = staLta.quickDetect(mags, { triggerThreshold: 3.0 });
    assert.equal(result.triggered, true);
    assert.ok(result.ratio >= 3.0, `expected ratio >= 3, got ${result.ratio}`);
  });

  it('does not trigger on noise-like batch fixture', () => {
    const { data } = loadBatchFixture('test_batch_550_noise_points.json');
    const mags = magnitudesFromData(data);
    const result = staLta.quickDetect(mags, { triggerThreshold: 3.0 });
    assert.equal(result.triggered, false);
    assert.ok(result.ratio < 3.0, `expected ratio < 3, got ${result.ratio}`);
  });

  it('calculateRatio increases after sudden amplitude jump', () => {
    const quiet = new Array(500).fill(0.01);
    const jump = new Array(50).fill(0.8);
    const signal = [...quiet, ...jump];
    const ratioEnd = staLta.calculateRatio(signal, signal.length - 1);
    const ratioMid = staLta.calculateRatio(signal, 520);
    assert.ok(ratioEnd > ratioMid);
    assert.ok(ratioEnd > 3);
  });
});
