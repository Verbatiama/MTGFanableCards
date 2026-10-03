import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeCard, tokenizeLine } from '../../src/parse/oracle-text.js';
import { loadCardFixture, loadCardFixtures } from '../fixtures/cards.js';

/** Compact form: text, /italic/, {symbol}, [+2|+2] for a P/T modifier. */
const show = (tokens) =>
  tokens
    .map((t) =>
      t.type === 'text'
        ? t.italic
          ? `/${t.text}/`
          : t.text
        : t.type === 'symbol'
          ? `{${t.symbol}}`
          : `[${t.power}|${t.toughness}]`,
    )
    .join('');
const line = (text, options) => show(tokenizeLine(text, options));

test('symbols stay one per symbol, as printed (D11, 6.4.6)', () => {
  assert.equal(line('{T}: Add {C}{C}.'), '{T}: Add {C}{C}.');
  assert.equal(line('{2}{U}: Draw a card.'), '{2}{U}: Draw a card.');
  assert.equal(line('Roll the planar die. {CHAOS}'), 'Roll the planar die. {CHAOS}');
});

test('power/toughness modifiers, counters and stats stay as text (C17)', () => {
  assert.equal(line('Enchanted creature gets +2/+2.'), 'Enchanted creature gets +2/+2.');
  assert.equal(
    line('Target creature gets -5/-5 until end of turn.'),
    'Target creature gets -5/-5 until end of turn.',
  );
  assert.equal(line('Put a +1/+1 counter on it.'), 'Put a +1/+1 counter on it.');
  assert.equal(line('had no -1/-1 counters on it'), 'had no -1/-1 counters on it');
  assert.equal(line('It gets +X/+X.'), 'It gets +X/+X.');
  assert.equal(line('Create a 1/1 white Spirit token.'), 'Create a 1/1 white Spirit token.');
  assert.equal(line('Create X X/X green Ooze tokens.'), 'Create X X/X green Ooze tokens.');
});

test('reminder text in parentheses is italic, symbols inside it included (6.4.2)', () => {
  assert.equal(
    line('First strike (This creature deals combat damage first.)'),
    'First strike /(This creature deals combat damage first.)/',
  );
  assert.equal(
    line('({B/P} can be paid with {B} or 2 life.)'),
    '/(/{B/P}/ can be paid with /{B}/ or 2 life.)/',
  );
});

test('flavour text is italic and never converted (6.4.1)', () => {
  assert.equal(line('It got +2/+2 stronger.', { flavor: true }), '/It got +2/+2 stronger./');
});

test('planeswalker lines split into loyalty cost and ability (7.2.1, 7.2.4, D22)', () => {
  const ugin = tokenizeCard(loadCardFixture('ugin-the-spirit-dragon'));
  assert.deepEqual(
    ugin.map((p) => p.cost),
    ['+2', '−X', '−10'],
  );
  assert.equal(show(ugin[0].tokens), 'Ugin deals 3 damage to any target.');
  const teferi = tokenizeCard(loadCardFixture('teferi-time-raveler'));
  assert.equal(teferi[0].cost, null, 'static ability has no cost');
});

test('non-planeswalkers keep "N:" at the start of a line as text', () => {
  const [paragraph] = tokenizeCard({
    ...loadCardFixture('lightning-strike'),
    oracleText: '0: Do nothing.',
  });
  assert.equal(paragraph.cost, null);
  assert.equal(show(paragraph.tokens), '0: Do nothing.');
});

test('every fixture tokenizes into rules paragraphs and at most one flavour paragraph', () => {
  for (const [slug, model] of loadCardFixtures()) {
    const paragraphs = tokenizeCard(model);
    const rules = model.oracleText ? model.oracleText.split('\n').length : 0;
    assert.equal(paragraphs.filter((p) => p.kind === 'rules').length, rules, slug);
    assert.equal(
      paragraphs.filter((p) => p.kind === 'flavor').length,
      model.flavorText ? 1 : 0,
      slug,
    );
  }
});
