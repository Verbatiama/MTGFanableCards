import { CARD_TYPES, isPermanent } from '../config/card-types.js';
import { INDICATOR } from '../config/frames.js';
import { BADGE_COLOURS, DEFENSE_BADGE, LOYALTY_BADGES } from '../config/badges.js';
import { LABELS } from '../config/labels.js';
import {
  ART,
  BAR,
  BAR_BOTTOM,
  BAR_MIDDLE,
  BAR_TOP,
  BOX,
  CARD,
  TEXT,
  TYPE,
} from '../config/layout.js';
import { STAT_ICONS } from '../config/text-symbols.js';
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
 * block. The middle section (T-B8) hangs from the type line. The bottom
 * section (T-B9) is anchored to the bottom of the bar.
 */

/**
 * Positions in the top section, as plain data.
 *
 * - `types`: one icon per card type in type-line order (5.1.3), shrunk so the
 *   row fits the bar; types without an icon are skipped (5.1.4). The row keeps
 *   its full height, so the mana block doesn't move.
 * - `indicator`: the colour indicator's circle, only when the card has one; it
 *   takes its own row and pushes the mana block down (5.2.4).
 * - `mana`: one row per grouped symbol, with its count (5.3). The count is
 *   centred half way between the symbol and the card box's left edge, and the
 *   row sits on a black pill (`pill`) ending at the frame, so it reads over the
 *   art. The rows start a little below the art's top and are spread out so the
 *   art shows around them; they close up only as far as needed to fit above
 *   the type line (`BAR_TOP.mana`, 5.3.11). `manaOverflow` is set when they
 *   run past it even with the pills touching (the stack then starts below
 *   them, 4.4).
 * - `bottom`: where the top section ends.
 *
 * @param {import('../model/card-model.js').CardModel} model
 * @param {{ art?: { y: number }, type?: { y: number } }} [bands] The art box and
 *   type line, which planeswalkers move (T-B11).
 */
export function statBarTop(model, { art = ART, type = TYPE } = {}) {
  let y = BAR_TOP.y;
  const shown = model.types.filter((t) => CARD_TYPES[t]);
  const n = shown.length;
  const gap = BAR_TOP.typeGap;
  const size = Math.min(BAR_TOP.typeRow, Math.floor((BAR.width - 4 - gap * (n - 1)) / n));
  const left = BAR.x + (BAR.width - (size * n + gap * (n - 1))) / 2;
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
    indicator = { colours: model.colorIndicator, cx: BAR.x + BAR.width / 2, cy: y + r, r };
    y += r * 2 + BAR_TOP.rowGap;
  }

  const costs = model.manaCost ?? [];
  if (!costs.length) return { types, indicator, mana: [], bottom: y, manaOverflow: false };
  const pad = BAR_TOP.pill;
  const pillH = BAR.icon + pad * 2;
  const start = Math.max(y, art.y + BAR_TOP.mana.top);
  const room = type.y - BAR_TOP.mana.bottom - start;
  const gaps = costs.length - 1;
  const manaGap = gaps
    ? Math.max(0, Math.min(BAR_TOP.mana.gap, (room - costs.length * pillH) / gaps))
    : 0;
  const x = BAR.x + 8;
  const mana = costs.map(({ symbol, count }, i) => {
    const top = start + i * (pillH + manaGap);
    return {
      symbol,
      count,
      x,
      y: top + pad,
      size: BAR.icon,
      countX: (x + BAR.icon + BOX.x) / 2,
      pill: { x: x - pad, y: top, w: BOX.x - 4 - (x - pad), h: pillH },
    };
  });
  const last = mana.at(-1).pill;
  const bottom = last.y + last.h;
  const manaOverflow = bottom > type.y - BAR_TOP.mana.bottom + 0.01;
  return { types, indicator, mana, bottom, manaOverflow };
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
 * @param {{ assets: ReturnType<typeof import('./assets.js').createAssets>,
 *   art?: { y: number }, type?: { y: number }, warn?: (message: string) => void }} options
 * @returns {Promise<number>} Where the top section ends, for the middle stack.
 */
