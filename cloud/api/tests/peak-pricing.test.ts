import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PEAK_WINDOWS, isPeakTime, parsePeakWindows, resolveRates, type ModelPricingInput } from '../src/billing/pricing.js';

const model = (overrides: Partial<ModelPricingInput> = {}): ModelPricingInput => ({
  inputPointsPerMillion: 10n,
  cachedInputPointsPerMillion: 2n,
  outputPointsPerMillion: 20n,
  peakInputPointsPerMillion: 20n,
  peakCachedInputPointsPerMillion: 4n,
  peakOutputPointsPerMillion: 40n,
  peakWindowsJson: null,
  ...overrides
});

/** 北京时间转 UTC 固定时刻。 */
const beijing = (hour: number) => new Date(Date.UTC(2026, 6, 20, hour - 8, 0, 0));

test('isPeakTime covers Beijing 9:00-12:00 and 14:00-18:00 with end-exclusive bounds', () => {
  assert.equal(isPeakTime(beijing(9), DEFAULT_PEAK_WINDOWS), true);
  assert.equal(isPeakTime(beijing(10), DEFAULT_PEAK_WINDOWS), true);
  assert.equal(isPeakTime(beijing(12), DEFAULT_PEAK_WINDOWS), false);
  assert.equal(isPeakTime(beijing(13), DEFAULT_PEAK_WINDOWS), false);
  assert.equal(isPeakTime(beijing(14), DEFAULT_PEAK_WINDOWS), true);
  assert.equal(isPeakTime(beijing(17), DEFAULT_PEAK_WINDOWS), true);
  assert.equal(isPeakTime(beijing(18), DEFAULT_PEAK_WINDOWS), false);
  assert.equal(isPeakTime(beijing(3), DEFAULT_PEAK_WINDOWS), false);
});

test('parsePeakWindows falls back to default windows on invalid or missing input', () => {
  assert.deepEqual(parsePeakWindows(null), DEFAULT_PEAK_WINDOWS);
  assert.deepEqual(parsePeakWindows('not-json'), DEFAULT_PEAK_WINDOWS);
  assert.deepEqual(parsePeakWindows(JSON.stringify([])), DEFAULT_PEAK_WINDOWS);
  assert.deepEqual(parsePeakWindows(JSON.stringify([{ startHour: 25, endHour: 3 }])), DEFAULT_PEAK_WINDOWS);
  assert.deepEqual(parsePeakWindows(JSON.stringify({ windows: [{ startHour: 20, endHour: 24 }] })), [{ startHour: 20, endHour: 24 }]);
  assert.deepEqual(parsePeakWindows(JSON.stringify([{ startHour: 0, endHour: 6 }])), [{ startHour: 0, endHour: 6 }]);
});

test('resolveRates applies peak rates only during configured peak hours', () => {
  const peak = resolveRates(model(), beijing(10));
  assert.deepEqual(peak, { input: 20n, cached: 4n, output: 40n, peak: true });
  const off = resolveRates(model(), beijing(13));
  assert.deepEqual(off, { input: 10n, cached: 2n, output: 20n, peak: false });
});

test('resolveRates keeps base rates when peak pricing is not fully configured', () => {
  const partial = resolveRates(model({ peakInputPointsPerMillion: 20n, peakCachedInputPointsPerMillion: null, peakOutputPointsPerMillion: 40n }), beijing(10));
  assert.deepEqual(partial, { input: 10n, cached: 2n, output: 20n, peak: false });
});

test('resolveRates honors custom peak windows', () => {
  const custom = model({ peakWindowsJson: JSON.stringify([{ startHour: 20, endHour: 23 }]) });
  assert.equal(resolveRates(custom, beijing(21)).peak, true);
  assert.equal(resolveRates(custom, beijing(10)).peak, false);
});
