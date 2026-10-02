import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CardDatabase } from '../../src/data/card-database.js';
import { resolveDecklist, selectPrinting } from '../../src/data/resolve.js';
import { scryfallCard } from './helpers.js';

const bolt = (fields) => scryfallCard({ name: 'Lightning Bolt', ...fields });
const db = await CardDatabase.build([
  bolt({ set: 'm10', collector_number: '146', released_at: '2009-07-17' }),
  bolt({ set: 'm10', collector_number: '10', released_at: '2009-07-17' }),
  bolt({ set: 'm10', collector_number: '9', released_at: '2009-07-17' }),
  bolt({ set: 'lea', collector_number: '161', released_at: '1993-08-05' }),
  bolt({ set: 'plea', collector_number: '1', released_at: '1993-01-01', promo: true }),
  bolt({ set: 'pmtg', collector_number: '1', released_at: '1992-01-01', digital: true }),
  bolt({ set: 'wc97', collector_number: '1', released_at: '1992-06-01', set_type: 'memorabilia' }),
  scryfallCard({ name: 'Promo Only', set: 'ppro', promo: true }),
  scryfallCard({
    name: 'Delver of Secrets // Insectile Aberration',
    layout: 'transform',
    card_faces: [{ name: 'Delver of Secrets' }, { name: 'Insectile Aberration' }],
  }),
]);
const pick = (name, wanted) => selectPrinting(db.lookup(name), wanted);
const where = ({ printing }) => `${printing.set} ${printing.collector_number}`;

test('the default is the first regular printing: no promo, digital or memorabilia (3.3.3)', () => {
  assert.equal(where(pick('Lightning Bolt')), 'lea 161');
  assert.equal(pick('Lightning Bolt').warning, null);
});

test('a card with only promo printings falls back to its first printing', () => {
  assert.equal(where(pick('Promo Only')), 'ppro 1');
});

test('set and collector number pick that printing', () => {
  assert.equal(where(pick('Lightning Bolt', { set: 'm10', number: '146' })), 'm10 146');
});

test('a set alone picks its lowest collector number, compared numerically', () => {
  assert.equal(where(pick('Lightning Bolt', { set: 'm10' })), 'm10 9');
});

test('an unknown set or number falls back with a warning', () => {
  const noSet = pick('Lightning Bolt', { set: 'dar' });
  assert.equal(where(noSet), 'lea 161');
  assert.match(noSet.warning, /no printing in set DAR; using LEA 161/);
  const noNumber = pick('Lightning Bolt', { set: 'm10', number: '999' });
  assert.equal(where(noNumber), 'm10 9');
  assert.match(noNumber.warning, /no collector number 999 in M10/);
});

test('a decklist resolves to printings, unmatched names and errors (3.2.6)', () => {
  const result = resolveDecklist(
    db,
    '4 lightning bolt (M10) 146\n2 Insectile Aberration\n1 Lightnig Bolt\n0 Island',
  );
  assert.deepEqual(
    result.cards.map((c) => [c.quantity, c.name, where(c)]),
    [
      [4, 'Lightning Bolt', 'm10 146'],
      [2, 'Delver of Secrets // Insectile Aberration', 'tst 1'],
    ],
  );
  assert.deepEqual(result.unmatched, [
    {
      lineNumber: 3,
      line: '1 Lightnig Bolt',
      name: 'Lightnig Bolt',
      suggestions: ['Lightning Bolt'],
    },
  ]);
  assert.equal(result.errors.length, 1);
});
