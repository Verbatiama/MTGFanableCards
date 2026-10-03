import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sizeSvg } from '../../src/render/svg.js';

test('an SVG with only a viewBox gets a pixel size; one with a size is left alone', () => {
  assert.equal(
    sizeSvg('<svg viewBox="0 0 50 25" xmlns="http://www.w3.org/2000/svg"></svg>'),
    '<svg width="240" height="120" viewBox="0 0 50 25" xmlns="http://www.w3.org/2000/svg"></svg>',
  );
  const sized = '<svg width="10" height="10" viewBox="0 0 10 10"></svg>';
  assert.equal(sizeSvg(sized), sized);
});
