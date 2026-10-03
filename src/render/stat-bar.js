import { CARD_TYPES, isPermanent } from '../config/card-types.js';
import { INDICATOR } from '../config/frames.js';
import { BAR, BAR_MIDDLE, BAR_TOP, CARD, TEXT, TYPE } from '../config/layout.js';
import { LAND_TYPE_MANA, SUBTYPE_ICONS } from '../config/subtypes.js';
import { SUPERTYPE_ICONS } from '../config/supertypes.js';
import { ZONE_SYMBOL_STYLE } from '../config/zone-symbols.js';
import { fitFont, labelFont, textFont } from './fonts.js';
import { drawSymbol, textSymbolImage } from './symbols.js';

/**
 * Stat bar (T-B7 onwards; Requirements 5), black down the left edge.
 *
 * The top section (D11, D14, D17; 5.1–5.3) never moves or shrinks (4.4): the
 * card type icons, the colour indicator when the card has one, then the mana
 * block. The middle section (T-B8) hangs from the type line; the bottom
 * section (T-B9) follows.
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

/**
 * The middle stack's items, top to bottom (D19, 5.6.1): attaching subtypes
 * (icon only, D16), supertypes (D15), then zone/timing symbols (D12), each
 * group in its own order. Supertype and zone/timing items have a label.
 * @returns {{ group: 'subtype' | 'supertype' | 'zone', key: string, label: string | null }[]}
 */
export function middleItems(model) {
  return [
    ...model.subtypes
      .filter((t) => SUBTYPE_ICONS[t])
      .map((key) => ({ group: 'subtype', key, label: null })),
    ...model.supertypes
      .filter((t) => SUPERTYPE_ICONS[t])
      .map((key) => ({ group: 'supertype', key, label: SUPERTYPE_ICONS[key].label })),
    ...model.zoneSymbols.map((key) => ({
      group: 'zone',
      key,
      label: ZONE_SYMBOL_STYLE[key].label,
    })),
  ];
}

/**
 * Top of the bottom section (stats, loyalty, defense badge, NON-PERMANENT;
 * T-B9, 5.7), less a gap: as far down as the middle stack may reach.
 */
export function bottomSectionTop(model) {
  const bottom = CARD.height - 14;
  if (model.power !== null) return bottom - 120 - 8;
  if (model.loyalty !== null) return bottom - 60 - 8;
  if (model.defense !== null) return CARD.height - 78 - 8;
  if (!isPermanent(model.types)) return bottom - 13 * 21 - 8;
  return bottom;
}

/**
 * Positions in the middle section (D16, D19; 5.5.8, 5.6), as plain data.
 *
 * The stack hangs from the top of the type line and runs down beside the text
 * box, as far as the bottom section less the room the land mana symbols need.
 * A planeswalker's stack instead grows up from the bottom of the type line, as
 * far as the top section, since its loyalty costs use the bar beside the text
 * box (7.2.1). If the stack doesn't fit, its labels are dropped; if it still
 * doesn't, all icons shrink together, down to half size. Nothing is hidden:
 * `overflow` is set when it still doesn't fit.
 *
 * The land mana symbols are centred on the text box, pushed down to sit under
 * the stack when it reaches them.
 *
 * @param {import('../model/card-model.js').CardModel} model
 * @param {{ from: number, type?: { y: number, h: number }, text?: { y: number, h: number } }} options
 *   `from`: where the top section ends (statBarTop().bottom). `type`, `text`:
 *   the type line and text box bands, which planeswalkers move (T-B11).
 */
export function statBarMiddle(model, { from, type = TYPE, text = TEXT }) {
  const M = BAR_MIDDLE;
  const items = middleItems(model);
  const landMana = model.subtypes.filter((t) => LAND_TYPE_MANA[t]).map((t) => LAND_TYPE_MANA[t]);
  const landHeight = landMana.length * (BAR.icon + M.gap);
  const upward = model.types.includes('Planeswalker');
  const room = upward
    ? { top: from + 4, bottom: type.y + type.h - 4 }
    : { top: type.y, bottom: bottomSectionTop(model) - landHeight };

  const height = (labels, scale = 1) =>
    items.reduce((h, it) => h + (M.icon + (labels && it.label ? M.label : 0) + M.gap) * scale, 0);
  const space = room.bottom - room.top;
  let labels = true;
  let scale = 1;
  if (height(true) > space) {
    labels = false;
    if (height(false) > space) scale = Math.max(M.minScale, space / height(false));
  }

  let y = upward ? Math.max(room.top, room.bottom - height(labels, scale)) : room.top;
  const stack = items.map((item) => {
    const labelled = labels && item.label !== null;
    const row = { ...item, y, size: M.icon * scale, labelled };
    y += (M.icon + M.gap + (labelled ? M.label : 0)) * scale;
    return row;
  });
  const bottom = items.length ? y : 0;
  const overflow = bottom > room.bottom + 0.5 ? { from: room.bottom, to: bottom } : null;

  let landY = Math.max(text.y + text.h / 2 - landHeight / 2, bottom + M.gap);
  const land = landMana.map((symbol) => {
    const row = { symbol, y: landY, size: BAR.icon };
    landY += BAR.icon + M.gap;
    return row;
  });
  return { stack, labels, scale, overflow, land, bottom };
}

/** The image for a middle item, or a labelled placeholder (T-B3). */
async function middleIcon(assets, { group, key, label }) {
  if (group === 'subtype')
    return assets.iconOrPlaceholder(SUBTYPE_ICONS[key].icon, SUBTYPE_ICONS[key].placeholder);
  const style = group === 'zone' ? ZONE_SYMBOL_STYLE[key] : SUPERTYPE_ICONS[key];
  // Snow reuses the {S} mana symbol art (5.5.4).
  if (style.manaSymbol) return textSymbolImage(assets, style.manaSymbol);
  return assets.iconOrPlaceholder(style.icon, label.slice(0, 3));
}

/**
 * Draws the middle of the stat bar: the stack and the land mana symbols.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../model/card-model.js').CardModel} model
 * @param {{ assets: ReturnType<typeof import('./assets.js').createAssets>, from: number,
 *   type?: { y: number, h: number }, text?: { y: number, h: number } }} options
 */
export async function drawStatBarMiddle(ctx, model, { assets, ...bands }) {
  const middle = statBarMiddle(model, bands);
  const cx = BAR.width / 2;
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const item of middle.stack) {
    const icon = await middleIcon(assets, item);
    if (icon) ctx.drawImage(icon, cx - item.size / 2, item.y, item.size, item.size);
    if (item.labelled) {
      fitFont(ctx, item.label, BAR.width - 6, BAR_MIDDLE.labelSize, labelFont, 8);
      ctx.fillText(item.label, cx, item.y + item.size + BAR_MIDDLE.label * middle.scale);
    }
  }
  if (middle.overflow) {
    // Still too long at the minimum size: flag it rather than hide anything.
    ctx.fillStyle = '#e33';
    ctx.fillRect(0, middle.overflow.from, 4, middle.overflow.to - middle.overflow.from);
  }
  for (const { symbol, y, size } of middle.land) {
    await drawSymbol(ctx, assets, symbol, cx - size / 2, y, size);
  }
  ctx.restore();
  return middle.bottom;
}
