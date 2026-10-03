/**
 * Card layout dimensions in pixels (D8, Requirements 4.3): a 750 × 1050 card
 * (300 DPI), the black stat bar down the left edge, and the card box to its
 * right. Measured from the mockups and tuned in the preview spike; change them
 * here, not in the drawing code.
 */
export const CARD = { width: 750, height: 1050 };

/** The stat bar (4.1–4.2): its width, mana symbol size and gap between rows. */
export const BAR = { width: 90, icon: 40, gap: 6 };

/**
 * Top of the stat bar (5.1–5.3): where it starts, the type icon row (full-size
 * icon height and gap between several icons), the colour indicator's radius,
 * and the gap after each row. Mana rows are BAR.icon high, BAR.gap apart.
 */
export const BAR_TOP = { y: 14, typeRow: 44, typeGap: 3, indicator: 14, rowGap: 8 };

/**
 * Middle of the stat bar (5.4–5.6): icon size, label height and largest label
 * text size, gap after each item, and how far icons may shrink (D19).
 */
export const BAR_MIDDLE = { icon: 40, label: 16, labelSize: 13, gap: 6, minScale: 0.5 };

/** The card box: its left edge (after the bar and a gap) and right edge. */
export const BOX = { x: BAR.width + 10, right: CARD.width - 12 };

/** Vertical bands of the card box, top to bottom (6.1–6.5). */
export const NAME = { y: 12, h: 58 };
export const ART = { y: 76, h: 440 };
export const TYPE = { y: 522, h: 50 };
export const TEXT = { y: 578, h: 380 };
export const FOOTER = { y: 966 };

/** Space between the text box edges and its text (6.4). */
export const TEXT_PADDING = { x: 20, top: 14, bottom: 10 };

/** Font families (D6). The renderer's environment loads them from res/fonts/. */
export const FONTS = {
  text: { family: 'Beleren', weight: 'bold', file: 'Beleren2016-Bold.ttf' },
  label: { family: 'Beleren SmallCaps', weight: 'bold', file: 'Beleren2016SmallCaps-Bold.ttf' },
};

/** Text sizes in pixels: starting sizes; text fitting can shrink them (6.4.8). */
export const TEXT_SIZE = { name: 34, typeLine: 24, rules: 26, minRules: 12, footer: 15 };
