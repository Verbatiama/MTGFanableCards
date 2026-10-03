/**
 * Card layout dimensions in pixels (D8, Requirements 4.3): a 750 × 1050 card
 * (300 DPI), the black stat bar down the left edge, and the card box to its
 * right. Measured from the mockups and tuned in the preview spike; change them
 * here, not in the drawing code.
 */
export const CARD = { width: 750, height: 1050 };

/**
 * Black border around the whole card, outside the stat bar, frame and footer
 * (3.5.1): 36px, about 3 mm, like a printed card. Everything else is placed
 * inside it.
 */
export const BORDER = 36;

/**
 * The stat bar (4.1–4.2): its left edge and width, mana symbol size and gap
 * between rows.
 */
export const BAR = { x: BORDER, width: 90, icon: 40, gap: 6 };

/**
 * Top of the stat bar (5.1–5.3): where it starts, the type icon row (full-size
 * icon height and gap between several icons), the colour indicator's radius,
 * and the gap after each row. Mana rows are BAR.icon high, BAR.gap apart.
 */
export const BAR_TOP = { y: BORDER + 10, typeRow: 44, typeGap: 3, indicator: 14, rowGap: 8 };

/**
 * Middle of the stat bar (5.4–5.6): icon size, label height and largest label
 * text size, gap after each item, and how far icons may shrink (D19).
 */
export const BAR_MIDDLE = { icon: 40, label: 16, labelSize: 13, gap: 6, minScale: 0.5 };

/**
 * Bottom of the stat bar (5.7), measured up from its bottom edge, `edge`
 * pixels above the card's bottom (the border). `gap` keeps the middle stack clear of it.
 *
 * - `stats`: power value top, divider, toughness value top; value size (and
 *   smallest when shrunk to fit), and the sword/shield under each value.
 * - `badge`: the loyalty and defense badges' centre and size. They straddle
 *   the bar's bottom edge, overlapping the border (5.7.7, 7.2.3).
 * - `label`: NON-PERMANENT, one letter per line: text size and line step.
 */
export const BAR_BOTTOM = {
  edge: BORDER,
  gap: 8,
  stats: { power: 120, divider: 64, toughness: 56, value: 36, minValue: 14, icon: 20 },
  badge: { centre: 8, loyalty: 76, defense: 70 },
  label: { size: 18, step: 21 },
};

/**
 * The card box: its left edge (after the bar and a gap) and right edge (the
 * frame's 4px edge inside the border).
 */
export const BOX = { x: BAR.x + BAR.width + 10, right: CARD.width - BORDER - 4 };

/**
 * Vertical bands of the card box, top to bottom (6.1–6.5). The frame runs from
 * the border to the footer; the footer's two lines end at the border. The
 * text box keeps its height and the art box takes what is left.
 */
export const FRAME_TOP = BORDER;
export const FOOTER = { y: CARD.height - BORDER - 44 };
export const NAME = { y: FRAME_TOP + 8, h: 58 };
export const TEXT = { y: FOOTER.y - 8 - 380, h: 380 };
export const TYPE = { y: TEXT.y - 56, h: 50 };
const artTop = NAME.y + NAME.h + 6;
export const ART = { y: artTop, h: TYPE.y - 6 - artTop };

/** Space between the text box edges and its text (6.4). */
export const TEXT_PADDING = { x: 20, top: 14, bottom: 10 };

/** Font families (D6). The renderer's environment loads them from res/fonts/. */
export const FONTS = {
  text: { family: 'Beleren', weight: 'bold', file: 'Beleren2016-Bold.ttf' },
  label: { family: 'Beleren SmallCaps', weight: 'bold', file: 'Beleren2016SmallCaps-Bold.ttf' },
};

/** Text sizes in pixels: starting sizes; text fitting can shrink them (6.4.8). */
export const TEXT_SIZE = { name: 34, typeLine: 24, rules: 26, minRules: 12, footer: 15 };
