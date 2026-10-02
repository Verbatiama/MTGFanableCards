import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRAME, LAND_FRAME } from '../../src/config/frames.js';
import { BOX, TYPE } from '../../src/config/layout.js';
import { framePalette, producedColours } from '../../src/render/frame.js';
import { renderCardCanvas } from '../../src/render/node.js';
import { loadCardFixture } from '../fixtures/cards.js';

const palette = (slug) => framePalette(loadCardFixture(slug));

test("one colour uses that colour's frame (6.6.1)", () => {
  assert.deepEqual(palette('damnation'), {
    border: [FRAME.B.border],
    pin: [FRAME.B.pin],
    bar: FRAME.B.bar,
    text: [FRAME.B.text],
    devoid: false,
  });
});

test('gold cards have pinlines in their two colours, printed order; three or more are gold (D21)', () => {
  const niv = palette('niv-mizzet-the-firemind');
  assert.deepEqual(niv.border, [FRAME.gold.border]);
  assert.deepEqual(niv.pin, [FRAME.U.pin, FRAME.R.pin]);
  assert.deepEqual(palette('atraxa-grand-unifier').pin, [FRAME.gold.pin]);
});

test('two-colour hybrid splits border, pinlines and text box; grey bars (6.6.2)', () => {
  for (const slug of ['kitchen-finks', 'ajani-sleeper-agent']) {
    const p = palette(slug);
    assert.deepEqual(p.border, [FRAME.G.border, FRAME.W.border], slug);
    assert.equal(p.bar, FRAME.hybridBar, slug);
    assert.equal(p.text.length, 2, slug);
  }
});

test('colourless: artifact frame for artifacts, colourless frame otherwise', () => {
  assert.deepEqual(palette('sword-of-fire-and-ice').border, [FRAME.artifact.border]);
  assert.deepEqual(palette('ugin-the-spirit-dragon').border, [FRAME.colourless.border]);
});

test('devoid shows the art through a translucent border', () => {
  const p = palette('complete-disregard');
  assert.equal(p.devoid, true);
  assert.match(p.border[0], /^rgba\(/);
});

test('lands: stone border, colour from the card or the mana it makes (D21)', () => {
  assert.deepEqual(palette('wasteland').pin, [LAND_FRAME.colourless.pin]);
  assert.deepEqual(palette('forest').pin, [LAND_FRAME.G.pin]);
  assert.deepEqual(palette('dryad-arbor').pin, [LAND_FRAME.G.pin]);
  const pool = palette('breeding-pool');
  assert.deepEqual(pool.pin, [LAND_FRAME.G.pin, LAND_FRAME.U.pin]);
  assert.equal(pool.bar, LAND_FRAME.splitBar);
  assert.deepEqual(palette('city-of-brass').pin, [LAND_FRAME.gold.pin]);
  for (const slug of ['wasteland', 'forest', 'breeding-pool']) {
    assert.deepEqual(palette(slug).border, [LAND_FRAME.stone], slug);
  }
});

test('produced colours come from "Add" text and basic land types', () => {
  assert.deepEqual(producedColours(loadCardFixture('breeding-pool')), ['G', 'U']);
  assert.deepEqual(producedColours(loadCardFixture('city-of-brass')), ['W', 'U', 'B', 'R', 'G']);
  assert.deepEqual(producedColours(loadCardFixture('wasteland')), []);
});

test('the set symbol is drawn at the right end of the type line, or the set code without one', async () => {
  const square = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#ff0000"/></svg>',
  );
  const model = loadCardFixture('lightning-strike');
  const x = BOX.right - 14 - 10;
  const y = TYPE.y + TYPE.h / 2;
  const pixel = (canvas) => [...canvas.getContext('2d').getImageData(x, y, 1, 1).data.slice(0, 3)];
  assert.deepEqual(pixel(await renderCardCanvas(model, { setSymbol: square })), [255, 0, 0]);
  assert.notDeepEqual(pixel(await renderCardCanvas(model)), [255, 0, 0]);
});
