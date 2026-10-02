import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDecklist } from '../../src/parse/decklist.js';

const one = (line) => parseDecklist(line).entries[0];

test('quantities: "4 Name", "4x Name" and a bare name (3.2.2)', () => {
  assert.equal(one('4 Lightning Bolt').quantity, 4);
  assert.equal(one('4x Lightning Bolt').quantity, 4);
  assert.equal(one('4X Lightning Bolt').quantity, 4);
  assert.deepEqual(
    { quantity: one('Lightning Bolt').quantity, name: one('Lightning Bolt').name },
    { quantity: 1, name: 'Lightning Bolt' },
  );
});

test('printings: (SET), (SET) number and [SET] (3.3.3)', () => {
  assert.deepEqual(
    (({ name, set, number }) => ({ name, set, number }))(one('4 Lightning Bolt (M10) 146')),
    { name: 'Lightning Bolt', set: 'm10', number: '146' },
  );
  assert.equal(one('4 Lightning Bolt (M10)').set, 'm10');
  assert.equal(one('4 Lightning Bolt (M10)').number, null);
  assert.equal(one('1 Smuggler’s Copter [KLD]').set, 'kld');
  assert.equal(one('1 Sol Ring (C21) 263 *F*').number, '263');
  assert.equal(one('1 Fire // Ice (MH2) 290').name, 'Fire // Ice');
});

test('names with brackets or numbers that are not printings are kept whole', () => {
  assert.equal(one('1 Borrowing 100,000 Arrows').name, 'Borrowing 100,000 Arrows');
  assert.equal(
    one("1 Erase (Not the Urza's Legacy One)").name,
    "Erase (Not the Urza's Legacy One)",
  );
});

test('blank lines, comments and section headers are skipped; sections are recorded', () => {
  const { entries } = parseDecklist(
    'Deck\n4 Lightning Bolt\n\n// note\n# note\nSideboard:\n2 Duress\r\nCommander\n1 Atraxa, Grand Unifier',
  );
  assert.deepEqual(
    entries.map(({ name, section, lineNumber }) => [name, section, lineNumber]),
    [
      ['Lightning Bolt', 'deck', 2],
      ['Duress', 'sideboard', 7],
      ['Atraxa, Grand Unifier', 'commander', 9],
    ],
  );
});

test('a zero quantity is reported as an error, not dropped silently', () => {
  const { entries, errors } = parseDecklist('0 Island\n1 Forest');
  assert.deepEqual(
    entries.map((e) => e.name),
    ['Forest'],
  );
  assert.deepEqual(errors, [
    { lineNumber: 1, line: '0 Island', error: 'Quantity must be at least 1' },
  ]);
});
