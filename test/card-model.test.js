import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCardModel } from '../src/model/card-model.js';
import { loadCardFixture } from './fixtures/cards.js';

const valid = () => loadCardFixture('niv-mizzet-the-firemind');

test('accepts a valid card model', () => {
  assert.deepEqual(validateCardModel(valid()), []);
});

test('rejects non-objects', () => {
  assert.deepEqual(validateCardModel(null), ['card model must be an object']);
  assert.deepEqual(validateCardModel([]), ['card model must be an object']);
});

test('reports missing and unknown fields', () => {
  const model = valid();
  delete model.artist;
  model.keywords = ['Flying'];
  assert.deepEqual(validateCardModel(model), [
    'unknown field "keywords"',
    'missing field "artist"',
  ]);
});

test('requires colours in WUBRG order', () => {
  assert.deepEqual(validateCardModel({ ...valid(), colors: ['R', 'U'] }), [
    'colors must be distinct WUBRG letters in WUBRG order',
  ]);
  assert.equal(validateCardModel({ ...valid(), colorIndicator: [] }).length, 1);
});

test('checks grouped mana cost', () => {
  const check = (manaCost) => validateCardModel({ ...valid(), manaCost });
  assert.deepEqual(check(null), []);
  assert.deepEqual(check([{ symbol: 'generic', count: 0 }]), []);
  assert.deepEqual(check([]), ['manaCost must be null or a non-empty array']);
  assert.deepEqual(check([{ symbol: '{U}', count: 1 }]), [
    'manaCost[0].symbol must be a symbol code without braces',
  ]);
  assert.deepEqual(
    check([
      { symbol: 'U', count: 1 },
      { symbol: 'U', count: 1 },
    ]),
    ['manaCost[1].symbol "U" appears more than once'],
  );
  assert.deepEqual(check([{ symbol: 'U', count: 0 }]), [
    'manaCost[0].count can only be 0 for generic ({0})',
  ]);
});

test('requires power and toughness together', () => {
  assert.deepEqual(validateCardModel({ ...valid(), toughness: null }), [
    'power and toughness must both be set or both be null',
  ]);
});
