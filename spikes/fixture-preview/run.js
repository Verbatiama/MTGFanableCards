/**
 * Throwaway preview of the card-model fixtures (T-A2), so their data can be
 * checked by eye before the real renderer (T-B2 onwards) exists. Not the
 * renderer: no icons for types/stats, fixed dimensions. Art crops are
 * downloaded from Scryfall by the art fetcher (src/art/, T-A10); pass --no-art to skip them.
 *
 *   node spikes/fixture-preview/run.js [--no-art] [slug ...]
 *
 * Writes out/fixture-preview/<slug>.png, a contact sheet (_all.png) and the
 * previews as printable A4 sheets (_sheets.pdf).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { FONT_DIR, OUT_DIR } from '../../src/paths.js';
import { decodeSetSymbol, nodeAssets as assets, nodeEnv } from '../../src/render/node.js';
import { drawFrame } from '../../src/render/frame.js';
import { createSetSymbolFetcher } from '../../src/art/set-symbols.js';
import { loadCardFixtures } from '../../test/fixtures/cards.js';
import { createArtFetcher } from '../../src/art/art-cache.js';
import { pdfSheets } from '../../src/output/index.js';
import { stressModels } from './stress.js';
import { tokenizeCard } from '../../src/parse/oracle-text.js';
import { textFont, labelFont } from '../../src/render/fonts.js';
import { drawSymbol as drawSymbolWith, textSymbolImage } from '../../src/render/symbols.js';
import { drawFooter } from '../../src/render/footer.js';
import { drawLines, drawRulesText, drawWatermark, layoutText } from '../../src/render/text-box.js';
import {
  ART,
  BAR,
  BOX,
  CARD,
  CARD_TYPES,
  FOOTER,
  TEXT,
  TYPE,
  DEFENSE_BADGE,
  INDICATOR,
  LABELS,
  LAND_TYPE_MANA,
  LOYALTY_BADGES,
  STAT_ICONS,
  SUBTYPE_ICONS,
  SUPERTYPE_ICONS,
  ZONE_SYMBOL_STYLE,
  isPermanent,
} from '../../src/config/index.js';

// Card dimensions and fonts come from the real renderer's config (T-B2).
const FONT = textFont;
const LABEL = labelFont;

// Placeholder type icons until the real set arrives (D14). Full-size icon
// height; two or three types shrink to fit one row.
const TYPE_ROW = 44;

registerFont(path.join(FONT_DIR, 'Beleren2016-Bold.ttf'), { family: 'Beleren', weight: 'bold' });
registerFont(path.join(FONT_DIR, 'Beleren2016SmallCaps-Bold.ttf'), {
  family: 'Beleren SmallCaps',
  weight: 'bold',
});

// Symbols and icons come from the real asset loader (T-B3).
const genericSymbol = await assets.symbol('generic');

// Icons from res/symbols/ (see its README). Any that fail to load fall back to
// labelled boxes.
const ICONS = new Map();
for (const name of [
  ...Object.values(CARD_TYPES).map((t) => t.icon),
  ...Object.values(ZONE_SYMBOL_STYLE).map((z) => z.icon),
  ...Object.values(SUPERTYPE_ICONS)
    .filter((t) => t.icon)
    .map((t) => t.icon),
  ...Object.values(STAT_ICONS).map((t) => t.icon),
  ...Object.values(SUBTYPE_ICONS).map((t) => t.icon),
  ...Object.values(LOYALTY_BADGES).map((t) => t.icon),
  DEFENSE_BADGE.icon,
]) {
  try {
    const icon = await assets.icon(name);
    if (icon) ICONS.set(name, icon);
  } catch {
    // Missing icon.
  }
}

// Symbols as the text box draws them (T-B5).
const symbol = (code) => textSymbolImage(assets, code);
const drawSymbol = (ctx, ...rest) => drawSymbolWith(ctx, assets, ...rest);

/** A white icon recoloured, at 200×200 (cached by the asset loader). */
function tinted(icon, colour, size = 200) {
  return assets.tinted(icon, colour, size);
}

