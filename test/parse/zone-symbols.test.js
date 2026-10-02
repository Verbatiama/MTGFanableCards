import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectZoneSymbols } from '../../src/parse/zone-symbols.js';

const detect = (oracleText, { keywords = [], types = ['Creature'], name = 'Test Card' } = {}) =>
  detectZoneSymbols({ name, types, oracleText }, keywords);

test('keywords from the D12 table map to their symbol (5.4.2)', () => {
  assert.deepEqual(detect('Flash\nFlying', { keywords: ['Flash', 'Flying'] }), ['flash']);
  assert.deepEqual(detect('Flashback {2}{R}', { keywords: ['Flashback'] }), ['graveyard']);
  assert.deepEqual(detect('Miracle {R}', { keywords: ['Miracle'] }), ['library']);
  assert.deepEqual(detect('Split second (...)', { keywords: ['Split second'] }), ['split-second']);
  assert.deepEqual(detect('Warp {1}{U}', { keywords: ['Warp'] }), ['hand']);
});

test('every -cycling variant counts as cycling', () => {
  assert.deepEqual(
    detect('Swampcycling {2}', { keywords: ['Swampcycling', 'Landcycling', 'Typecycling'] }),
    ['hand'],
  );
});

test('keywords count in a comma list, but not when the text only grants them', () => {
  assert.deepEqual(detect('Flying, flash', { keywords: ['Flying', 'Flash'] }), ['flash']);
  assert.deepEqual(
    detect('Each instant card in your graveyard gains flashback.', { keywords: ['Flashback'] }),
    [],
  );
  assert.deepEqual(detect('Flashback', { keywords: ['Flash'] }), [], 'Flash is not Flashback');
});

test('every instant gets Flash (5.4.6)', () => {
  assert.deepEqual(detect('Draw a card.', { types: ['Instant'] }), ['flash']);
});

test('self-references in a zone count, any kind of ability (5.4.3–5.4.4)', () => {
  assert.deepEqual(detect('You may cast this card from your graveyard.'), ['graveyard']);
  assert.deepEqual(
    detect(
      'Whenever a land you control enters, you may return this card from your graveyard to the battlefield.',
    ),
    ['graveyard'],
  );
  assert.deepEqual(detect('Activate only if this card is in your graveyard.'), ['graveyard']);
  assert.deepEqual(detect('Exile this card from your hand: Add {G}.'), ['hand']);
  assert.deepEqual(
    detect('Return Bloodghast from your graveyard to the battlefield.', { name: 'Bloodghast' }),
    ['graveyard'],
  );
  assert.deepEqual(
    detect('You may cast Hogaak from your graveyard.', { name: 'Hogaak, Arisen Necropolis' }),
    ['graveyard'],
    'short name of a legendary card',
  );
});

test('moving the card into a zone does not count', () => {
  assert.deepEqual(
    detect('When Emrakul is put into a graveyard from anywhere, shuffle.', {
      name: 'Emrakul, the Aeons Torn',
    }),
    [],
  );
  assert.deepEqual(
    detect('Destroy target creature, then put this card on top of your library.'),
    [],
  );
  assert.deepEqual(detect('Return target creature card from your graveyard to your hand.'), []);
});

test('several symbols come out in display order (5.4.7)', () => {
  assert.deepEqual(
    detect('Split second\nCycling {2}', {
      types: ['Instant'],
      keywords: ['Cycling', 'Split second'],
    }),
    ['flash', 'split-second', 'hand'],
  );
});
