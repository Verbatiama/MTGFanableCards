import { CARD_TYPES } from '../config/card-types.js';
import { INDICATOR } from '../config/frames.js';
import { BAR, BAR_TOP } from '../config/layout.js';
import { textFont } from './fonts.js';
import { drawSymbol } from './symbols.js';

/**
 * Stat bar (T-B7 onwards; Requirements 5), black down the left edge.
 *
 * The top section (D11, D14, D17; 5.1–5.3) never moves or shrinks (4.4): the
 * card type icons, the colour indicator when the card has one, then the mana
 * block. The middle (T-B8) and bottom (T-B9) sections follow.
 */

/**
 * Positions in the top section, as plain data.
 *
 * - `types`: one icon per card type in type-line order (5.1.3), shrunk so the
 *   row fits the bar; types without an icon are skipped (5.1.4). The row keeps
 *   its full height, so the mana block doesn't move.
 * - `indicator`: the colour indicator's circle, only when the card has one; it
 *   takes its own row and pushes the mana block down (5.2.4).
 * - `mana`: one row per grouped symbol, with its count (5.3).
 * - `bottom`: where the top section ends.
 *
 * @param {import('../model/card-model.js').CardModel} model
 */
export function statBarTop(model) {
  let y = BAR_TOP.y;
  const shown = model.types.filter((t) => CARD_TYPES[t]);
  const n = shown.length;
  const gap = BAR_TOP.typeGap;
  const size = Math.min(BAR_TOP.typeRow, Math.floor((BAR.width - 4 - gap * (n - 1)) / n));
  const left = (BAR.width - (size * n + gap * (n - 1))) / 2;
  const types = shown.map((type, i) => ({
    type,
    x: left + i * (size + gap),
    y: y + (BAR_TOP.typeRow - size) / 2,
    size,
  }));
  y += BAR_TOP.typeRow + BAR_TOP.rowGap;

  let indicator = null;
  if (model.colorIndicator) {
    const r = BAR_TOP.indicator;
    indicator = { colours: model.colorIndicator, cx: BAR.width / 2, cy: y + r, r };
    y += r * 2 + BAR_TOP.rowGap;
  }

  const mana = (model.manaCost ?? []).map(({ symbol, count }) => {
    const row = { symbol, count, x: 8, y, size: BAR.icon };
    y += BAR.icon + BAR.gap;
    return row;
  });
  return { types, indicator, mana, bottom: y };
}

/**
 * Colour indicator (D17, 5.2.3–5.2.5): one circle, a wedge per colour in WUBRG
 * order clockwise from the top, with divider lines between wedges.
 */
function drawIndicator(ctx, { colours, cx, cy, r }) {
  const step = (Math.PI * 2) / colours.length;
  const start = -Math.PI / 2;
  colours.forEach((c, i) => {
    ctx.fillStyle = INDICATOR[c];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start + i * step, start + (i + 1) * step);
    ctx.closePath();
    ctx.fill();
  });
  if (colours.length > 1) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    colours.forEach((_, i) => {
      const a = start + i * step;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    });
    ctx.stroke();
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Draws the top of the stat bar.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../model/card-model.js').CardModel} model
 * @param {{ assets: ReturnType<typeof import('./assets.js').createAssets> }} options
 * @returns {Promise<number>} Where the top section ends, for the middle stack.
 */
export async function drawStatBarTop(ctx, model, { assets }) {
  const top = statBarTop(model);
  ctx.save();
  for (const { type, x, y, size } of top.types) {
    const { icon, placeholder } = CARD_TYPES[type];
    ctx.drawImage(await assets.iconOrPlaceholder(icon, placeholder), x, y, size, size);
  }
  if (top.indicator) drawIndicator(ctx, top.indicator);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const { symbol, count, x, y, size } of top.mana) {
    // 'generic' is the bar's own generic symbol; rules text keeps number symbols (D11).
    await drawSymbol(ctx, assets, symbol, x, y, size);
    // Every symbol shows its count, X and {0} included (D11); two digits are smaller.
    ctx.fillStyle = '#fff';
    ctx.font = textFont(count > 9 ? 20 : 24);
    ctx.fillText(String(count), x + size + 4, y + size / 2 + 1);
  }
  ctx.restore();
  return top.bottom;
}
