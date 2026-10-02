import { MULTI_WORD_SUBTYPES } from '../config/subtypes.js';
import { SUPERTYPES as SUPERTYPE_LIST } from '../config/supertypes.js';
import { parseManaCost } from '../parse/mana-cost.js';
import { detectZoneSymbols } from '../parse/zone-symbols.js';

/**
 * Card-model mapper (T-A6, S1, Requirements 3.3): one Scryfall printing in,
 * one card model per face out.
 *
 * Takes a printing as stored by the card database (src/data/card-database.js)
 * or a raw Scryfall card object. Zone/timing symbols come from the printing's
 * keywords and each face's text (T-A8).
 */

/** Layouts whose faces are separate card halves on one side (split, flip, adventure, ...). */
const SAME_SIDE_LAYOUTS = new Set(['split', 'flip', 'adventure', 'room']);

const SUPERTYPES = new Set(SUPERTYPE_LIST);
const COLORS = ['W', 'U', 'B', 'R', 'G'];

/**
 * Thrown for layouts that are out of scope for v1 (D1, Requirements 2.5):
 * cards whose halves share one side, such as split and adventure cards.
 */
export class UnsupportedLayoutError extends Error {
  constructor(card) {
    super(`${card.name}: the ${card.layout} layout is not supported in v1`);
    this.layout = card.layout;
  }
}

/**
 * Splits a type line into supertypes, card types and subtypes (5.1, 5.5).
 * "Legendary Snow Land — Forest Island" → ['Legendary', 'Snow'], ['Land'], ['Forest', 'Island'].
 */
export function parseTypeLine(typeLine) {
  const [left, right = ''] = typeLine.split(/\s+—\s+/);
  const words = left.split(/\s+/).filter(Boolean);
  const supertypes = words.filter((w) => SUPERTYPES.has(w));
  const types = words.filter((w) => !SUPERTYPES.has(w));

  let rest = right.trim();
  const subtypes = [];
  for (const name of MULTI_WORD_SUBTYPES) {
    if (rest.includes(name)) {
      subtypes.push(name);
      rest = rest.replace(name, ' ');
    }
  }
  subtypes.push(...rest.split(/\s+/).filter(Boolean));
  // Keep type-line order when a multi-word subtype was pulled out first.
  subtypes.sort((a, b) => right.indexOf(a) - right.indexOf(b));
  return { supertypes, types, subtypes };
}

const wubrg = (colors) => COLORS.filter((c) => colors.includes(c));

const artOf = (source) => source.art_crop ?? source.image_uris?.art_crop ?? null;

/**
 * @param {object} card Scryfall printing (slim or raw).
 * @returns {import('./card-model.js').CardModel[]} One model per face, front first.
 * @throws {UnsupportedLayoutError} For split, flip, adventure and room cards.
 */
export function mapCard(card) {
  if (SAME_SIDE_LAYOUTS.has(card.layout)) throw new UnsupportedLayoutError(card);
  const faces = card.card_faces?.length ? card.card_faces : [card];
  return faces.map((face, faceIndex) => mapFace(card, face, faceIndex));
}

function mapFace(card, face, faceIndex) {
  const typeLine = face.type_line ?? card.type_line;
  const typeParts = parseTypeLine(typeLine);
  const oracleText = face.oracle_text ?? '';
  const indicator = face.color_indicator ?? (face === card ? card.color_indicator : null);
  return {
    name: face.name,
    layout: card.layout,
    faceIndex,
    typeLine,
    ...typeParts,
    colors: wubrg(face.colors ?? card.colors ?? []),
    colorIndicator: indicator?.length ? wubrg(indicator) : null,
    manaCost: parseManaCost(face.mana_cost),
    zoneSymbols: detectZoneSymbols(
      { name: face.name, types: typeParts.types, oracleText },
      card.keywords,
    ),
    power: face.power ?? null,
    toughness: face.toughness ?? null,
    loyalty: face.loyalty ?? null,
    defense: face.defense ?? null,
    oracleText,
    flavorText: face.flavor_text ?? null,
    watermark: face.watermark ?? card.watermark ?? null,
    artUrl: artOf(face) ?? artOf(card),
    artist: face.artist ?? card.artist ?? '',
    collectorNumber: card.collector_number,
    rarity: card.rarity,
    setCode: card.set.toUpperCase(),
    lang: card.lang,
  };
}