export async function drawStatBarTop(ctx, model, { assets, warn = () => {}, ...bands }) {
  const top = statBarTop(model, bands);
  if (top.manaOverflow) warn('stat bar: the mana rows run past the type line');
  ctx.save();
  for (const { type, x, y, size } of top.types) {
    const { icon, placeholder } = CARD_TYPES[type];
    ctx.drawImage(await assets.iconOrPlaceholder(icon, placeholder), x, y, size, size);
  }
  if (top.indicator) drawIndicator(ctx, top.indicator);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const { symbol, count, x, y, size, countX, pill } of top.mana) {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(pill.x, pill.y, pill.w, pill.h, pill.h / 2);
    ctx.fill();
    // 'generic' is the bar's own generic symbol; rules text keeps number symbols (D11).
    await drawSymbol(ctx, assets, symbol, x, y, size);
    // Every symbol shows its count, X and {0} included (D11); two digits are smaller.
    ctx.fillStyle = '#fff';
    ctx.font = textFont(count > 9 ? 20 : 24);
    ctx.fillText(String(count), countX, y + size / 2 + 1);
  }
  ctx.restore();
  return top.bottom;
}

/**
 * The middle stack's items, top to bottom (D19, 5.6.1): attaching subtypes
 * (icon only, D16), supertypes (D15) and the non-basic land icon, then
 * zone/timing symbols (D12), each
 * group in its own order. Only zone/timing items have a label (5.5.10).
 * @returns {{ group: 'subtype' | 'supertype' | 'zone', key: string, label: string | null }[]}
 */
export function middleItems(model) {
  return [
    ...model.subtypes
      .filter((t) => SUBTYPE_ICONS[t])
      .map((key) => ({ group: 'subtype', key, label: null })),
    ...model.supertypes
      .filter((t) => SUPERTYPE_ICONS[t])
      .map((key) => ({ group: 'supertype', key, label: null })),
    // Lands that aren't basic, after the supertypes (T-S4, C9).
    ...(model.types.includes('Land') && !model.supertypes.includes('Basic')
      ? [{ group: 'supertype', key: 'Nonbasic', label: null }]
      : []),
    ...model.zoneSymbols.map((key) => ({
      group: 'zone',
      key,
      label: ZONE_SYMBOL_STYLE[key].label,
    })),
  ];
}

/**
 * What the bottom section shows (D18, 5.7) and where its top is, as plain data:
 * power and toughness (`stats`, hollow unless the card is a creature: vehicles
 * and spacecraft, 5.7.7), the starting loyalty badge (7.2.3), the defense
 * badge (5.7.7), the vertical NON-PERMANENT label for non-permanents (5.7.3),
 * or nothing. The label ends level with the bottom of the text box (`base`);
 * the rest sit on the bar's bottom edge.
 * @param {import('../model/card-model.js').CardModel} model
 * @param {{ text?: { y: number, h: number } }} [bands] The text box band.
 */
export function statBarBottom(model, { text = TEXT } = {}) {
  const B = BAR_BOTTOM;
  const edge = CARD.height - B.edge;
  const badge = (kind, value) => ({
    kind,
    value,
    cy: edge - B.badge.centre,
    size: B.badge[kind],
    top: edge - B.badge.centre - B.badge[kind] / 2,
  });
  if (model.power !== null) {
    return {
      kind: 'stats',
      power: model.power,
      toughness: model.toughness,
      hollow: !model.types.includes('Creature'),
      powerY: edge - B.stats.power,
      dividerY: edge - B.stats.divider,
      toughnessY: edge - B.stats.toughness,
      top: edge - B.stats.power,
    };
  }
  if (model.loyalty !== null) return badge('loyalty', model.loyalty);
  if (model.defense !== null) return badge('defense', model.defense);
  if (!isPermanent(model.types)) {
    const letters = [...LABELS.nonPermanent];
    const base = text.y + text.h;
    const top = base - (letters.length - 1) * B.label.step - B.label.size;
    return { kind: 'label', letters, base, top };
  }
  return { kind: null, top: edge };
}

/** As far down as the middle stack may reach: the bottom section's top, less a gap. */
export function bottomSectionTop(model, bands) {
  const { kind, top } = statBarBottom(model, bands);
  return kind ? top - BAR_BOTTOM.gap : top;
}

