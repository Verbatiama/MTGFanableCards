import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from 'canvas';
import { ART, ART_FADE, BOX, CARD } from '../../src/config/layout.js';
import { fitFont, textFont } from '../../src/render/fonts.js';
import { registerFonts, renderCardCanvas, renderCardPng } from '../../src/render/node.js';
import { loadCardFixture, loadCardFixtures } from '../fixtures/cards.js';

const pixel = (canvas, x, y) => [
  ...canvas.getContext('2d').getImageData(x, y, 1, 1).data.slice(0, 3),
];
const artCentre = [BOX.x + (BOX.right - BOX.x) / 2, ART.y + ART.h / 2];

test('cards are 750 × 1050 (3.5.1)', async () => {
  const canvas = await renderCardCanvas(loadCardFixture('lightning-strike'));
  assert.deepEqual([canvas.width, canvas.height], [CARD.width, CARD.height]);
});

test('every fixture renders', async () => {
  for (const [slug, model] of loadCardFixtures()) {
    const png = await renderCardPng(model);
    assert.ok(png.length > 1000, slug);
  }
});

test('rendering is deterministic', async () => {
  const model = loadCardFixture('niv-mizzet-the-firemind');
  assert.deepEqual(await renderCardPng(model), await renderCardPng(model));
});

test('art fills the art box; no art leaves it black (3.4.1)', async () => {
  const red = createCanvas(40, 30);
  const ctx = red.getContext('2d');
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, 40, 30);
  const model = loadCardFixture('lightning-strike');
  const withArt = await renderCardCanvas(model, { art: red.toBuffer('image/png') });
  assert.deepEqual(pixel(withArt, ...artCentre), [255, 0, 0]);
  const without = await renderCardCanvas(model);
  assert.deepEqual(pixel(without, ...artCentre), [0, 0, 0]);
  const broken = await renderCardCanvas(model, { art: Buffer.from('not an image') });
  assert.deepEqual(pixel(broken, ...artCentre), [0, 0, 0]);
});

test('the art fades in linearly from its left edge to the card box', async () => {
  const red = createCanvas(40, 30);
  const ctx = red.getContext('2d');
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, 40, 30);
  const canvas = await renderCardCanvas(loadCardFixture('lightning-strike'), {
    art: red.toBuffer('image/png'),
  });
  // Rows away from the stat bar's icons.
  const y = ART.y + ART.h - 20;
  const at = (fraction) =>
    pixel(canvas, Math.round(ART_FADE.from + (ART_FADE.to - ART_FADE.from) * fraction), y)[0];
  assert.ok(at(0) < 10, 'transparent at the left edge');
  assert.ok(Math.abs(at(0.5) - 128) < 12, 'half way');
  assert.deepEqual(pixel(canvas, ART_FADE.to + 2, y), [255, 0, 0]);
});

test('fitFont shrinks text to fit, down to the minimum', () => {
  registerFonts();
  const ctx = createCanvas(10, 10).getContext('2d');
  assert.equal(fitFont(ctx, 'Hi', 500, 30, textFont), 30);
  const fitted = fitFont(ctx, 'A much longer card name than fits', 200, 30, textFont);
  assert.ok(fitted < 30 && ctx.measureText('A much longer card name than fits').width <= 200);
  assert.equal(fitFont(ctx, 'x'.repeat(200), 10, 30, textFont, 12), 12);
});
