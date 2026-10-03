import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from 'canvas';
import { BOX, CARD, FOOTER } from '../../src/config/layout.js';
import { copyrightLine, drawFooter } from '../../src/render/footer.js';
import { nodeAssets, registerFonts } from '../../src/render/node.js';
import { loadCardFixture } from '../fixtures/cards.js';

registerFonts();

/** Renders just the footer onto black; returns the canvas and the text drawn. */
async function footer(model, options = {}) {
  const canvas = createCanvas(CARD.width, CARD.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CARD.width, CARD.height);
  const drawn = [];
  const fillText = ctx.fillText.bind(ctx);
  ctx.fillText = (text, x, y) => {
    drawn.push({ text, x, align: ctx.textAlign, width: ctx.measureText(text).width });
    fillText(text, x, y);
  };
  await drawFooter(ctx, model, { assets: nodeAssets, ...options });
  return { canvas, drawn };
}

const lit = (canvas, x, y, w, h) =>
  canvas
    .getContext('2d')
    .getImageData(x, y, w, h)
    .data.some((v, i) => i % 4 !== 3 && v > 128);

test('the footer has number and rarity, set and language, artist and copyright (6.5.1)', async () => {
  const { drawn } = await footer(loadCardFixture('lightning-strike'), { year: 2031 });
  assert.deepEqual(
    drawn.map((d) => d.text),
    ['152 U', 'M19 - EN', 'ADAM PAQUETTE', '™ & © 2031 Wizards of the Coast'],
  );
});

test('the copyright year is the year the image is generated (6.5.2)', async () => {
  assert.equal(copyrightLine(2026), '™ & © 2026 Wizards of the Coast');
  const { drawn } = await footer(loadCardFixture('lightning-strike'));
  assert.equal(drawn.at(-1).text, copyrightLine(new Date().getFullYear()));
});

test('the paintbrush is drawn left of the artist name', async () => {
  const { canvas, drawn } = await footer(loadCardFixture('lightning-strike'));
  const artist = drawn.find((d) => d.text === 'ADAM PAQUETTE');
  const nameLeft = BOX.right - artist.width;
  assert.ok(lit(canvas, nameLeft - 28, FOOTER.y, 25, 24));
});

test('the centre of the footer stays empty: no holo stamp (6.5.3)', async () => {
  const { canvas } = await footer(loadCardFixture('niv-mizzet-the-firemind'));
  assert.ok(!lit(canvas, CARD.width / 2 - 40, FOOTER.y, 80, CARD.height - FOOTER.y));
});

test('a long artist name shrinks and stays clear of the left column', async () => {
  const model = {
    ...loadCardFixture('lightning-strike'),
    artist: 'Somebody With A Very Long Name & Another Artist Entirely',
  };
  const { drawn } = await footer(model);
  const artist = drawn.find((d) => d.text === model.artist.toUpperCase());
  assert.ok(BOX.right - artist.width >= BOX.x + 160);
});