/**
 * Positions in the middle section (D16, D19; 5.5.8, 5.6), as plain data.
 *
 * The stack hangs from the top of the type line, below the art, and runs down
 * beside the text box, as far as the bottom section less the room the land
 * mana symbols need. A planeswalker's stack stays beside the type line, since
 * its loyalty costs use the bar beside the text box (7.2.1). If the stack
 * doesn't fit, its labels are dropped; if it still
 * doesn't, all icons shrink together, down to half size. A mana block so long
 * it runs past the type line pushes the hanging stack down below it. Nothing
 * is hidden: `overflow` is set when the stack still doesn't fit (D19, 4.4).
 *
 * The land mana symbols are centred on the text box, raised to stay clear of
 * the bottom section, and pushed down to sit under the stack when it reaches them.
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
  const top = Math.max(type.y, from + M.gap);
  const room = model.types.includes('Planeswalker')
    ? { top, bottom: text.y }
    : {
        top,
        bottom: bottomSectionTop(model, { text }) - landHeight,
      };

  const height = (labels, scale = 1) =>
    items.reduce((h, it) => h + (M.icon + (labels && it.label ? M.label : 0) + M.gap) * scale, 0);
  const space = room.bottom - room.top;
  let labels = true;
  let scale = 1;
  if (height(true) > space) {
    labels = false;
    if (height(false) > space) scale = Math.max(M.minScale, space / height(false));
  }

  let y = room.top;
  const stack = items.map((item) => {
    const labelled = labels && item.label !== null;
    const row = { ...item, y, size: M.icon * scale, labelled };
    y += (M.icon + M.gap + (labelled ? M.label : 0)) * scale;
    return row;
  });
  const bottom = items.length ? y : 0;
  const overflow = bottom > room.bottom + 0.5 ? { from: room.bottom, to: bottom } : null;

  // Centred on the text box, but never down into the bottom section (a creature
  // land's stats reach above the text box's middle), and below the stack.
  const lowest = bottomSectionTop(model, { text }) - landHeight + M.gap;
  let landY = Math.max(Math.min(text.y + text.h / 2 - landHeight / 2, lowest), bottom + M.gap);
  const land = landMana.map((symbol) => {
    const row = { symbol, y: landY, size: BAR.icon };
    landY += BAR.icon + M.gap;
    return row;
  });
  return { stack, labels, scale, overflow, land, bottom };
}

/** The image for a middle item, or a labelled placeholder (T-B3). */
async function middleIcon(assets, { group, key }) {
  if (group === 'subtype')
    return assets.iconOrPlaceholder(SUBTYPE_ICONS[key].icon, SUBTYPE_ICONS[key].placeholder);
  const style = group === 'zone' ? ZONE_SYMBOL_STYLE[key] : SUPERTYPE_ICONS[key];
  // Snow reuses the {S} mana symbol art (5.5.4).
  if (style.manaSymbol) return textSymbolImage(assets, style.manaSymbol);
  return assets.iconOrPlaceholder(style.icon, key.slice(0, 3).toUpperCase());
}

/**
 * Draws the middle of the stat bar: the stack and the land mana symbols.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../model/card-model.js').CardModel} model
 * @param {{ assets: ReturnType<typeof import('./assets.js').createAssets>, from: number,
 *   type?: { y: number, h: number }, text?: { y: number, h: number },
 *   warn?: (message: string) => void }} options
 */
export async function drawStatBarMiddle(ctx, model, { assets, warn = () => {}, ...bands }) {
  const middle = statBarMiddle(model, bands);
  const cx = BAR.x + BAR.width / 2;
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
  // Still too long at the minimum size: drawn anyway, never hidden.
  if (middle.overflow) warn('stat bar: the middle stack does not fit, even at half size');
  for (const { symbol, y, size } of middle.land) {
    await drawSymbol(ctx, assets, symbol, cx - size / 2, y, size);
  }
  ctx.restore();
  return middle.bottom;
}

/**
 * A badge (loyalty, defense) centred on (cx, cy) in a `size` square: the shape
 * in white, then filled with `colour` a little inside it, with `text` on top.
 * @param {string} iconPath Badge shape, white (config path).
 */
export async function drawBadge(ctx, assets, iconPath, colour, cx, cy, size, text) {
  const icon = await assets.iconOrPlaceholder(iconPath, text);
  const inset = Math.max(2, size * 0.06);
  ctx.save();
  ctx.drawImage(assets.tinted(icon, '#fff'), cx - size / 2, cy - size / 2, size, size);
  ctx.drawImage(
    assets.tinted(icon, colour),
    cx - size / 2 + inset,
    cy - size / 2 + inset,
    size - inset * 2,
    size - inset * 2,
  );
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFont(ctx, text, size * 0.62, Math.round(size * 0.42), textFont, 10);
  ctx.fillText(text, cx, cy + size * 0.03);
  ctx.restore();
}

/** Six-spoke asterisk of radius r centred on (x, y); outlined when hollow. */
function drawAsterisk(ctx, x, y, r, hollow) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 3;
    ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = r * 0.42;
  ctx.stroke();
  if (hollow) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = r * 0.42 - 3;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A stat value as printed ('3', '-1', '15', 'X', '*', '1+*'), centred at the
 * top of `y` and shrunk to fit the bar (5.7.6). A `*` is drawn as a shape the
 * height of the digits, since the font's asterisk is small and raised.
 * Hollow values are outlined (5.7.7).
 */
