import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCardModel } from '../../src/model/card-model.js';
import { mapCard, parseTypeLine, UnsupportedLayoutError } from '../../src/model/from-scryfall.js';
import { loadCardFixtures } from '../fixtures/cards.js';
import { scryfallCard } from '../data/helpers.js';

// Real Scryfall printings of the fixture cards, as stored by the card database.
const PRINTINGS = JSON.parse(
  readFileSync(new URL('../fixtures/scryfall/printings.json', import.meta.url), 'utf8'),
);

test('mapping the real printings reproduces every hand-written fixture', () => {
  for (const [slug, fixture] of loadCardFixtures()) {
    const printing = PRINTINGS.find(
      (p) =>
        p.set === fixture.setCode.toLowerCase() &&
        p.collector_number === fixture.collectorNumber &&
        (p.name === fixture.name || p.card_faces?.some((f) => f.name === fixture.name)),
    );
    assert.ok(printing, `no Scryfall printing for ${slug}`);
    const model = mapCard(printing).find((m) => m.name === fixture.name);
    // Zone/timing symbols come from detection (T-A8), not the mapper.
    assert.deepEqual({ ...model, zoneSymbols: fixture.zoneSymbols }, fixture, slug);
    assert.deepEqual(validateCardModel(model), [], slug);
  }
});

test('double-faced cards map to one model per face, front first (3.5.4)', () => {
  const delver = PRINTINGS.find((p) => p.name.startsWith('Delver of Secrets'));
  const faces = mapCard(delver);
  assert.deepEqual(
    faces.map((f) => [f.faceIndex, f.name, f.colorIndicator]),
    [
      [0, 'Delver of Secrets', null],
      [1, 'Insectile Aberration', ['U']],
    ],
  );
});

test('type lines split into supertypes, types and subtypes', () => {
  assert.deepEqual(parseTypeLine('Legendary Snow Land — Forest Island'), {
    supertypes: ['Legendary', 'Snow'],
    types: ['Land'],
    subtypes: ['Forest', 'Island'],
  });
  assert.deepEqual(parseTypeLine('Kindred Enchantment — Faerie'), {
    supertypes: [],
    types: ['Kindred', 'Enchantment'],
    subtypes: ['Faerie'],
  });
  assert.deepEqual(parseTypeLine('Instant').subtypes, []);
  assert.deepEqual(parseTypeLine('Legendary Creature — Time Lord Human').subtypes, [
    'Time Lord',
    'Human',
  ]);
});

test('colours and colour indicators come out in WUBRG order', () => {
  const [model] = mapCard(
    scryfallCard({ name: 'Test', colors: ['R', 'U', 'B'], color_indicator: ['G', 'W'] }),
  );
  assert.deepEqual(model.colors, ['U', 'B', 'R']);
  assert.deepEqual(model.colorIndicator, ['W', 'G']);
});

test('raw Scryfall objects work too, with missing fields as null', () => {
  const [model] = mapCard(scryfallCard({ name: 'Raw', type_line: 'Instant', mana_cost: '{R}' }));
  assert.equal(model.artUrl, 'https://example.test/art.jpg');
  assert.deepEqual(model.manaCost, [{ symbol: 'R', count: 1 }]);
  assert.equal(model.flavorText, null);
  assert.equal(model.power, null);
  assert.equal(model.setCode, 'TST');
});

test('split, flip and adventure cards are refused as out of scope for v1 (D1)', () => {
  for (const layout of ['split', 'flip', 'adventure']) {
    assert.throws(
      () => mapCard(scryfallCard({ name: 'Fire // Ice', layout })),
      (error) => error instanceof UnsupportedLayoutError && error.layout === layout,
    );
  }
});
