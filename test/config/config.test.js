import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CARD_TYPES,
  FRAME,
  INDICATOR,
  LAND_FRAME,
  LAND_TYPE_MANA,
  STAT_ICONS,
  SUBTYPE_ICONS,
  SUPERTYPE_ICONS,
  SUPERTYPES,
  TEXT_SYMBOLS,
  ZONE_KEYWORDS,
  ZONE_SYMBOL_STYLE,
  isPermanent,
} from '../../src/config/index.js';
import { ZONE_SYMBOLS } from '../../src/model/card-model.js';
import { SYMBOL_DIR } from '../../src/paths.js';
import { listSymbolCodes } from '../../spikes/rendering/symbols.js';

const allIcons = [
  ...Object.values(CARD_TYPES),
  ...Object.values(ZONE_SYMBOL_STYLE),
  ...Object.values(SUPERTYPE_ICONS),
  ...Object.values(SUBTYPE_ICONS),
  ...Object.values(TEXT_SYMBOLS),
  ...Object.values(STAT_ICONS),
]
  .map((entry) => entry.icon)
  .filter(Boolean);

test('card types cover D14, and only permanents are permanent (5.7.3)', () => {
  assert.deepEqual(Object.keys(CARD_TYPES).sort(), [
    'Artifact',
    'Battle',
    'Creature',
    'Enchantment',
    'Instant',
    'Kindred',
    'Land',
    'Planeswalker',
    'Sorcery',
  ]);
  assert.equal(isPermanent(['Kindred', 'Instant']), false);
  assert.equal(isPermanent(['Kindred', 'Enchantment']), true);
  assert.equal(isPermanent(['Dungeon']), false);
});

test('every zone symbol has an icon and a label, and keywords map to real symbols', () => {
  assert.deepEqual(Object.keys(ZONE_SYMBOL_STYLE), ZONE_SYMBOLS);
  for (const style of Object.values(ZONE_SYMBOL_STYLE)) assert.ok(style.icon && style.label);
  for (const symbol of Object.keys(ZONE_KEYWORDS)) assert.ok(ZONE_SYMBOLS.includes(symbol));
});

test('supertypes with icons are known supertypes and have labels (D15)', () => {
  for (const [name, style] of Object.entries(SUPERTYPE_ICONS)) {
    assert.ok(SUPERTYPES.includes(name), name);
    assert.ok(style.label && (style.icon || style.manaSymbol), name);
  }
});

test('mana symbols named in the config exist in the symbol sheet', () => {
  const sheet = new Set(
    listSymbolCodes(readFileSync(path.join(SYMBOL_DIR, 'symbols.svg'), 'utf8')),
  );
  const code = (symbol) => (symbol === 'S' ? 'snow' : symbol.toLowerCase());
  for (const symbol of [...Object.values(LAND_TYPE_MANA), SUPERTYPE_ICONS.Snow.manaSymbol]) {
    assert.ok(sheet.has(code(symbol)), symbol);
  }
});

test('frame palettes have every colour and every part', () => {
  for (const key of ['W', 'U', 'B', 'R', 'G', 'gold', 'artifact', 'colourless']) {
    assert.deepEqual(Object.keys(FRAME[key]).sort(), ['bar', 'border', 'pin', 'text'], key);
  }
  for (const key of ['W', 'U', 'B', 'R', 'G', 'gold', 'colourless']) {
    assert.deepEqual(Object.keys(LAND_FRAME[key]).sort(), ['bar', 'pin', 'text'], key);
  }
  assert.deepEqual(Object.keys(INDICATOR), ['W', 'U', 'B', 'R', 'G']);
});

test('every icon file in res/symbols is used by the config', () => {
  for (const dir of ['types', 'zones', 'stats', 'supertypes', 'subtypes', 'text']) {
    const full = path.join(SYMBOL_DIR, dir);
    if (!existsSync(full)) continue;
    for (const file of readdirSync(full).filter((f) => f.endsWith('.svg'))) {
      assert.ok(
        allIcons.includes(`${dir}/${file.slice(0, -4)}`),
        `${dir}/${file} is not in the config`,
      );
    }
  }
});

test('icons still to be made (T-B14): update this list as they are added', () => {
  const missing = allIcons.filter((icon) => !existsSync(path.join(SYMBOL_DIR, `${icon}.svg`)));
  assert.deepEqual(missing.sort(), [
    'stats/power',
    'subtypes/aura',
    'subtypes/equipment',
    'subtypes/fortification',
    'supertypes/basic',
    'supertypes/legendary',
    'supertypes/world',
    'text/chaos',
    'text/planeswalker',
    'text/ticket',
    'types/battle',
    'types/kindred',
    'zones/split-second',
  ]);
});
