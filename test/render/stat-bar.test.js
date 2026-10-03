import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INDICATOR } from '../../src/config/frames.js';
import {
  ART,
  BAR,
  BAR_BOTTOM,
  BAR_MIDDLE,
  BAR_TOP,
  BOX,
  CARD,
  TEXT,
  TYPE,
} from '../../src/config/layout.js';
import { renderCardCanvas } from '../../src/render/node.js';
import {
  bottomSectionTop,
  middleItems,
  statBarBottom,
  statBarMiddle,
  statBarTop,
} from '../../src/render/stat-bar.js';
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
    const right = BAR.x + BAR.width;
    assert.ok(row[0].x >= BAR.x && row.at(-1).x + row.at(-1).size <= right);
    assert.ok(Math.abs(row[0].x - BAR.x - (right - row.at(-1).x - row.at(-1).size)) < 1);
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

test('the colour indicator takes its own row only when present, pushing the mana down (5.2.4)', () => {
  const plain = top('niv-mizzet-the-firemind');
  assert.equal(plain.indicator, null);
  const marked = top('niv-mizzet-the-firemind', { colorIndicator: ['U', 'R'] });
  assert.deepEqual(marked.indicator.colours, ['U', 'R']);
  const { cy, r } = marked.indicator;
  assert.ok(marked.mana[0].pill.y >= cy + r + BAR_TOP.rowGap);
  assert.ok(marked.mana[0].y >= plain.mana[0].y);
});

test('one mana row per grouped symbol, in model order; no cost means no rows (5.3)', () => {
  const niv = top('niv-mizzet-the-firemind');
  assert.deepEqual(
    niv.mana.map((m) => `${m.symbol} ${m.count}`),
    ['U 2', 'R 2', 'generic 2'],
  );
  const pillH = BAR.icon + BAR_TOP.pill * 2;
  assert.deepEqual(
    niv.mana.map((m) => m.y - niv.mana[0].y),
    [0, 1, 2].map((i) => i * (pillH + BAR_TOP.mana.gap)),
  );
  assert.equal(niv.bottom, niv.mana.at(-1).pill.y + pillH);
  assert.deepEqual(top('ancestral-vision').mana, []);
});

test('the mana rows start below the top of the art and spread out over it (5.3.11)', () => {
  const [first, second] = top('niv-mizzet-the-firemind').mana;
  assert.equal(first.pill.y, ART.y + BAR_TOP.mana.top);
  assert.equal(second.pill.y - (first.pill.y + first.pill.h), BAR_TOP.mana.gap);
});

test('the mana rows close up only when they would not fit above the type line (5.3.11)', () => {
  const pillH = BAR.icon + BAR_TOP.pill * 2;
  const limit = TYPE.y - BAR_TOP.mana.bottom;
  const rows = (n) => Array.from({ length: n }, (_, i) => ({ symbol: 'generic', count: i }));
  const spread = top('niv-mizzet-the-firemind', { manaCost: rows(6) }).mana;
  assert.equal(spread[1].pill.y - spread[0].pill.y, pillH + BAR_TOP.mana.gap);
  assert.ok(spread.at(-1).pill.y + pillH <= limit);

  const many = top('niv-mizzet-the-firemind', { manaCost: rows(10) }).mana;
  const step = many[1].pill.y - many[0].pill.y;
  assert.ok(step < pillH + BAR_TOP.mana.gap && step >= pillH);
  assert.ok(Math.abs(many.at(-1).pill.y + pillH - limit) < 0.01);

  // A type line moved up (planeswalkers, T-B11) closes them up too.
  const model = { ...loadCardFixture('niv-mizzet-the-firemind'), manaCost: rows(6) };
  const raised = statBarTop(model, { type: { y: TYPE.y - 150 } }).mana;
  assert.ok(raised.at(-1).pill.y + pillH <= TYPE.y - 150 - BAR_TOP.mana.bottom + 0.01);
});

test('each mana row sits on a black pill; its count is centred between the symbol and the card box', async () => {
  const model = loadCardFixture('niv-mizzet-the-firemind');
  const canvas = await renderCardCanvas(model);
  for (const { x, y, size, countX, pill } of statBarTop(model).mana) {
    assert.equal(countX - (x + size), BOX.x - countX);
    // The pill covers the symbol and the count and ends at the frame.
    assert.ok(pill.x < x && pill.y < y && pill.y + pill.h > y + size);
    assert.equal(pill.x + pill.w, BOX.x - 4);
    // Black between the symbol and the count, over the art.
    assert.deepEqual(pixel(canvas, x + size + 3, y + size / 2), [0, 0, 0]);
  }
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
    const row = canvas.getContext('2d').getImageData(x, y, BAR.x + BAR.width - x, size).data;
    const lit = (from, to) => {
      for (let py = 0; py < size; py++)
        for (let px = from; px < to; px++)
          if (row[(py * (BAR.x + BAR.width - x) + px) * 4] > 100) return true;
      return false;
    };
    assert.ok(lit(0, size), 'symbol');
    assert.ok(lit(size + 2, BAR.x + BAR.width - x), 'count');
  }
});

