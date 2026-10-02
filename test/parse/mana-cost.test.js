import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseManaCost } from '../../src/parse/mana-cost.js';
import { loadCardFixtures } from '../fixtures/cards.js';

// Scryfall `mana_cost` of each fixture's printing and face.
const SCRYFALL_COSTS = {
  'agadeem-the-undercrypt': '',
  'agadeems-awakening': '{X}{B}{B}{B}',
  'ajani-sleeper-agent': '{1}{G}{G/W/P}{W}',
  'ancestral-vision': '',
  'atraxa-grand-unifier': '{3}{G}{W}{U}{B}',
  'awakened-skyclave': '',
  bitterblossom: '{1}{B}',
  bloodghast: '{B}{B}',
  'breeding-pool': '',
  'city-of-brass': '',
  'complete-disregard': '{2}{B}',
  'concordant-crossroads': '{G}',
  'curse-of-deaths-hold': '{3}{B}{B}',
  damnation: '{2}{B}{B}',
  'dark-depths': '',
  'deep-analysis': '{3}{U}',
  'delver-of-secrets': '{U}',
  dismember: '{1}{B/P}{B/P}',
  'dryad-arbor': '',
  'emrakul-the-aeons-torn': '{15}',
  'feral-invocation': '{2}{G}',
  'fiendslayer-paladin': '{1}{W}{W}',
  forest: '',
  'gelatinous-genesis': '{X}{X}{G}',
  gravecrawler: '{B}',
  'icehide-golem': '{S}',
  'insectile-aberration': '',
  'invasion-of-zendikar': '{3}{G}',
  'jace-the-mind-sculptor': '{2}{U}{U}',
  'kitchen-finks': '{1}{G/W}{G/W}',
  'krosan-grip': '{2}{G}',
  'lightning-strike': '{1}{R}',
  'nicol-bolas-the-arisen': '',
  'nicol-bolas-the-ravager': '{1}{U}{B}{R}',
  'niv-mizzet-the-firemind': '{2}{U}{U}{R}{R}',
  ornithopter: '{0}',
  'reaper-king': '{2/W}{2/U}{2/B}{2/R}{2/G}',
  'smugglers-copter': '{2}',
  'snow-covered-forest': '',
  'street-wraith': '{3}{B}{B}',
  'sword-of-fire-and-ice': '{3}',
  tarmogoyf: '{1}{G}',
  'teferi-time-raveler': '{1}{W}{U}',
  terminus: '{4}{W}{W}',
  'thought-knot-seer': '{3}{C}',
  'ugin-the-spirit-dragon': '{8}',
  wasteland: '',
  'wurmcoil-engine': '{6}',
  'wurmwall-sweeper': '{2}',
};

test("every fixture's hand-written manaCost matches the parsed Scryfall cost", () => {
  for (const [slug, fixture] of loadCardFixtures()) {
    assert.ok(slug in SCRYFALL_COSTS, `no Scryfall cost recorded for ${slug}`);
    assert.deepEqual(parseManaCost(SCRYFALL_COSTS[slug]), fixture.manaCost, slug);
  }
});

const groups = (cost) => parseManaCost(cost).map(({ symbol, count }) => `${symbol} ${count}`);

test('symbols are grouped with counts, generic last (5.3.1)', () => {
  assert.deepEqual(groups('{2}{U}{U}{R}{R}'), ['U 2', 'R 2', 'generic 2']);
});

test('coloured, hybrid and Phyrexian symbols keep printed order (5.3.7)', () => {
  assert.deepEqual(groups('{1}{G}{G/W/P}{W}'), ['G 1', 'G/W/P 1', 'W 1', 'generic 1']);
  assert.deepEqual(groups('{2/W}{2/U}'), ['2/W 1', '2/U 1']);
});

test('snow, colourless, X, Y and Z come after the printed symbols, in that order', () => {
  assert.deepEqual(groups('{X}{Y}{C}{S}{B}{Z}{1}'), [
    'B 1',
    'S 1',
    'C 1',
    'X 1',
    'Y 1',
    'Z 1',
    'generic 1',
  ]);
});

test('X is counted like any symbol (5.3.3)', () => {
  assert.deepEqual(groups('{X}{X}{G}'), ['G 1', 'X 2']);
});

test('{0} is generic 0, distinct from no cost (5.3.8)', () => {
  assert.deepEqual(parseManaCost('{0}'), [{ symbol: 'generic', count: 0 }]);
  assert.equal(parseManaCost(''), null);
  assert.equal(parseManaCost(null), null);
});

test('large and split numeric parts add up', () => {
  assert.deepEqual(groups('{16}'), ['generic 16']);
  assert.deepEqual(groups('{1}{1}'), ['generic 2']);
});

test('lower-case symbols are normalised and malformed costs are rejected', () => {
  assert.deepEqual(groups('{g/w}'), ['G/W 1']);
  assert.throws(() => parseManaCost('2UU'), /Not a mana cost/);
  assert.throws(() => parseManaCost('{2} {U}'), /Not a mana cost/);
  assert.throws(() => parseManaCost('{4}{U} // {1}{U}'), /parse each face/);
});
