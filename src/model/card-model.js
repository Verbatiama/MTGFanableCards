/**
 * Card model (S1, Requirements 3.3.6): one card face, ready to draw.
 *
 * The mapper (T-A6) produces these from Scryfall JSON, and the renderer
 * (T-B2 onwards) draws from them. Hand-written examples live in
 * test/fixtures/cards/. Double-faced cards produce one model per face (D1).
 *
 * Text fields keep Scryfall's formatting: symbols as `{T}`, `{2}{U}`, and
 * abilities separated by `\n`. Splitting oracle text into tokens or loyalty
 * abilities is the tokenizer's job (T-A7), not the model's.
 *
 * @typedef {object} ManaGroup
 * @property {string} symbol Scryfall symbol without braces ('U', 'W/U', '2/W',
 *   'B/P', 'G/U/P', 'C', 'S', 'X'), or 'generic' for the numeric part.
 * @property {number} count How many times the symbol appears, drawn next to the
 *   symbol for every kind, X included (D11). For 'generic' it is the total
 *   generic amount, so `{0}` is `{ symbol: 'generic', count: 0 }`.
 *
 * @typedef {'flash' | 'split-second' | 'hand' | 'library' | 'graveyard'} ZoneSymbol
 *
 * @typedef {object} CardModel
 * @property {string} name Face name.
 * @property {string} layout Scryfall layout ('normal', 'transform', 'modal_dfc', ...).
 * @property {number} faceIndex 0 for the front (or only) face, 1 for the back.
 * @property {string} typeLine Real type line, shown as-is (3.3.4).
 * @property {string[]} supertypes e.g. ['Legendary'], ['Basic'], ['Snow'].
 * @property {string[]} types e.g. ['Artifact', 'Creature'], in type-line order.
 * @property {string[]} subtypes e.g. ['Equipment'], ['Dragon', 'Wizard'].
 * @property {string[]} colors Card colours in WUBRG order; drives the frame (6.6).
 * @property {string[] | null} colorIndicator Colour indicator in WUBRG order, or null.
 * @property {ManaGroup[] | null} manaCost Grouped cost, or null when the face
 *   has no mana cost (lands, Ancestral Vision, back faces). Order (D11, 5.3.7):
 *   coloured, hybrid and Phyrexian symbols in printed order, then S, C, X, Y, Z,
 *   and generic last.
 * @property {ZoneSymbol[]} zoneSymbols Zone and timing symbols for the middle of
 *   the stat bar (D12, 5.4), in ZONE_SYMBOLS order; empty when none apply.
 * @property {string | null} power Strings, because of '*', '1+*' and 'X'.
 * @property {string | null} toughness
 * @property {string | null} loyalty Starting loyalty (planeswalkers).
 * @property {string | null} defense Battles.
 * @property {string} oracleText Rules text in Scryfall formatting; may be ''.
 * @property {string | null} flavorText
 * @property {string | null} watermark Scryfall watermark name, e.g. 'izzet'.
 * @property {string | null} artUrl Scryfall art crop; null renders the black placeholder (3.4.1).
 * @property {string} artist
 * @property {string} collectorNumber
 * @property {'common' | 'uncommon' | 'rare' | 'mythic' | 'special' | 'bonus'} rarity
 * @property {string} setCode Upper case, as printed in the footer (e.g. 'GPT').
 * @property {string} lang Scryfall language code, e.g. 'en'.
 */

const COLORS = ['W', 'U', 'B', 'R', 'G'];
// Symbols that follow the printed-order ones, in this order (D11, 5.3.7).
export const MANA_TAIL = ['S', 'C', 'X', 'Y', 'Z', 'generic'];
/** Zone and timing symbols in display order, top to bottom (D12, 5.4.7). */
export const ZONE_SYMBOLS = ['flash', 'split-second', 'hand', 'library', 'graveyard'];
const RARITIES = ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus'];

const STRING_FIELDS = [
  'name',
  'layout',
  'typeLine',
  'oracleText',
  'artist',
  'collectorNumber',
  'setCode',
  'lang',
];
const NULLABLE_STRING_FIELDS = [
  'power',
  'toughness',
  'loyalty',
  'defense',
  'flavorText',
  'watermark',
  'artUrl',
];
const STRING_ARRAY_FIELDS = ['supertypes', 'types', 'subtypes'];

