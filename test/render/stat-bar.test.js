import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INDICATOR } from '../../src/config/frames.js';
import { BAR, BAR_TOP } from '../../src/config/layout.js';
import { renderCardCanvas } from '../../src/render/node.js';
import { statBarTop } from '../../src/render/stat-bar.js';
import { loadCardFixture } from '../fixtures/cards.js';

const top = (slug, changes = {}) => statBarTop({ ...loadCardFixture(slug), ...changes });
const pixel = (canvas, x, y) => [
  ...canvas.getContext('2d').getImageData(x, y, 1, 1).data.slice(0, 3),
];
const hex = (colour) => [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));

test('one type icon at full size; several share one row in type-line order (5.1.2–5.1.3)', () => {
  const [one] = top('niv-mizzet-the-firemind').types;
  assert.equal(one.size, BAR_TOP.typeRow);

  const two = top('wurmcoil-engine').types;
  assert.deepEqual(
    two.map((t) => t.type),
    ['Artifact', 'Creature'],
  );
  assert.ok(two[0].size < BAR_TOP.typeRow && two[0].size >= 38);

  const three = top('wurmcoil-engine', { types: ['Kindred', 'Artifact', 'Creature'] }).types;
  assert.ok(three[0].size >= 25 && three[0].size <= 30);
  for (const row of [two, three]) {
    // Inside the bar, centred, all on one row.
    assert.ok(row[0].x >= 0 && row.at(-1).x + row.at(-1).size <= BAR.width);
    assert.ok(Math.abs(row[0].x - (BAR.width - row.at(-1).x - row.at(-1).size)) < 1);
    assert.equal(new Set(row.map((t) => t.y)).size, 1);
  }
});

test('types without an icon are skipped, and the mana block does not move (5.1.3–5.1.4)', () => {
  const plain = top('niv-mizzet-the-firemind');
  const dungeon = top('niv-mizzet-the-firemind', { types: ['Dungeon'] });
  assert.deepEqual(dungeon.types, []);
  assert.deepEqual(dungeon.mana, plain.mana);
  assert.deepEqual(top('wurmcoil-engine').mana[0].y, plain.mana[0].y);
});

test('the colour indicator takes its own row only when present (5.2.4)', () => {
  const plain = top('niv-mizzet-the-firemind');
  assert.equal(plain.indicator, null);
  const marked = top('niv-mizzet-the-firemind', { colorIndicator: ['U', 'R'] });
  assert.deepEqual(marked.indicator.colours, ['U', 'R']);
  assert.equal(marked.mana[0].y - plain.mana[0].y, BAR_TOP.indicator * 2 + BAR_TOP.rowGap);
});

test('one mana row per grouped symbol, in model order; no cost means no rows (5.3)', () => {
  const niv = top('niv-mizzet-the-firemind');
  assert.deepEqual(
    niv.mana.map((m) => `${m.symbol} ${m.count}`),
    ['U 2', 'R 2', 'generic 2'],
  );
  assert.deepEqual(
    niv.mana.map((m) => m.y - niv.mana[0].y),
    [0, 1, 2].map((i) => i * (BAR.icon + BAR.gap)),
  );
  assert.equal(niv.bottom, niv.mana.at(-1).y + BAR.icon + BAR.gap);
  assert.deepEqual(top('ancestral-vision').mana, []);
});

test('the indicator is drawn as one circle, a wedge per colour clockwise from the top (5.2.3)', async () => {
  const solid = await renderCardCanvas(loadCardFixture('ancestral-vision'));
  const { cx, cy, r } = top('ancestral-vision').indicator;
  assert.deepEqual(pixel(solid, cx, cy + r / 2), hex(INDICATOR.U));

  // U, B, R: blue top right, black at the bottom, red top left.
  const model = loadCardFixture('nicol-bolas-the-arisen');
  const bolas = await renderCardCanvas(model);
  const ind = statBarTop(model).indicator;
  const at = (deg) => {
    const a = (deg * Math.PI) / 180;
    return pixel(
      bolas,
      Math.round(ind.cx + Math.cos(a) * ind.r * 0.6),
      Math.round(ind.cy + Math.sin(a) * ind.r * 0.6),
    );
  };
  assert.deepEqual(at(-30), hex(INDICATOR.U));
  assert.deepEqual(at(90), hex(INDICATOR.B));
  assert.deepEqual(at(210), hex(INDICATOR.R));
});

test('the mana block draws a symbol and its count on each row', async () => {
  const model = loadCardFixture('niv-mizzet-the-firemind');
  const canvas = await renderCardCanvas(model);
  for (const { x, y, size } of statBarTop(model).mana) {
    const row = canvas.getContext('2d').getImageData(x, y, BAR.width - x, size).data;
    const lit = (from, to) => {
      for (let py = 0; py < size; py++)
        for (let px = from; px < to; px++)
          if (row[(py * (BAR.width - x) + px) * 4] > 100) return true;
      return false;
    };
    assert.ok(lit(0, size), 'symbol');
    assert.ok(lit(size + 2, BAR.width - x), 'count');
  }
});