const middle = (slug, changes = {}) => {
  const model = { ...loadCardFixture(slug), ...changes };
  return statBarMiddle(model, { from: statBarTop(model).bottom });
};

test('middle order: attaching subtypes, supertypes, zone/timing; only some labelled (5.6.1, 5.5.10)', () => {
  const items = middleItems({
    ...loadCardFixture('feral-invocation'),
    supertypes: ['Legendary', 'Snow'],
    zoneSymbols: ['flash', 'graveyard'],
  });
  assert.deepEqual(
    items.map((i) => `${i.key}:${i.label}`),
    ['Aura:null', 'Legendary:LEGENDARY', 'Snow:SNOW', 'flash:FLASH', 'graveyard:GRAVEYARD'],
  );
  // Subtypes without icons, and supertypes without icons, are skipped.
  assert.deepEqual(
    middleItems(loadCardFixture('ajani-sleeper-agent')).map((i) => i.key),
    ['Legendary'],
  );
  assert.deepEqual(middleItems(loadCardFixture('breeding-pool')), []);
});

test('the stack hangs from the top of the type line, in order (4.2, 5.6.2)', () => {
  const { stack, labels, scale } = middle('dark-depths');
  assert.equal(stack[0].y, TYPE.y);
  assert.deepEqual(
    stack.map((i) => i.key),
    ['Legendary', 'Snow'],
  );
  assert.ok(labels && scale === 1);
  assert.equal(stack[1].y, TYPE.y + BAR_MIDDLE.icon + BAR_MIDDLE.gap + BAR_MIDDLE.label);
  // Unlabelled subtype icons take no label room.
  const sword = middle('feral-invocation');
  assert.equal(sword.stack[1].y - sword.stack[0].y, BAR_MIDDLE.icon + BAR_MIDDLE.gap);
});

test("a planeswalker's stack grows up from the bottom of the type line (5.6.2)", () => {
  const { stack, bottom } = middle('ajani-sleeper-agent');
  assert.ok(stack[0].y < TYPE.y);
  assert.equal(bottom, TYPE.y + TYPE.h - 4);
});

test('a stack too long drops its labels, then shrinks to at most half size, never hidden (5.6.3)', () => {
  const lots = {
    supertypes: ['Legendary', 'Snow', 'World'],
    zoneSymbols: ['flash', 'split-second', 'hand', 'library', 'graveyard'],
  };
  const room = bottomSectionTop(loadCardFixture('niv-mizzet-the-firemind')) - TYPE.y;
  // As many labelled items as fit once their labels are dropped.
  const n = Math.floor(room / (BAR_MIDDLE.icon + BAR_MIDDLE.gap));
  assert.ok(n * (BAR_MIDDLE.icon + BAR_MIDDLE.label + BAR_MIDDLE.gap) > room);
  const unlabelled = middle('niv-mizzet-the-firemind', {
    supertypes: [],
    zoneSymbols: Array(n).fill('flash'),
  });
  assert.equal(unlabelled.labels, false);
  assert.equal(unlabelled.scale, 1);
  assert.ok(unlabelled.stack.every((i) => !i.labelled));
  assert.ok(unlabelled.bottom <= TYPE.y + room);

  const eight = middle('niv-mizzet-the-firemind', {
    ...lots,
    subtypes: ['Aura', 'Equipment', 'Fortification'],
  });
  assert.ok(eight.scale < 1 && eight.scale >= BAR_MIDDLE.minScale);
  assert.equal(eight.stack.length, 11);
  assert.equal(eight.overflow, null);

  const absurd = middle('niv-mizzet-the-firemind', {
    ...lots,
    zoneSymbols: Array(20).fill('flash'),
  });
  assert.equal(absurd.scale, BAR_MIDDLE.minScale);
  assert.equal(absurd.stack.length, 23);
  assert.ok(absurd.overflow);
});

test('land mana symbols are centred on the text box, pushed down by a long stack (5.5.8)', () => {
  const pool = middle('breeding-pool');
  assert.deepEqual(
    pool.land.map((l) => l.symbol),
    ['G', 'U'],
  );
  const centre = (pool.land[0].y + pool.land.at(-1).y + BAR.icon) / 2;
  assert.ok(Math.abs(centre - (TEXT.y + TEXT.h / 2 - BAR_MIDDLE.gap / 2)) < 1);

  const pushed = middle('dryad-arbor', {
    supertypes: ['Legendary', 'Snow', 'World'],
    zoneSymbols: ['flash', 'split-second', 'hand', 'library', 'graveyard'],
  });
  assert.ok(pushed.land[0].y >= pushed.bottom + BAR_MIDDLE.gap - 0.01);
  // The stack leaves the land symbol room above the bottom section.
  assert.ok(pushed.land[0].y + BAR.icon <= bottomSectionTop(loadCardFixture('dryad-arbor')) + 0.5);
});