export const CARD_MODEL_FIELDS = [
  ...STRING_FIELDS,
  ...NULLABLE_STRING_FIELDS,
  ...STRING_ARRAY_FIELDS,
  'faceIndex',
  'colors',
  'colorIndicator',
  'manaCost',
  'zoneSymbols',
  'rarity',
];

/**
 * Checks a card model against the schema above.
 * @param {unknown} model
 * @returns {string[]} Problems found; empty when the model is valid.
 */
export function validateCardModel(model) {
  if (typeof model !== 'object' || model === null || Array.isArray(model)) {
    return ['card model must be an object'];
  }
  const errors = [];

  for (const key of Object.keys(model)) {
    if (!CARD_MODEL_FIELDS.includes(key)) errors.push(`unknown field "${key}"`);
  }
  for (const key of CARD_MODEL_FIELDS) {
    if (!(key in model)) errors.push(`missing field "${key}"`);
  }

  for (const key of STRING_FIELDS) {
    if (key in model && typeof model[key] !== 'string') errors.push(`${key} must be a string`);
  }
  for (const key of NULLABLE_STRING_FIELDS) {
    if (key in model && model[key] !== null && typeof model[key] !== 'string') {
      errors.push(`${key} must be a string or null`);
    }
  }
  for (const key of STRING_ARRAY_FIELDS) {
    if (key in model && !isStringArray(model[key]))
      errors.push(`${key} must be an array of strings`);
  }

  if ('faceIndex' in model && !(Number.isInteger(model.faceIndex) && model.faceIndex >= 0)) {
    errors.push('faceIndex must be a non-negative integer');
  }
  if ('types' in model && isStringArray(model.types) && model.types.length === 0) {
    errors.push('types must not be empty');
  }
  if ('colors' in model && !isColorList(model.colors)) {
    errors.push('colors must be distinct WUBRG letters in WUBRG order');
  }
  if ('colorIndicator' in model && model.colorIndicator !== null) {
    if (!isColorList(model.colorIndicator) || model.colorIndicator.length === 0) {
      errors.push('colorIndicator must be null or non-empty WUBRG letters in WUBRG order');
    }
  }
  if ('manaCost' in model && model.manaCost !== null)
    errors.push(...validateManaCost(model.manaCost));
  if ('zoneSymbols' in model && !isOrderedSubset(model.zoneSymbols, ZONE_SYMBOLS)) {
    errors.push(
      `zoneSymbols must be distinct values from ${ZONE_SYMBOLS.join(', ')}, in that order`,
    );
  }
  if ('rarity' in model && !RARITIES.includes(model.rarity)) {
    errors.push(`rarity must be one of ${RARITIES.join(', ')}`);
  }
  if (
    'power' in model &&
    'toughness' in model &&
    (model.power === null) !== (model.toughness === null)
  ) {
    errors.push('power and toughness must both be set or both be null');
  }

  return errors;
}

function validateManaCost(manaCost) {
  if (!Array.isArray(manaCost) || manaCost.length === 0) {
    return ['manaCost must be null or a non-empty array'];
  }
  const errors = [];
  const seen = new Set();
  manaCost.forEach((group, i) => {
    if (typeof group?.symbol !== 'string' || group.symbol === '' || /[{}]/.test(group.symbol)) {
      errors.push(`manaCost[${i}].symbol must be a symbol code without braces`);
    } else if (seen.has(group.symbol)) {
      errors.push(`manaCost[${i}].symbol "${group.symbol}" appears more than once`);
    } else {
      seen.add(group.symbol);
    }
    if (!Number.isInteger(group?.count) || group.count < 0) {
      errors.push(`manaCost[${i}].count must be a non-negative integer`);
    } else if (group.count === 0 && group.symbol !== 'generic') {
      errors.push(`manaCost[${i}].count can only be 0 for generic ({0})`);
    }
  });
  const ranks = manaCost.map((group) => MANA_TAIL.indexOf(group?.symbol));
  if (ranks.some((rank, i) => i > 0 && rank < ranks[i - 1])) {
    errors.push(`manaCost must list printed-order symbols first, then ${MANA_TAIL.join(', ')}`);
  }
  return errors;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isColorList(value) {
  return isOrderedSubset(value, COLORS);
}

/** True when `value` is an array of distinct items from `allowed`, in its order. */
function isOrderedSubset(value, allowed) {
  if (!Array.isArray(value)) return false;
  const order = value.map((c) => allowed.indexOf(c));
  return order.every((n, i) => n >= 0 && (i === 0 || n > order[i - 1]));
}
