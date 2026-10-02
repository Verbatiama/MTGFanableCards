import { isCycling, ZONE_KEYWORDS, ZONE_PHRASES } from '../config/zone-symbols.js';
import { ZONE_SYMBOLS } from '../model/card-model.js';

/**
 * Zone and timing detection (T-A8, D12, Requirements 5.4.3).
 *
 * Combines three sources:
 * - Scryfall keywords from the mapping table, counted only when the face has
 *   the keyword itself: at the start of a line or in a comma list ("Flying,
 *   flash"). Text that grants a keyword ("... gains flashback") doesn't count,
 *   and on double-faced cards each keyword goes to the face that has it.
 * - The card type: every Instant gets Flash (5.4.6).
 * - Oracle phrases where the card refers to itself in a zone, such as "this
 *   card from your graveyard" (Gravecrawler, Bloodghast).
 *
 * @param {Pick<import('../model/card-model.js').CardModel, 'name' | 'types' | 'oracleText'>} face
 * @param {string[]} [keywords] Scryfall `keywords` of the printing.
 * @returns {import('../model/card-model.js').ZoneSymbol[]} In ZONE_SYMBOLS order.
 */
export function detectZoneSymbols(face, keywords = []) {
  const found = new Set();
  const text = face.oracleText;

  for (const keyword of keywords) {
    if (!hasOwnKeyword(text, keyword)) continue;
    for (const [symbol, list] of Object.entries(ZONE_KEYWORDS)) {
      const listed = list.some((k) => k.toLowerCase() === keyword.toLowerCase());
      if (listed || (symbol === 'hand' && isCycling(keyword))) found.add(symbol);
    }
  }

  if (face.types.includes('Instant')) found.add('flash');

  const self = selfReferences(face.name).map(escape).join('|');
  for (const [symbol, phrases] of Object.entries(ZONE_PHRASES)) {
    for (const phrase of phrases) {
      if (new RegExp(phrase.replace('SELF', `(?:${self})`), 'i').test(text)) found.add(symbol);
    }
  }

  return ZONE_SYMBOLS.filter((s) => found.has(s));
}

/** The keyword starts a line or follows a comma, as keyword abilities are written. */
function hasOwnKeyword(text, keyword) {
  return new RegExp(`(?:^|\\n|, )${escape(keyword)}(?![\\w-])`, 'i').test(text);
}

/** "this card", the full name, and a legendary's short name ("Emrakul"). */
function selfReferences(name) {
  const refs = ['this card', name];
  const short = name.split(',')[0];
  if (short !== name) refs.push(short);
  return refs;
}

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
