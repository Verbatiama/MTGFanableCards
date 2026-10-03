import { LOYALTY_BADGES, BADGE_COLOURS } from '../config/badges.js';
import {
  ABILITY_BAND,
  ART,
  BAR,
  BOX,
  TEXT,
  TEXT_PADDING,
  TEXT_SIZE,
  TYPE,
} from '../config/layout.js';
import { tokenizeCard } from '../parse/oracle-text.js';
import { drawBadge } from './stat-bar.js';
import { drawLines, layoutText } from './text-box.js';

/**
 * Planeswalker layout (T-B11, D22; Requirements 7.2): equal ability bands that
 * fill the text box, shaded alternately, with each loyalty cost centred on its
 * band in the stat bar.
 */

/** The text box's inner width: inside its 6px inset and the text padding. */
const TEXT_WIDTH = BOX.right - BOX.x - 12 - TEXT_PADDING.x * 2;

/**
 * The card's bands: art box, type line and text box, plus `pw` for a
 * planeswalker with rules text (7.2.6):
 *
 * - One band per Oracle line, loyalty and static abilities alike (7.2.4), all
 *   the same height and together filling the text box.
 * - One font size for every ability, the largest at which the longest fits its
 *   band, down to the minimum (6.4.8).
 * - Still too tall at the minimum: the text box grows upward into the art, the
 *   type line moving up with it and the art getting shorter.
 *
 * Text is laid out here, before anything is drawn, because the bands decide
 * where the loyalty costs go in the bar.
 *
 * @param {CanvasRenderingContext2D} ctx For measuring text.
 * @param {import('../model/card-model.js').CardModel} model
 */
export function cardLayout(ctx, model) {
  const base = { art: ART, type: TYPE, text: TEXT, pw: null };
  if (!model.types.includes('Planeswalker') || !model.oracleText) return base;
  const abilities = tokenizeCard(model).filter((p) => p.kind === 'rules');
  const measure = (size) => {
    const layouts = abilities.map((a) => layoutText(ctx, [a], TEXT_WIDTH, size));
    return { layouts, h: Math.max(...layouts.map((l) => l.height)) + ABILITY_BAND.padding };
  };
  let size = TEXT_SIZE.rules;
  let m = measure(size);
  while (size > TEXT_SIZE.minRules && m.h * abilities.length > TEXT.h) m = measure(--size);
  const textH = Math.max(TEXT.h, m.h * abilities.length);
  const grow = textH - TEXT.h;
  const text = { y: TEXT.y - grow, h: textH };
  const h = textH / abilities.length;
  const bands = abilities.map((a, i) => ({
    cost: a.cost,
    layout: m.layouts[i],
    top: text.y + i * h,
    h,
  }));
  return {
    art: { y: ART.y, h: ART.h - grow },
    type: { y: TYPE.y - grow, h: TYPE.h },
    text,
    pw: { size, bands },
  };
}

/**
 * Draws the ability bands (7.2.2): every other one shaded, each ability's text
 * centred in its band.
 * @param {ReturnType<typeof cardLayout>['pw']} pw
 */
export async function drawAbilityBands(ctx, assets, pw) {
  const x = BOX.x + 6;
  const width = BOX.right - BOX.x - 12;
  ctx.save();
  for (const [i, band] of pw.bands.entries()) {
    if (i % 2) {
      ctx.fillStyle = ABILITY_BAND.shade;
      ctx.fillRect(x, band.top, width, band.h);
    }
    const top = band.top + (band.h - band.layout.height) / 2;
    await drawLines(ctx, assets, band.layout, x + TEXT_PADDING.x, top, TEXT_WIDTH, pw.size);
  }
  ctx.restore();
}

/** Which badge a loyalty cost uses (D22): + points up, − down, 0 is flat. */
export const costBadge = (cost) =>
  cost.startsWith('+') ? 'up' : cost.startsWith('−') ? 'down' : 'zero';

/**
 * Draws each loyalty cost in the bar, centred on its band (7.2.1), in the
 * printed-card badge shapes; ±X like a number (7.2.7). Badges shrink to fit
 * short bands, so they never touch. Static abilities have none (7.2.4).
 * @param {ReturnType<typeof cardLayout>['pw']} pw
 */
export async function drawLoyaltyCosts(ctx, assets, pw) {
  for (const band of pw.bands) {
    if (band.cost === null) continue;
    const size = Math.min(ABILITY_BAND.cost, band.h - 4);
    const shape = LOYALTY_BADGES[costBadge(band.cost)].icon;
    const cy = band.top + band.h / 2;
    await drawBadge(
      ctx,
      assets,
      shape,
      BADGE_COLOURS.loyalty,
      BAR.x + BAR.width / 2,
      cy,
      size,
      band.cost,
    );
  }
}
