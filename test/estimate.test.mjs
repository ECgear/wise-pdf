import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateCompressedSize } from '../dist/index.js';

test('image-heavy PDF shrinks the image portion on recommended', () => {
  const r = estimateCompressedSize({ originalSize: 1000, imageBytes: 800, level: 'recommended' });
  assert.equal(r.estimatedSize, 600); // 200 non-image + 800 * 0.5
  assert.equal(r.confidence, 'high');
});

test('text-only PDF barely shrinks on recommended', () => {
  const r = estimateCompressedSize({ originalSize: 1000, imageBytes: 0, level: 'recommended' });
  assert.equal(r.estimatedSize, 1000);
  assert.equal(r.confidence, 'low');
});

test('low compresses less than recommended for the same input', () => {
  const low = estimateCompressedSize({ originalSize: 1000, imageBytes: 800, level: 'low' });
  const rec = estimateCompressedSize({ originalSize: 1000, imageBytes: 800, level: 'recommended' });
  assert.ok(low.estimatedSize > rec.estimatedSize);
});

test('maximum estimates an aggressive ratio with low confidence', () => {
  const r = estimateCompressedSize({ originalSize: 1000, imageBytes: 0, level: 'maximum' });
  assert.ok(r.estimatedSize < 1000);
  assert.equal(r.confidence, 'low');
});

test('estimate never exceeds the original size', () => {
  const r = estimateCompressedSize({ originalSize: 100, imageBytes: 100, level: 'low' });
  assert.ok(r.estimatedSize <= 100);
});
