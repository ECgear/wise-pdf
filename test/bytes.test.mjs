import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtBytes, savedPercent } from '../dist/index.js';

test('fmtBytes formats B / KB / MB', () => {
  assert.equal(fmtBytes(512), '512 B');
  assert.equal(fmtBytes(1536), '1.5 KB');
  assert.equal(fmtBytes(1572864), '1.50 MB');
  assert.equal(fmtBytes(-1), '—');
});

test('savedPercent computes reduction percentage', () => {
  assert.equal(savedPercent(1000, 500), 50);
  assert.equal(savedPercent(1000, 1000), 0);
  assert.equal(savedPercent(1000, 1200), -20);
  assert.equal(savedPercent(0, 0), 0);
});
