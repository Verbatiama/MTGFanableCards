import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CardDatabase, normalizeName } from '../../src/data/card-database.js';
import { scryfallCard } from './helpers.js';

const cards = [
  scryfallCard({
    name: 'Lightning Bolt',
    set: 'm10',
    collector_number: '146',
    released_at: '2009-07-17',
    illustration_id: 'b',
  }),
  scryfallCard({
    name: 'Lightning Bolt',
    set: 'lea',
    collector_number: '161',
    released_at: '1993-08-05',
    illustration_id: 'a',
  }),
  scryfallCard({ name: 'Lightning Bolt', set: 'lea', lang: 'de', released_at: '1993-08-05' }),
  scryfallCard({ name: "Smuggler's Copter", type_line: 'Artifact — Vehicle' }),
  scryfallCard({
    name: 'Delver of Secrets // Insectile Aberration',
    layout: 'transform',
    image_uris: undefined,
    card_faces: [
      {
        name: 'Delver of Secrets',
        type_line: 'Creature — Human Wizard',
        image_uris: { art_crop: 'https://example.test/front.jpg' },
      },
      {
        name: 'Insectile Aberration',
        type_line: 'Creature — Human Insect',
        color_indicator: ['U'],
      },
    ],
  }),
  scryfallCard({ name: 'Goblin', layout: 'token' }),
  { object: 'card', name: 'Not English', lang: 'ja', layout: 'normal' },
];

const db = await CardDatabase.build(cards, [cards[1], cards[0]]);

test('names match regardless of case, spacing and apostrophe style', () => {
  assert.equal(db.lookup('lightning bolt')?.name, 'Lightning Bolt');
  assert.equal(db.lookup('  LIGHTNING   bolt ')?.name, 'Lightning Bolt');
  assert.equal(db.lookup('Smuggler’s Copter')?.name, "Smuggler's Copter");
  assert.equal(normalizeName('Fire//Ice'), normalizeName('fire // ice'));
});

test('double-faced cards match by full name or either face (3.2.5)', () => {
  const full = db.lookup('Delver of Secrets // Insectile Aberration');
  assert.equal(full?.name, 'Delver of Secrets // Insectile Aberration');
  assert.equal(db.lookup('delver of secrets'), full);
  assert.equal(db.lookup('Insectile Aberration'), full);
});

test('only English playable cards are indexed (D24, D15)', () => {
  assert.equal(db.lookup('Goblin'), null);
  assert.equal(db.lookup('Not English'), null);
  assert.equal(db.lookup('Lightning Bolt').printings.length, 2);
  assert.equal(db.size, 3);
});

test('printings are sorted oldest first, so the first printing is the default (3.3.3)', () => {
  const sets = db.lookup('Lightning Bolt').printings.map((p) => p.set);
  assert.deepEqual(sets, ['lea', 'm10']);
});

test('printings keep only the fields later stages need', () => {
  const [lea] = db.lookup('Lightning Bolt').printings;
  assert.equal(lea.art_crop, 'https://example.test/art.jpg');
  assert.equal(lea.image_uris, undefined);
  assert.equal(lea.object, undefined);
  const delver = db.lookup('Delver of Secrets').printings[0];
  assert.equal(delver.card_faces[0].art_crop, 'https://example.test/front.jpg');
  assert.deepEqual(delver.card_faces[1].color_indicator, ['U']);
});

test('artworks lists one printing per distinct artwork (D2)', () => {
  assert.deepEqual(
    db.artworks('lightning bolt').map((p) => p.illustration_id),
    ['a', 'b'],
  );
  assert.deepEqual(db.artworks('Unknown Card'), []);
});

test('unmatched names get close suggestions, closest first (3.2.4)', () => {
  assert.deepEqual(db.suggest('Lightnig Bolt'), ['Lightning Bolt']);
  assert.deepEqual(db.suggest('Smugglers Copter'), ["Smuggler's Copter"]);
  assert.deepEqual(db.suggest('Something Else Entirely'), []);
});
