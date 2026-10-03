import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from 'canvas';
import { FRAME, LAND_FRAME } from '../../src/config/frames.js';
import { ART, BOX, TYPE } from '../../src/config/layout.js';
import { framePalette, mix, producedColours } from '../../src/render/frame.js';
import { renderCardCanvas } from '../../src/render/node.js';
import { loadCardFixture } from '../fixtures/cards.js';

const palette = (slug) => framePalette(loadCardFixture(slug));

test("one colour uses that colour's frame (6.6.1)", () => {
  assert.deepEqual(palette('damnation'), {
    pin: [FRAME.B.pin],
    bar: FRAME.B.bar,
    text: [FRAME.B.text],
  });
});

test('gold cards have pinlines in their two colours, printed order; three or more are gold (D21)', () => {
  const niv = palette('niv-mizzet-the-firemind');
  assert.equal(niv.bar, FRAME.gold.bar);
  assert.deepEqual(niv.pin, [FRAME.U.pin, FRAME.R.pin]);
  assert.deepEqual(palette('atraxa-grand-unifier').pin, [FRAME.gold.pin]);
});

test('two-colour hybrid splits pinlines and text box; grey bars (6.6.2)', () => {
  for (const slug of ['kitchen-finks', 'ajani-sleeper-agent']) {
    const p = palette(slug);
    assert.deepEqual(p.pin, [FRAME.G.pin, FRAME.W.pin], slug);
    assert.equal(p.bar, FRAME.hybridBar, slug);
    assert.equal(p.text.length, 2, slug);
  }
});

test('colourless: artifact frame for artifacts, colourless frame otherwise', () => {
  assert.equal(palette('sword-of-fire-and-ice').bar, FRAME.artifact.bar);
  assert.equal(palette('ugin-the-spirit-dragon').bar, FRAME.colourless.bar);
});

test('devoid has its own frame colours, on black like every other frame', async () => {
  assert.deepEqual(palette('complete-disregard'), {
    pin: [FRAME.devoid.pin],
    bar: FRAME.devoid.bar,
    text: [FRAME.devoid.text],
  });
  // Right of the art, where the old translucent border showed the art.
  const red = createCanvas(40, 30);
  red.getContext('2d').fillStyle = '#ff0000';
  red.getContext('2d').fillRect(0, 0, 40, 30);
  const canvas = await renderCardCanvas(loadCardFixture('complete-disregard'), {
    art: red.toBuffer('image/png'),
  });
  const [r, g, b] = canvas.getContext('2d').getImageData(BOX.right - 3, ART.y + 200, 1, 1).data;
  assert.deepEqual([r, g, b], [0, 0, 0]);
});

test('lands: pink-tan bars, colour from the card or the mana it makes (D21, C18)', () => {
  const wasteland = palette('wasteland');
  assert.deepEqual(wasteland.pin, [LAND_FRAME.pin]);
  assert.deepEqual(wasteland.text, [LAND_FRAME.text]);
  assert.deepEqual(palette('forest').pin, [FRAME.G.pin]);
  assert.deepEqual(palette('dryad-arbor').pin, [FRAME.G.pin]);
  const pool = palette('breeding-pool');
  assert.deepEqual(pool.pin, [FRAME.G.pin, FRAME.U.pin]);
  assert.deepEqual(pool.text, [
    mix(LAND_FRAME.text, FRAME.G.text, 0.5),
    mix(LAND_FRAME.text, FRAME.U.text, 0.5),
  ]);
  assert.deepEqual(palette('city-of-brass').pin, [FRAME.gold.pin]);
  for (const slug of ['wasteland', 'forest', 'breeding-pool', 'city-of-brass']) {
    assert.equal(palette(slug).bar, LAND_FRAME.bar, slug);
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