test('the middle stack is drawn beside the type line', async () => {
  const model = loadCardFixture('dark-depths');
  const canvas = await renderCardCanvas(model);
  const [legendary] = statBarMiddle(model, { from: statBarTop(model).bottom }).stack;
  const data = canvas
    .getContext('2d')
    .getImageData(BAR.x, legendary.y, BAR.width, legendary.size).data;
  assert.ok(data.some((v, i) => i % 4 === 0 && v > 200));
});

const bottom = (slug, changes = {}) => statBarBottom({ ...loadCardFixture(slug), ...changes });

test('the bottom shows stats, loyalty, defense, NON-PERMANENT, or nothing (5.7, D18)', () => {
  assert.equal(bottom('niv-mizzet-the-firemind').kind, 'stats');
  assert.deepEqual(
    [bottom('jace-the-mind-sculptor').kind, bottom('jace-the-mind-sculptor').value],
    ['loyalty', '3'],
  );
  assert.deepEqual(
    [bottom('invasion-of-zendikar').kind, bottom('invasion-of-zendikar').value],
    ['defense', '3'],
  );
  for (const slug of ['lightning-strike', 'damnation', 'ancestral-vision']) {
    const label = bottom(slug);
    assert.equal(label.kind, 'label', slug);
    assert.equal(label.letters.join(''), 'NON-PERMANENT');
  }
  // Permanents never get a label (5.7.3–5.7.4).
  for (const slug of [
    'sword-of-fire-and-ice',
    'feral-invocation',
    'breeding-pool',
    'bitterblossom',
  ]) {
    assert.equal(bottom(slug).kind, null, slug);
  }
});

test('vehicles and spacecraft have hollow stats; creatures solid (5.7.7)', () => {
  assert.equal(bottom('niv-mizzet-the-firemind').hollow, false);
  assert.equal(bottom('smugglers-copter').hollow, true);
  assert.equal(bottom('wurmwall-sweeper').hollow, true);
  // An artifact creature is a creature.
  assert.equal(bottom('wurmcoil-engine').hollow, false);
});

test('the bottom section is anchored to the bottom of the bar; the middle stack stops above it', () => {
  const edge = CARD.height - BAR_BOTTOM.edge;
  const stats = bottom('niv-mizzet-the-firemind');
  assert.deepEqual(
    [stats.powerY, stats.dividerY, stats.toughnessY].map((y) => edge - y),
    [BAR_BOTTOM.stats.power, BAR_BOTTOM.stats.divider, BAR_BOTTOM.stats.toughness],
  );
  for (const slug of ['niv-mizzet-the-firemind', 'invasion-of-zendikar', 'lightning-strike']) {
    const model = loadCardFixture(slug);
    assert.equal(bottomSectionTop(model), statBarBottom(model).top - BAR_BOTTOM.gap, slug);
  }
  // The label's first letter is its top.
  const label = bottom('lightning-strike');
  assert.equal(label.top, edge - 12 * BAR_BOTTOM.label.step - BAR_BOTTOM.label.size);
  // Nothing at the bottom: the stack may run to the bar's bottom edge.
  assert.equal(bottomSectionTop(loadCardFixture('sword-of-fire-and-ice')), edge);
});

const lit = (canvas, x, y, w, h) =>
  canvas
    .getContext('2d')
    .getImageData(x, y, w, h)
    .data.some((v, i) => i % 4 !== 3 && v > 128);

test('stats, badges and labels are drawn; permanents with nothing leave the bottom empty', async () => {
  const area = (canvas, top) =>
    lit(canvas, BAR.x, top, BAR.width, CARD.height - BAR_BOTTOM.edge - top);
  for (const slug of [
    'tarmogoyf',
    'smugglers-copter',
    'invasion-of-zendikar',
    'lightning-strike',
  ]) {
    const model = loadCardFixture(slug);
    assert.ok(area(await renderCardCanvas(model), statBarBottom(model).top), slug);
  }
  const sword = loadCardFixture('sword-of-fire-and-ice');
  assert.ok(!area(await renderCardCanvas(sword), CARD.height - 300));
});

test("a hollow stat's icon is an outline: white edge, dark inside (5.7.7)", async () => {
  const model = loadCardFixture('smugglers-copter');
  const { toughnessY } = statBarBottom(model);
  const { value, icon } = BAR_BOTTOM.stats;
  const shield = async (m) =>
    (await renderCardCanvas(m))
      .getContext('2d')
      .getImageData(BAR.x + BAR.width / 2 - icon / 2, toughnessY + value, icon, icon).data;
  const hollow = await shield(model);
  const solid = await shield({ ...model, types: ['Artifact', 'Creature'] });
  let edge = 0;
  let inside = 0;
  for (let i = 0; i < hollow.length; i += 4) {
    if (hollow[i] > 200) edge++;
    if (solid[i] > 200 && hollow[i] < 60) inside++;
  }
  assert.ok(edge > 0, 'white outline');
  assert.ok(inside > 10, 'dark where the solid icon is white');
});
