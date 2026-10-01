import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { loadImage } from 'canvas';
import { SYMBOL_DIR } from '../src/index.js';

const svgs = (await readdir(SYMBOL_DIR, { recursive: true }))
  .filter((f) => f.endsWith('.svg') && f !== 'symbols.svg')
  .sort();

test('symbol directory has the traced symbols', () => {
  for (const name of [
    'generic.svg',
    'types/creature.svg',
    'zones/hand.svg',
    'stats/toughness.svg',
  ]) {
    assert.ok(svgs.includes(name), name);
  }
});

test('every symbol is a 100x100 SVG that node-canvas can load', async () => {
  for (const name of svgs) {
    const bytes = await readFile(path.join(SYMBOL_DIR, name));
    assert.match(bytes.toString(), /viewBox="0 0 100 100"/, name);
    const img = await loadImage(bytes);
    assert.equal(img.width, 100, name);
  }
});
