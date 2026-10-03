import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCardModel } from '../../src/model/card-model.js';
import { mapCard } from '../../src/model/from-scryfall.js';
import { tokenizeLine } from '../../src/parse/oracle-text.js';
import { nodeAssets, renderCardCanvas } from '../../src/render/node.js';
import { statBarTop } from '../../src/render/stat-bar.js';

/**
 * Edge cases from real Scryfall JSON (T-S5, Requirements 5): hybrid costs,
 * XX costs, colour indicators and multi-type cards, beyond the hand-written
 * fixtures. test/fixtures/scryfall/edge-cases.json holds the printings as the
 * card database stores them.
 */
const PRINTINGS = JSON.parse(
  readFileSync(new URL('../fixtures/scryfall/edge-cases.json', import.meta.url), 'utf8'),
);

/** Every face of the edge-case printings, by face name. */
const FACES = new Map(PRINTINGS.flatMap(mapCard).map((m) => [m.name, m]));
const face = (name) => {
  assert.ok(FACES.has(name), `no edge-case face ${name}`);
  return FACES.get(name);
};
const cost = (name) => face(name).manaCost?.map(({ symbol, count }) => `${symbol} ${count}`);
const typeIcons = (name) => statBarTop(face(name)).types.map((t) => t.type);

test('every edge-case face maps to a valid model and renders without warnings', async () => {
  assert.equal(FACES.size, 20);
  for (const [name, model] of FACES) {
    assert.deepEqual(validateCardModel(model), [], name);
    const warnings = [];
    await renderCardCanvas(model, { onWarning: (w) => warnings.push(w) });
    assert.deepEqual(warnings, [], name);
  }
});

test('hybrid costs group as one symbol per kind, with generic after (5.3.6)', () => {
  assert.deepEqual(cost('Boros Reckoner'), ['R/W 3']);
  assert.deepEqual(cost('Manamorphose'), ['R/G 1', 'generic 1']);
  // Mono-hybrid: the 2 is part of the symbol, not generic mana.
  assert.deepEqual(cost('Spectral Procession'), ['2/W 3']);
  // Colourless hybrid, in printed order.
  assert.deepEqual(cost('Ulalek, Fused Atrocity'), ['C/W 1', 'C/U 1', 'C/B 1', 'C/R 1', 'C/G 1']);
  assert.deepEqual(face('Boros Reckoner').colors, ['W', 'R']);
});

test('every hybrid symbol in a real cost or rules text has an image (5.3.6, 6.4.6)', async () => {
  for (const name of [
    'Boros Reckoner',
    'Manamorphose',
    'Spectral Procession',
    'Ulalek, Fused Atrocity',
  ]) {
    for (const { symbol } of face(name).manaCost) {
      assert.ok((await nodeAssets.symbol(symbol))?.width > 0, `${name}: ${symbol}`);
    }
  }
  // Figure of Destiny's abilities cost {R/W}, one symbol each, as printed.
  const [, second] = face('Figure of Destiny').oracleText.split('\n');
  const symbols = tokenizeLine(second).filter((t) => t.type === 'symbol');
  assert.deepEqual(
    symbols.map((t) => t.symbol),
    ['R/W', 'R/W', 'R/W'],
  );
});

test('XX and XXX costs count X like any symbol, with no generic row (5.3.3)', () => {
  assert.deepEqual(cost('Hangarback Walker'), ['X 2']);
  assert.deepEqual(cost('Crackle with Power'), ['R 2', 'X 3']);
  // Coloured symbols keep their printed order ({G}{U}), X follows them.
  assert.deepEqual(cost('Doppelgang'), ['G 1', 'U 1', 'X 3']);
  assert.deepEqual(
    statBarTop(face('Crackle with Power')).mana.map((m) => `${m.symbol} ${m.count}`),
    ['R 2', 'X 3'],
  );
});

