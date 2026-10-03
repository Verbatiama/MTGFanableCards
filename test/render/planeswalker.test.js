import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from 'canvas';
import { ART, BAR, CARD, TEXT, TEXT_SIZE, TYPE } from '../../src/config/layout.js';
import { nodeAssets, nodeEnv, registerFonts, renderCardCanvas } from '../../src/render/node.js';
import { cardLayout, costBadge } from '../../src/render/planeswalker.js';
import { renderCard } from '../../src/render/render-card.js';
import { loadCardFixture } from '../fixtures/cards.js';

registerFonts();
const ctx = createCanvas(10, 10).getContext('2d');
const layout = (slug, changes = {}) => cardLayout(ctx, { ...loadCardFixture(slug), ...changes });
const pixel = (canvas, x, y) => [
  ...canvas.getContext('2d').getImageData(x, y, 1, 1).data.slice(0, 3),
];

test('other cards keep the standard bands', () => {
  assert.deepEqual(layout('niv-mizzet-the-firemind'), {
    art: ART,
    type: TYPE,
    text: TEXT,
    pw: null,
  });
});

test('one equal band per Oracle line, filling the text box, with its cost (7.2.4, 7.2.6)', () => {
  const { text, pw } = layout('jace-the-mind-sculptor');
  assert.deepEqual(text, TEXT);
  assert.deepEqual(
    pw.bands.map((b) => b.cost),
    ['+2', '0', '−1', '−12'],
  );
  const h = TEXT.h / 4;
  pw.bands.forEach((b, i) => {
    assert.equal(b.h, h);
    assert.equal(b.top, TEXT.y + i * h);
  });
  assert.ok(pw.size <= TEXT_SIZE.rules && pw.size >= TEXT_SIZE.minRules);
  // The longest ability fits its band.
  for (const b of pw.bands) assert.ok(b.layout.height <= b.h);

  // Static abilities get a band with no cost (7.2.4).
  assert.deepEqual(
    layout('teferi-time-raveler').pw.bands.map((b) => b.cost),
    [null, '+1', '−3'],
  );
});

test('±X costs use the same badges as numbers (7.2.7, D22)', () => {
  assert.deepEqual(
    layout('ugin-the-spirit-dragon').pw.bands.map((b) => b.cost),
    ['+2', '−X', '−10'],
  );
  assert.deepEqual(['+2', '+X', '0', '−X', '−10'].map(costBadge), [
    'up',
    'up',
    'zero',
    'down',
    'down',
  ]);
});

test('too many abilities: the text box grows into the art, moving the type line up (7.2.6)', () => {
  const lines = Array.from(
    { length: 9 },
    (_, i) =>
      `−${i}: Target player reveals the top five cards of their library and does something long.`,
  );
  const { art, type, text, pw } = layout('jace-the-mind-sculptor', {
    oracleText: lines.join('\n'),
  });
  assert.equal(pw.size, TEXT_SIZE.minRules);
  const grow = TEXT.y - text.y;
  assert.ok(grow > 0);
  assert.equal(text.y + text.h, TEXT.y + TEXT.h);
  assert.equal(type.y, TYPE.y - grow);
  assert.equal(art.h, ART.h - grow);
  assert.equal(pw.bands.length, 9);
});

test('loyalty costs are drawn centred on their bands; static abilities have none (7.2.1)', async () => {
  const model = loadCardFixture('teferi-time-raveler');
  const canvas = await renderCardCanvas(model);
  const cx = BAR.x + BAR.width / 2;
  const [stat, plus, minus] = layout('teferi-time-raveler').pw.bands;
  const lit = (band) => {
    const data = canvas
      .getContext('2d')
      .getImageData(cx - 20, band.top + band.h / 2 - 20, 40, 40).data;
    return data.some((v, i) => i % 4 !== 3 && v > 200);
  };
  assert.ok(lit(plus) && lit(minus));
  assert.ok(!lit(stat));
});

test('every other band is shaded (7.2.2)', async () => {
  const canvas = await renderCardCanvas(loadCardFixture('jace-the-mind-sculptor'));
  const [first, second] = layout('jace-the-mind-sculptor').pw.bands;
  // The text box's right margin, clear of the text.
  const x = 700;
  const plain = pixel(canvas, x, first.top + 4);
  const shaded = pixel(canvas, x, second.top + 4);
  assert.ok(shaded.every((v, i) => v < plain[i]));
});

test('abilities that need more room than the art has are reported (D19, D20)', async () => {
  const model = {
    ...loadCardFixture('jace-the-mind-sculptor'),
    oracleText: Array(40).fill('+1: Draw a card, then discard a card.').join('\n'),
  };
  const { warnings } = await renderCard(
    createCanvas(CARD.width, CARD.height).getContext('2d'),
    model,
    {
      env: nodeEnv,
      assets: nodeAssets,
    },
  );
  assert.ok(warnings.some((w) => w.includes('abilities')));
});
