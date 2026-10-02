/**
 * Symbols in rules text (D20, Requirements 6.4.5–6.4.7).
 *
 * Mana symbols, {T}, {Q}, {E}, {S}, {X}, {C} and the rest come from the symbol
 * sheet (res/symbols/symbols.svg, D7). These are the extra symbols with their
 * own icons; a symbol with neither falls back to its text code.
 */
export const TEXT_SYMBOLS = {
  CHAOS: { icon: 'text/chaos' },
  TK: { icon: 'text/ticket' },
  PW: { icon: 'text/planeswalker' },
};

/** Sword and shield for power/toughness, in the stat bar and in text (5.7.1, 6.4.5). */
export const STAT_ICONS = {
  power: { icon: 'stats/power', placeholder: 'P' },
  toughness: { icon: 'stats/toughness', placeholder: 'T' },
};
