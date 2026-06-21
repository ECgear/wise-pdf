import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, DEFAULT_LEVEL, levelParams } from '../dist/index.js';

test('three levels exist with the expected strategies', () => {
  assert.equal(LEVELS.low.strategy, 'recompress');
  assert.equal(LEVELS.recommended.strategy, 'recompress');
  assert.equal(LEVELS.maximum.strategy, 'rasterize');
});

test('quality and dpi cap decrease from low -> recommended -> maximum', () => {
  assert.ok(LEVELS.low.jpegQuality > LEVELS.recommended.jpegQuality);
  assert.ok(LEVELS.recommended.jpegQuality > LEVELS.maximum.jpegQuality);
  assert.ok(LEVELS.low.dpiCap > LEVELS.recommended.dpiCap);
  assert.ok(LEVELS.recommended.dpiCap > LEVELS.maximum.dpiCap);
});

test('text is preserved on low/recommended but not maximum', () => {
  assert.equal(LEVELS.low.textPreserved, true);
  assert.equal(LEVELS.recommended.textPreserved, true);
  assert.equal(LEVELS.maximum.textPreserved, false);
});

test('default level is recommended and levelParams falls back to it', () => {
  assert.equal(DEFAULT_LEVEL, 'recommended');
  assert.deepEqual(levelParams(undefined), LEVELS.recommended);
  assert.deepEqual(levelParams('low'), LEVELS.low);
});