test('a colour indicator with a {0} cost shows both, indicator first (5.2, 5.3.8)', () => {
  for (const [name, colour] of [
    ['Rograkh, Son of Rohgahh', 'R'],
    ['Pact of Negation', 'U'],
  ]) {
    const model = face(name);
    assert.deepEqual(model.colorIndicator, [colour], name);
    assert.deepEqual(cost(name), ['generic 0'], name);
    const top = statBarTop(model);
    assert.deepEqual(top.indicator.colours, [colour], name);
    assert.ok(top.mana[0].pill.y > top.indicator.cy + top.indicator.r, name);
  }
});

test('a colour indicator with no mana cost has no mana rows (5.2, 5.3.5)', () => {
  const evermind = statBarTop(face('Evermind'));
  assert.deepEqual(evermind.indicator.colours, ['U']);
  assert.deepEqual(evermind.mana, []);
  assert.equal(face('Evermind').manaCost, null);
});

test('a two-colour indicator sits on the back face only, in WUBRG order (5.2.2–5.2.3)', () => {
  assert.equal(face('Arlinn Kord').colorIndicator, null);
  assert.deepEqual(cost('Arlinn Kord'), ['R 1', 'G 1', 'generic 2']);
  const back = face('Arlinn, Embraced by the Moon');
  assert.deepEqual(back.colorIndicator, ['R', 'G']);
  assert.equal(back.manaCost, null);
  assert.equal(back.faceIndex, 1);
  assert.deepEqual(statBarTop(back).indicator.colours, ['R', 'G']);
});

test('colours without an indicator come from the card, not its cost (5.2.2)', () => {
  // Transguild Courier is all five colours by its own text; Scryfall has no indicator.
  const courier = face('Transguild Courier');
  assert.deepEqual(courier.colors, ['W', 'U', 'B', 'R', 'G']);
  assert.equal(courier.colorIndicator, null);
  assert.deepEqual(cost('Transguild Courier'), ['generic 4']);
  assert.equal(statBarTop(courier).indicator, null);
});

test('multi-type cards get one icon per type, in type-line order (5.1.2–5.1.3)', () => {
  assert.deepEqual(typeIcons('Hangarback Walker'), ['Artifact', 'Creature']);
  assert.deepEqual(typeIcons('Heliod, God of the Sun'), ['Enchantment', 'Creature']);
  assert.deepEqual(typeIcons('Seat of the Synod'), ['Artifact', 'Land']);
  assert.deepEqual(typeIcons('Bow of Nylea'), ['Enchantment', 'Artifact']);
  assert.deepEqual(typeIcons('The Aetherspark'), ['Artifact', 'Planeswalker']);
  assert.deepEqual(typeIcons('Nameless Inversion'), ['Kindred', 'Instant']);
  assert.deepEqual(typeIcons("Diviner's Wand"), ['Kindred', 'Artifact']);
});

test('multi-type cards keep supertypes, subtypes and stats apart (5.1, 5.5, 5.7)', () => {
  const pick = (name) => {
    const { supertypes, types, subtypes, power, toughness, loyalty } = face(name);
    return { supertypes, types, subtypes, power, toughness, loyalty };
  };
  assert.deepEqual(pick('Heliod, God of the Sun'), {
    supertypes: ['Legendary'],
    types: ['Enchantment', 'Creature'],
    subtypes: ['God'],
    power: '5',
    toughness: '6',
    loyalty: null,
  });
  assert.deepEqual(pick('The Aetherspark'), {
    supertypes: ['Legendary'],
    types: ['Artifact', 'Planeswalker'],
    subtypes: ['Equipment'],
    power: null,
    toughness: null,
    loyalty: '4',
  });
  assert.deepEqual(pick("Diviner's Wand").subtypes, ['Wizard', 'Equipment']);
  assert.equal(face('Seat of the Synod').manaCost, null);
});

test('a Kindred instant still gets Flash (5.4.6)', () => {
  assert.deepEqual(face('Nameless Inversion').zoneSymbols, ['flash']);
  assert.deepEqual(face('Heliod, God of the Sun').zoneSymbols, []);
});