/**
 * A badge shape (loyalty, defense) filled with `colour` and a white outline,
 * centred on (cx, cy) in a `size` square, with `text` on it.
 */
function drawBadge(ctx, icon, colour, cx, cy, size, text) {
  const inset = Math.max(2, size * 0.06);
  ctx.drawImage(tinted(icon, '#fff'), cx - size / 2, cy - size / 2, size, size);
  ctx.drawImage(
    tinted(icon, colour),
    cx - size / 2 + inset,
    cy - size / 2 + inset,
    size - inset * 2,
    size - inset * 2,
  );
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = FONT(fitSize(ctx, text, size * 0.62, Math.round(size * 0.42), FONT, 10));
  ctx.fillText(text, cx, cy + size * 0.03);
  ctx.restore();
}

async function loadArt(model) {
  if (noArt) return null;
  const bytes = await artFetcher.fetchArt(model.artUrl);
  if (!bytes) return null;
  try {
    return await loadImage(bytes);
  } catch (error) {
    console.warn(`art: ${model.name} could not be decoded (${error.message}); using placeholder`);
    return null;
  }
}

async function drawCard(model) {
  const art = await loadArt(model);
  const canvas = createCanvas(CARD.width, CARD.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CARD.width, CARD.height);

  const layout = cardLayout(ctx, model);
  await drawStatBar(ctx, model, layout);
  await drawCardBox(ctx, model, art, layout);
  return canvas;
}

async function drawStatBar(ctx, model, layout) {
  const cx = BAR.width / 2;
  let y = 14;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Top: card type icons, colour indicator, mana.
  drawTypeIcons(ctx, model.types, y);
  y += TYPE_ROW + 8;

  // Colour indicator (D17): one circle, a wedge per colour in WUBRG order
  // clockwise from the top, divider lines between wedges. Only takes a row
  // when present, pushing the mana block down.
  if (model.colorIndicator) {
    const r = 14;
    const cy = y + r;
    const colours = model.colorIndicator;
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
    y += r * 2 + 8;
  }

  for (const { symbol: code, count } of model.manaCost ?? []) {
    const x = 8;
    // The generic symbol is only for the bar; rules text keeps number symbols (D11).
    if (code === 'generic') ctx.drawImage(genericSymbol, x, y, BAR.icon, BAR.icon);
    else await drawSymbol(ctx, code, x, y, BAR.icon);
    // Every symbol shows its count, X and {0} included (D11).
    ctx.fillStyle = '#fff';
    ctx.font = FONT(count > 9 ? 20 : 24);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), x + BAR.icon + 4, y + BAR.icon / 2 + 1);
    y += BAR.icon + BAR.gap;
  }

  // Middle (D19, 5.6): top to bottom, attaching subtypes (icon-only, D16),
  // supertypes (D15), zone/timing symbols (D12), so zone/timing sits nearest
  // the type line.
  // Boxes stand in for missing icons; zone/timing boxes are gold.
  const middle = [];
  for (const subtype of model.subtypes.filter((t) => SUBTYPE_ICONS[t])) {
    const style = SUBTYPE_ICONS[subtype];
    middle.push({ icon: ICONS.get(style.icon), abbr: style.placeholder });
  }
  // Snow reuses the {S} art.
  for (const supertype of model.supertypes.filter((t) => SUPERTYPE_ICONS[t])) {
    const style = SUPERTYPE_ICONS[supertype];
    const icon = style.manaSymbol ? await symbol(style.manaSymbol) : ICONS.get(style.icon);
    middle.push({ label: style.label, icon });
  }
  for (const z of model.zoneSymbols) {
    const style = ZONE_SYMBOL_STYLE[z];
    middle.push({ label: style.label, zone: true, icon: ICONS.get(style.icon) });
  }
  // Land mana symbols: one icon each in type-line order, centred on the text
  // box. The middle stack has priority: if it spills that far it pushes them
  // down, and it may only spill as far as leaves them room (D16 revised).
  const landMana = [];
  for (const t of model.subtypes.filter((t) => LAND_TYPE_MANA[t])) {
    landMana.push(await symbol(LAND_TYPE_MANA[t]));
  }
  const landHeight = landMana.length * (BAR.icon + MIDDLE.gap);
  const limit = middleLimit(model, layout) - landHeight;
  const anchor = layout.type.y + layout.type.h - 4;
  const stackBottom = drawMiddle(ctx, middle, y + 4, limit, anchor);

  // Loyalty costs, each centred on its ability band (7.2.1, D22).
  for (const band of layout.pw?.bands ?? []) {
    if (band.cost !== null) drawLoyaltyCost(ctx, band.cost, band.top + band.h / 2, band.h);
  }
  let landTop = Math.max(
    layout.text.y + layout.text.h / 2 - landHeight / 2,
    stackBottom + MIDDLE.gap,
  );
  for (const icon of landMana) {
    ctx.drawImage(icon, cx - BAR.icon / 2, landTop, BAR.icon, BAR.icon);
    landTop += BAR.icon + MIDDLE.gap;
  }

  // Bottom: stats, loyalty, defense badge, or NON-PERMANENT (D18, 5.7).
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  const bottom = CARD.height - 14;
  if (model.power !== null) {
    // Vehicles and spacecraft: hollow stats, as they only apply once crewed
    // or stationed (5.7.7).
    const hollow = !model.types.includes('Creature');
    drawStat(
      ctx,
      LABELS.power,
      model.power,
      bottom - 120,
      ICONS.get(STAT_ICONS.power.icon),
      hollow,
    );
    if (hollow) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(18.5, bottom - 63.5, BAR.width - 37, 1);
    } else ctx.fillRect(18, bottom - 64, BAR.width - 36, 2);
    drawStat(
      ctx,
      LABELS.toughness,
      model.toughness,
      bottom - 56,
      ICONS.get(STAT_ICONS.toughness.icon),
      hollow,
    );
  } else if (model.loyalty !== null) {
    // Starting loyalty badge at the bottom of the bar (7.2.3).
    drawBadge(
      ctx,
      ICONS.get(LOYALTY_BADGES.start.icon),
      '#3a3a3a',
      cx,
      bottom - 34,
      76,
      model.loyalty,
    );
  } else if (model.defense !== null) {
    drawDefenseBadge(ctx, model.defense);
  } else if (!isPermanent(model.types)) {
    // Only non-permanents get a label; permanents leave the bottom empty (5.7.3).
    const letters = [...LABELS.nonPermanent];
    ctx.font = LABEL(18);
    ctx.textBaseline = 'bottom';
    letters.reverse().forEach((ch, i) => ctx.fillText(ch, cx, bottom - i * 21));
  }
  ctx.textAlign = 'left';
}

