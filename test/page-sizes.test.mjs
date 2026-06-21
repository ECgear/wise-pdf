import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePageSize, fitRect } from '../dist/index.js';

test('fit page size maps pixels to points 1:1 and keeps auto orientation', () => {
  assert.deepEqual(resolvePageSize('fit', 'auto', 800, 600), { width: 800, height: 600 });
  const portrait = resolvePageSize('fit', 'portrait', 800, 600);
  assert.ok(portrait.height >= portrait.width);
});

test('a4 portrait and landscape dimensions', () => {
  const a4p = resolvePageSize('a4', 'portrait', 100, 200);
  assert.deepEqual([Math.round(a4p.width), Math.round(a4p.height)], [595, 842]);
  const a4l = resolvePageSize('a4', 'landscape', 100, 200);
  assert.ok(a4l.width > a4l.height);
});

test('fitRect contain fits inside the box and centers', () => {
  const r = fitRect(200, 100, 100, 100, 'contain');
  assert.equal(r.width, 100);
  assert.equal(r.height, 50);
  assert.equal(r.x, 0);
  assert.equal(r.y, 25);
});

test('fitRect cover fills the box', () => {
  const r = fitRect(200, 100, 100, 100, 'cover');
  assert.equal(r.width, 200);
  assert.equal(r.height, 100);
});

test('fitRect actual keeps native size', () => {
  const r = fitRect(50, 40, 100, 100, 'actual');
  assert.equal(r.width, 50);
  assert.equal(r.height, 40);
});
