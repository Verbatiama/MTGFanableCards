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

/**
 * Mana symbols missing from the symbol sheet, as composed images in its style
 * (T-B14): Y, Z, Phyrexian hybrid and colourless hybrid. Paths are under
 * res/symbols/, with the extension.
 */
export const MANA_SYMBOL_IMAGES = {
  Y: 'mana/y.png',
  Z: 'mana/z.png',
  ...Object.fromEntries(
    ['W/U', 'W/B', 'U/B', 'U/R', 'B/R', 'B/G', 'R/G', 'R/W', 'G/W', 'G/U'].map((pair) => [
      `${pair}/P`,
      `mana/${pair.replace('/', '-').toLowerCase()}-p.png`,
    ]),
  ),
  ...Object.fromEntries(
    ['W', 'U', 'B', 'R', 'G'].map((c) => [`C/${c}`, `mana/c-${c.toLowerCase()}.png`]),
  ),
};

/** Artist credit icon in the footer (6.5.1). */
export const FOOTER_ICONS = { artist: { icon: 'footer/artist-brush' } };

/** Sword and shield for power/toughness, in the stat bar and in text (5.7.1, 6.4.5). */
export const STAT_ICONS = {
  power: { icon: 'stats/power', placeholder: 'P' },
  toughness: { icon: 'stats/toughness', placeholder: 'T' },
};