/**
 * One row of type icons in type-line order, shrunk to fit the bar (D14, 5.1.3).
 * Boxes with abbreviations stand in for the icons. Types without an icon
 * (Dungeon, Plane, ...; out of scope for v1) are skipped.
 */
function drawTypeIcons(ctx, types, y) {
  const shown = types.filter((t) => CARD_TYPES[t]);
  if (!shown.length) return;
  const gap = 3;
  const size = Math.min(
    TYPE_ROW,
    Math.floor((BAR.width - 4 - gap * (shown.length - 1)) / shown.length),
  );
  let x = (BAR.width - (size * shown.length + gap * (shown.length - 1))) / 2;
  const top = y + (TYPE_ROW - size) / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const type of shown) {
    const icon = ICONS.get(CARD_TYPES[type].icon);
    if (icon) {
      ctx.drawImage(icon, x, top, size, size);
      x += size + gap;
      continue;
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, top, size, size, size / 5);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    const text = CARD_TYPES[type].placeholder;
    ctx.font = LABEL(fitSize(ctx, text, size - 4, Math.round(size / 2.6), LABEL, 6));
    ctx.fillText(text, x + size / 2, top + size / 2 + 1);
    x += size + gap;
  }
  ctx.restore();
}

/** Value with its icon below (5.7.1), or a text label when there is no icon. */
const MIDDLE = { icon: 40, label: 16, gap: 6, minScale: 0.5 };

