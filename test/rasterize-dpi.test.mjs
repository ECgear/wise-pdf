import test from 'node:test';
import assert from 'node:assert/strict';
import { targetRasterDpi } from '../dist/index.js';

test('targetRasterDpi lowers the DPI when rasterizing exceeds the input', () => {
  // 120dpi produced ~3.65MB for a 2.78MB input → the next DPI must drop below 120.
  const next = targetRasterDpi(120, 3_650_000, 2_780_000);
  assert.ok(next < 120, `expected < 120, got ${next}`);
  assert.ok(next >= 50, `expected >= floor 50, got ${next}`);
  // ≈ 120 * sqrt(0.8 * 2.78 / 3.65) ≈ 93
  assert.ok(next >= 85 && next <= 100, `expected ~93, got ${next}`);
});

test('targetRasterDpi clamps to the minimum DPI floor', () => {
  assert.equal(targetRasterDpi(120, 50_000_000, 1_000_000), 50);
  assert.equal(targetRasterDpi(120, 50_000_000, 1_000_000, { minDpi: 36 }), 36);
});

test('targetRasterDpi always strictly decreases and stays at/above the floor', () => {
  for (const dpi of [120, 96, 72, 60, 51]) {
    const next = targetRasterDpi(dpi, 5_000_000, 2_000_000);
    assert.ok(next < dpi, `next ${next} should be < ${dpi}`);
    assert.ok(next >= 50, `next ${next} should be >= 50`);
  }
});

test('targetRasterDpi honors a custom ratio (more aggressive → lower DPI)', () => {
  const mild = targetRasterDpi(120, 3_000_000, 2_500_000, { ratio: 0.9 });
  const aggressive = targetRasterDpi(120, 3_000_000, 2_500_000, { ratio: 0.5 });
  assert.ok(aggressive < mild, `aggressive ${aggressive} should be < mild ${mild}`);
});