function drawValue(ctx, value, y, hollow) {
  const { value: size, minValue } = BAR_BOTTOM.stats;
  const maxWidth = BAR.width - 10;
  const cx = BAR.x + BAR.width / 2;
  if (!value.includes('*')) {
    fitFont(ctx, value, maxWidth, size, textFont, minValue);
    ctx.textAlign = 'center';
    if (hollow) ctx.strokeText(value, cx, y);
    else ctx.fillText(value, cx, y);
    return;
  }
  const parts = value.split(/(\*)/).filter(Boolean);
  let digit;
  let widths;
  for (let s = size; s >= minValue; s -= 1) {
    ctx.font = textFont(s);
    // With a 'top' baseline the ascent is measured up from y (so negative).
    digit = ctx.measureText('0');
    const height = digit.actualBoundingBoxAscent + digit.actualBoundingBoxDescent;
    widths = parts.map((p) => (p === '*' ? height * 0.95 : ctx.measureText(p).width));
    if (widths.reduce((a, b) => a + b, 0) <= maxWidth) break;
  }
  const height = digit.actualBoundingBoxAscent + digit.actualBoundingBoxDescent;
  const middle = y + (digit.actualBoundingBoxDescent - digit.actualBoundingBoxAscent) / 2;
  let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
  ctx.textAlign = 'left';
  parts.forEach((part, i) => {
    if (part === '*') drawAsterisk(ctx, x + widths[i] / 2, middle, height / 2, hollow);
    else if (hollow) ctx.strokeText(part, x, y);
    else ctx.fillText(part, x, y);
    x += widths[i];
  });
}

/**
 * A white icon at (x, y), or for hollow stats its outline: the icon in white
 * nudged all around, with a black copy on top (5.7.7).
 */
function drawIcon(ctx, assets, icon, x, y, size, hollow) {
  if (!hollow) return ctx.drawImage(icon, x, y, size, size);
  const line = 1.25;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.drawImage(icon, x + Math.cos(a) * line, y + Math.sin(a) * line, size, size);
  }
  ctx.drawImage(assets.tinted(icon, '#000'), x, y, size, size);
}

/** A value with its sword or shield underneath (5.7.1), or a text label without one. */
async function drawStat(ctx, assets, stat, value, y, hollow) {
  const { value: size, icon: iconSize } = BAR_BOTTOM.stats;
  const cx = BAR.x + BAR.width / 2;
  drawValue(ctx, value, y, hollow);
  const icon = await assets.icon(STAT_ICONS[stat].icon);
  if (icon) drawIcon(ctx, assets, icon, cx - iconSize / 2, y + size, iconSize, hollow);
  else {
    ctx.textAlign = 'center';
    ctx.font = labelFont(12);
    ctx.fillText(LABELS[stat], cx, y + size + 4);
  }
}

/**
 * Draws the bottom of the stat bar.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../model/card-model.js').CardModel} model
 * @param {{ assets: ReturnType<typeof import('./assets.js').createAssets>,
 *   text?: { y: number, h: number } }} options
 */
export async function drawStatBarBottom(ctx, model, { assets, ...bands }) {
  const bottom = statBarBottom(model, bands);
  const cx = BAR.x + BAR.width / 2;
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.textBaseline = 'top';
  if (bottom.kind === 'stats') {
    await drawStat(ctx, assets, 'power', bottom.power, bottom.powerY, bottom.hollow);
    const [x, w] = [BAR.x + 18, BAR.width - 36];
    if (bottom.hollow) {
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, bottom.dividerY + 0.5, w - 1, 1);
      ctx.lineWidth = 1.5;
    } else ctx.fillRect(x, bottom.dividerY, w, 2);
    await drawStat(ctx, assets, 'toughness', bottom.toughness, bottom.toughnessY, bottom.hollow);
  } else if (bottom.kind === 'loyalty' || bottom.kind === 'defense') {
    const shape = bottom.kind === 'loyalty' ? LOYALTY_BADGES.start.icon : DEFENSE_BADGE.icon;
    const colour = BADGE_COLOURS[bottom.kind];
    await drawBadge(ctx, assets, shape, colour, cx, bottom.cy, bottom.size, bottom.value);
  } else if (bottom.kind === 'label') {
    const { size, step } = BAR_BOTTOM.label;
    ctx.font = labelFont(size);
    ctx.textAlign = 'center';
    // Capitals sit on the baseline, so the last letter ends on the text box's edge.
    ctx.textBaseline = 'alphabetic';
    [...bottom.letters].reverse().forEach((ch, i) => ctx.fillText(ch, cx, bottom.base - i * step));
  }
  ctx.restore();
}