/**
 * Lowest y the middle stack may reach when it spills below the type line: the
 * top of the bottom section. Planeswalker loyalty costs use the bar beside the
 * text box (7.2.1), so their stack must stay above the type line.
 */
function middleLimit(model, layout) {
  const bottom = CARD.height - 14;
  if (model.types.includes('Planeswalker')) return layout.type.y + layout.type.h - 4;
  if (model.power !== null) return bottom - 120 - 8;
  if (model.loyalty !== null) return bottom - 60 - 8;
  if (model.defense !== null) return CARD.height - 78 - 8;
  if (!isPermanent(model.types)) return bottom - 13 * 21 - 8;
  return bottom;
}

/**
 * Lay out the middle stack (D19, 4.4 / 5.6.3). It is anchored at the type line
 * and grows upward. If it would meet the mana block (`floor`), it starts just
 * under the mana block and continues below the type line, down to `limit`. If
 * it still doesn't fit, labels are dropped; then icons shrink. Nothing is hidden.
 * Returns the bottom of the stack.
 */
function drawMiddle(ctx, items, floor, limit, anchor) {
  if (!items.length) return 0;
  const height = (labels, scale = 1) =>
    items.reduce(
      (h, it) => h + (MIDDLE.icon + (labels && it.label ? MIDDLE.label : 0) + MIDDLE.gap) * scale,
      0,
    );
  let labels = true;
  let scale = 1;
  if (height(true) > limit - floor) {
    labels = false;
    if (height(false) > limit - floor) {
      scale = Math.max(MIDDLE.minScale, (limit - floor) / height(false));
    }
  }
  const total = height(labels, scale);
  let top = total <= anchor - floor ? anchor - total : floor;
  for (const item of items) top += drawMiddleItem(ctx, item, top, labels, scale);
  if (top > limit + 0.5) {
    // Still overflowing at the minimum size: flag it rather than hide anything.
    ctx.fillStyle = '#e33';
    ctx.fillRect(0, limit, 4, top - limit);
  }
  return top;
}

/** One middle icon (and its label, if shown) at `top`; returns the height used. */
function drawMiddleItem(ctx, { label, zone, icon, abbr }, top, labels, scale) {
  const cx = BAR.width / 2;
  const size = MIDDLE.icon * scale;
  if (icon) ctx.drawImage(icon, cx - size / 2, top, size, size);
  else {
    ctx.strokeStyle = zone ? '#d9a441' : '#777';
    ctx.lineWidth = zone ? 2 : 1;
    ctx.strokeRect(cx - size / 2 + 2, top + 3, size - 4, size - 6);
    if (abbr) {
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = LABEL(Math.round(12 * scale));
      ctx.fillText(abbr, cx, top + size / 2);
    }
  }
  let used = size + MIDDLE.gap * scale;
  if (labels && label) {
    const text = label.toUpperCase();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = LABEL(fitSize(ctx, text, BAR.width - 6, 13, LABEL, 8));
    used += MIDDLE.label * scale;
    ctx.fillText(text, cx, top + size + MIDDLE.label * scale);
  }
  return used;
}

/** Defense badge at the bottom of the bar (D18, 5.7.7). */
function drawDefenseBadge(ctx, defense) {
  drawBadge(
    ctx,
    ICONS.get(DEFENSE_BADGE.icon),
    '#7a1f1f',
    BAR.width / 2,
    CARD.height - 48,
    70,
    defense,
  );
}

/**
 * Value as printed (*, 1+*, X, -1, 15), shrunk to fit the bar (5.7.6). `*` is
 * drawn as a shape the height of the digits, since the font's asterisk is a
 * small raised glyph.
 */
function drawStat(ctx, label, value, y, icon, hollow = false) {
  const cx = BAR.width / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  if (!value.includes('*')) {
    ctx.font = FONT(fitSize(ctx, value, BAR.width - 10, 36, FONT, 14));
    if (hollow) ctx.strokeText(value, cx, y);
    else ctx.fillText(value, cx, y);
  } else {
    drawStarValue(ctx, value, cx, y, hollow);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if (icon) {
    // Faded stands in for a hollow icon until the real outline art exists.
    ctx.globalAlpha = hollow ? 0.45 : 1;
    ctx.drawImage(icon, cx - 10, y + 36, 20, 20);
    ctx.globalAlpha = 1;
  } else {
    ctx.font = LABEL(12);
    ctx.fillText(label, cx, y + 40);
  }
}

/** A value containing `*`: text parts as usual, each `*` as a digit-sized shape. */
function drawStarValue(ctx, value, cx, y, hollow) {
  ctx.textAlign = 'left';
  const parts = value.split(/(\*)/).filter(Boolean);
  let digit;
  let widths;
  for (let size = 36; size >= 14; size -= 1) {
    ctx.font = FONT(size);
    // With a 'top' baseline the ascent is measured up from y (so negative).
    digit = ctx.measureText('0');
    const height = digit.actualBoundingBoxAscent + digit.actualBoundingBoxDescent;
    widths = parts.map((p) => (p === '*' ? height * 0.95 : ctx.measureText(p).width));
    if (widths.reduce((a, b) => a + b, 0) <= BAR.width - 10) break;
  }
  const height = digit.actualBoundingBoxAscent + digit.actualBoundingBoxDescent;
  const middle = y + (digit.actualBoundingBoxDescent - digit.actualBoundingBoxAscent) / 2;
  let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
  parts.forEach((part, i) => {
    if (part === '*') drawAsterisk(ctx, x + widths[i] / 2, middle, height / 2, hollow);
    else if (hollow) ctx.strokeText(part, x, y);
    else ctx.fillText(part, x, y);
    x += widths[i];
  });
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

async function drawCardBox(ctx, model, art, { art: ART, type: TYPE, text: TEXT, pw }) {
  // The frame comes from the real renderer (T-B4).
  const setSymbol = noArt
    ? null
    : await decodeSetSymbol(await setSymbols.fetchSetSymbol(model.setCode));
  drawFrame(ctx, model, {
    env: nodeEnv,
    art,
    setSymbol,
    layout: { art: ART, type: TYPE, text: TEXT },
  });
  const width = BOX.right - BOX.x;

  // Watermark and rules text from the real renderer (T-B5).
  await drawWatermark(ctx, model, assets, TEXT);
  const isBasic = model.supertypes.includes('Basic');
  if (isBasic) {
    const mana = /\{([WUBRGC])\}/.exec(model.oracleText);
    if (mana) await drawSymbol(ctx, mana[1], BOX.x + width / 2 - 90, TEXT.y + TEXT.h / 2 - 90, 180);
  } else {
    if (pw) await drawAbilityBands(ctx, pw, BOX.x + 6, width - 12);
    else await drawRulesText(ctx, model, assets, TEXT);
  }

  // Footer from the real renderer (T-B6).
  await drawFooter(ctx, model, { assets });
  if (model.faceIndex > 0) {
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'top';
    ctx.font = LABEL(14);
    ctx.fillText(`BACK FACE (${model.layout})`, BOX.x + 200, FOOTER.y + 52);
  }
}

/**
 * Per-card geometry. Planeswalkers (7.2.6, D22) get equal-height ability bands,
 * one per Oracle line, sized to the longest; the font shrinks to fit (normal
 * text-fitting rules). If it still doesn't fit at the minimum size, the text box
 * grows upward: the type line moves up with it and the art gets shorter.
 */
function cardLayout(ctx, model) {
  const base = { art: ART, type: TYPE, text: TEXT, pw: null };
  if (!model.types.includes('Planeswalker') || !model.oracleText) return base;
  const width = BOX.right - BOX.x - 12 - 40;
  // One band per Oracle line, with its loyalty cost (T-A7 tokenizer).
  const abilities = tokenizeCard(model).filter((p) => p.kind === 'rules');
  const measure = (size) => {
    const layouts = abilities.map((a) => layoutText(ctx, [a], width, size));
    return { layouts, h: Math.max(...layouts.map((l) => l.height)) + 18 };
  };
  let size = 26;
  let m = measure(size);
  while (size > 12 && m.h * abilities.length > TEXT.h) m = measure(--size);
  const textH = Math.max(TEXT.h, m.h * abilities.length);
  const grow = textH - TEXT.h;
  const text = { y: TEXT.y - grow, h: textH };
  // Equal bands that fill the text box.
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

/** Alternating shaded ability bands, text centred in each (7.2.2). */
async function drawAbilityBands(ctx, pw, x, width) {
  for (const [i, band] of pw.bands.entries()) {
    if (i % 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.09)';
      ctx.fillRect(x, band.top, width, band.h);
    }
    const top = band.top + (band.h - band.layout.height) / 2;
    await drawLines(ctx, assets, band.layout, x + 20, top, width - 40, pw.size);
  }
}

/**
 * Loyalty cost in the bar (D22): the printed-card badge shapes from the Mana
 * font, + pointing up, − down, 0 flat. ±X is drawn like a number. Scales down
 * to fit short bands.
 */
function drawLoyaltyCost(ctx, cost, cy, bandH) {
  const badge = cost.startsWith('+') ? 'up' : cost.startsWith('−') ? 'down' : 'zero';
  const size = Math.min(70, bandH - 4);
  drawBadge(ctx, ICONS.get(LOYALTY_BADGES[badge].icon), '#3a3a3a', BAR.width / 2, cy, size, cost);
}

function fitSize(ctx, text, maxWidth, size, font, min = 12) {
  for (; size > min; size -= 1) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  return size;
}

async function drawContactSheet(cards) {
  const cols = 6;
  const scale = 0.3;
  const w = CARD.width * scale;
  const h = CARD.height * scale;
  const canvas = createCanvas(cols * (w + 10) + 10, Math.ceil(cards.length / cols) * (h + 34) + 10);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.font = FONT(13);
  ctx.textAlign = 'center';
  cards.forEach(([slug, card], i) => {
    const x = 10 + (i % cols) * (w + 10);
    const y = 10 + Math.floor(i / cols) * (h + 34);
    ctx.drawImage(card, x, y, w, h);
    ctx.fillText(slug, x + w / 2, y + h + 18);
  });
  return canvas;
}

const artFetcher = createArtFetcher();
const setSymbols = createSetSymbolFetcher(); // T-A10, shares cache/art/ with the app
const fixtures = loadCardFixtures();
const args = process.argv.slice(2);
const noArt = args.includes('--no-art');
const wanted = args.filter((a) => !a.startsWith('--'));
const dir = path.join(OUT_DIR, 'fixture-preview');
await mkdir(dir, { recursive: true });

// Compare against the previous run so new and changed previews can be listed
// (and opened for review after each change).
const created = [];
const changed = [];
const cards = [];
for (const [slug, model] of [...fixtures, ...stressModels(fixtures)]) {
  if (wanted.length && !wanted.includes(slug)) continue;
  const canvas = await drawCard(model);
  const file = path.join(dir, `${slug}.png`);
  const png = canvas.toBuffer('image/png');
  const previous = await readFile(file).catch(() => null);
  if (!previous) created.push(file);
  else if (!previous.equals(png)) changed.push(file);
  await writeFile(file, png);
  cards.push([slug, canvas]);
}
await writeFile(path.join(dir, '_all.png'), (await drawContactSheet(cards)).toBuffer('image/png'));
// The previews as printable A4 sheets, through the real output code (T-A11).
await writeFile(
  path.join(dir, '_sheets.pdf'),
  await pdfSheets(
    cards.map(([slug, canvas]) => ({ fileName: slug, png: canvas.toBuffer('image/png') })),
  ),
);
console.log(`Wrote ${cards.length} previews, _all.png and _sheets.pdf to ${dir}`);
console.log(
  `New: ${created.length ? created.map((f) => path.relative(process.cwd(), f)).join(' ') : 'none'}`,
);
console.log(
  `Changed: ${changed.length ? changed.map((f) => path.relative(process.cwd(), f)).join(' ') : 'none'}`,
);
if (!noArt) {
  console.log(
    `Art: ${artFetcher.stats.downloaded} downloaded, ${artFetcher.stats.cached} from cache, ${artFetcher.stats.failed} failed`,
  );
}
