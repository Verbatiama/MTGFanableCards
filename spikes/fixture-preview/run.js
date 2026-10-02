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
import { FONT_DIR, OUT_DIR, SYMBOL_DIR } from '../../src/paths.js';
import { extractSymbolSvg, listSymbolCodes } from '../rendering/symbols.js';
import { loadCardFixtures } from '../../test/fixtures/cards.js';
import { createArtFetcher } from '../../src/art/art-cache.js';
import { pdfSheets } from '../../src/output/index.js';
import { stressModels } from './stress.js';
import { tokenizeCard } from '../../src/parse/oracle-text.js';
import {
  CARD_TYPES,
  FRAME,
  INDICATOR,
  LABELS,
  LAND_FRAME as LAND,
  LAND_TYPE_MANA,
  STAT_ICONS,
  SUBTYPE_ICONS,
  SUPERTYPE_ICONS,
  ZONE_SYMBOL_STYLE,
  isPermanent,
} from '../../src/config/index.js';

const CARD = { width: 750, height: 1050 };
const BAR = { width: 90, icon: 40, gap: 6 };
const BOX = { x: BAR.width + 10, right: CARD.width - 12 };
const NAME = { y: 12, h: 58 };
const ART = { y: 76, h: 440 };
const TYPE = { y: 522, h: 50 };
const TEXT = { y: 578, h: 380 };
const FOOTER = { y: 966 };

const FONT = (size) => `bold ${size}px "Beleren"`;
const LABEL = (size) => `bold ${size}px "Beleren SmallCaps"`;

// Placeholder type icons until the real set arrives (D14). Full-size icon
// height; two or three types shrink to fit one row.
const TYPE_ROW = 44;

registerFont(path.join(FONT_DIR, 'Beleren2016-Bold.ttf'), { family: 'Beleren', weight: 'bold' });
registerFont(path.join(FONT_DIR, 'Beleren2016SmallCaps-Bold.ttf'), {
  family: 'Beleren SmallCaps',
  weight: 'bold',
});

const sheet = await readFile(path.join(SYMBOL_DIR, 'symbols.svg'), 'utf8');
const sheetCodes = new Set(listSymbolCodes(sheet));
const symbolCache = new Map();
const genericSymbol = await loadImage(path.join(SYMBOL_DIR, 'generic.svg'));

// Traced icons from res/symbols/ (see its README). Missing ones fall back to
// labelled boxes, so the preview shows what still needs an icon.
const ICONS = new Map();
for (const name of [
  ...Object.values(CARD_TYPES).map((t) => t.icon),
  ...Object.values(ZONE_SYMBOL_STYLE).map((z) => z.icon),
  ...Object.values(SUPERTYPE_ICONS)
    .filter((t) => t.icon)
    .map((t) => t.icon),
  ...Object.values(STAT_ICONS).map((t) => t.icon),
]) {
  try {
    ICONS.set(name, await loadImage(path.join(SYMBOL_DIR, `${name}.svg`)));
  } catch {
    // Not traced yet.
  }
}

/** Scryfall symbol ('U', 'W/U', 'B/P', 'T', 'S', '12') → loaded sheet image, or null. */
async function symbol(code) {
  const key = sheetCode(code);
  if (!key) return null;
  if (!symbolCache.has(key)) {
    symbolCache.set(key, await loadImage(Buffer.from(extractSymbolSvg(sheet, key, 160))));
  }
  return symbolCache.get(key);
}

function sheetCode(code) {
  const c = code.toLowerCase();
  if (c === 's') return 'snow';
  // The sheet labels Phyrexian as 'pb', hybrids as 'wu', mono-hybrids as '2w'.
  const phyrexian = /^([wubrg])\/p$/.exec(c);
  const key = phyrexian ? `p${phyrexian[1]}` : c.replace('/', '');
  return sheetCodes.has(key) ? key : null;
}

/**
 * Land palettes (D21 revised): the card's colours if it has any, otherwise the
 * colours it taps for. None → colourless grey, one → that colour, two → split,
 * three or more (or "any color") → gold.
 */
function landPalettes(model) {
  const colours = model.colors.length ? model.colors : producedColours(model);
  if (!colours.length) return [LAND.colourless];
  if (colours.length > 2) return [LAND.gold];
  return colours.map((c) => LAND[c]);
}

/** Fill or stroke style across the card box: one colour, or a left-to-right blend. */
function acrossBox(ctx, colours) {
  if (colours.length === 1) return colours[0];
  const gradient = ctx.createLinearGradient(BOX.x, 0, BOX.right, 0);
  gradient.addColorStop(0.3, colours[0]);
  gradient.addColorStop(0.7, colours[1]);
  return gradient;
}

let speckles;
/** Seeded transparent speckles laid over every border, for its texture. */
function texture(ctx) {
  if (!speckles) {
    speckles = createCanvas(240, 240);
    const t = speckles.getContext('2d');
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 900; i++) {
      t.fillStyle = rand() < 0.55 ? 'rgba(70,50,35,0.18)' : 'rgba(245,230,205,0.22)';
      t.beginPath();
      t.ellipse(
        rand() * 240,
        rand() * 240,
        2 + rand() * 9,
        1 + rand() * 4,
        rand() * 3,
        0,
        Math.PI * 2,
      );
      t.fill();
    }
  }
  return ctx.createPattern(speckles, 'repeat');
}

/**
 * Border, pinline, bar and text-box styles for a card (6.6, D21), matching
 * real cards. Lands: stone border, colour from card colour or produced mana.
 * One colour: that frame. Two-colour hybrid: split border, pinlines and text
 * box with grey bars. Other multicolour: gold, with pinlines in the card's two
 * colours (gold pinlines for three or more). Colourless: artifact frame for
 * artifacts, colourless (Eldrazi) frame otherwise; devoid shows its art
 * through the border, tinted by its mana colours.
 */
function framePaint(ctx, model) {
  if (model.types.includes('Land')) {
    const p = landPalettes(model);
    return {
      border: LAND.stone,
      bar: p.length === 2 ? LAND.splitBar : p[0].bar,
      text: acrossBox(
        ctx,
        p.map((x) => x.text),
      ),
      pin: acrossBox(
        ctx,
        p.map((x) => x.pin),
      ),
    };
  }
  const { colors } = model;
  const printed = manaColours(model).filter((c) => colors.includes(c));
  const pair = printed.length === 2 ? printed : colors;
  if (colors.length === 1) return paletteOf(FRAME[colors[0]]);
  if (colors.length === 2) {
    // Two-colour hybrid, Phyrexian hybrid ({G/W/P}) included.
    const hybrid = (model.manaCost ?? []).find((m) => /^[WUBRG]\/[WUBRG](\/P)?$/.test(m.symbol));
    if (hybrid) {
      const sides = hybrid.symbol
        .split('/')
        .slice(0, 2)
        .map((c) => FRAME[c]);
      return {
        border: acrossBox(
          ctx,
          sides.map((x) => x.border),
        ),
        pin: acrossBox(
          ctx,
          sides.map((x) => x.pin),
        ),
        bar: FRAME.hybridBar,
        text: acrossBox(
          ctx,
          sides.map((x) => mix(x.text, FRAME.hybridText, 0.5)),
        ),
      };
    }
    return {
      ...FRAME.gold,
      pin: acrossBox(
        ctx,
        pair.map((c) => FRAME[c].pin),
      ),
    };
  }
  if (colors.length > 2) return paletteOf(FRAME.gold);
  const tints = manaColours(model);
  if (tints.length) {
    const tint = tints.length > 2 ? FRAME.gold.border : FRAME[tints[0]].border;
    return {
      ...FRAME.devoid,
      border: hexAlpha(mix('#c8c0a8', tint, 0.3), 0.5),
      devoid: true,
    };
  }
  return paletteOf(model.types.includes('Artifact') ? FRAME.artifact : FRAME.colourless);
}

function paletteOf({ border, pin, bar, text }) {
  return { border, pin, bar, text };
}

/** '#rrggbb' at the given opacity. */
function hexAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Coloured pinline around a frame panel. */
function pinline(ctx, pin, x, y, w, h, r) {
  if (!pin) return;
  ctx.strokeStyle = pin;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x - 2, y - 2, w + 4, h + 4, r + 2);
  ctx.stroke();
}

/** Colours in a mana cost, in printed order (a devoid card's tint). */
function manaColours(model) {
  const found = (model.manaCost ?? []).flatMap((m) => m.symbol.match(/[WUBRG]/g) ?? []);
  return [...new Set(found)];
}

/**
 * Colours a land taps for, from its "Add ..." clauses and basic land types, in
 * the order found. "Any color" counts as all five.
 */
function producedColours(model) {
  const found = [];
  for (const [clause] of model.oracleText.matchAll(/Add [^.]*/g)) {
    if (/any colou?r/i.test(clause)) return [...'WUBRG'];
    found.push(...[...clause.matchAll(/\{([WUBRG])\}/g)].map((m) => m[1]));
  }
  const landTypes = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };
  found.push(...model.subtypes.map((t) => landTypes[t]).filter(Boolean));
  return [...new Set(found)];
}

/** Grey circle with text, for symbols the sheet doesn't have (e.g. G/U/P). */
function drawFallbackSymbol(ctx, code, x, y, size) {
  ctx.save();
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = FONT(Math.round(size / (code.length > 2 ? 3.2 : 2)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, x + size / 2, y + size / 2 + 1);
  ctx.restore();
}

async function drawSymbol(ctx, code, x, y, size) {
  const img = await symbol(code);
  if (img) ctx.drawImage(img, x, y, size, size);
  else drawFallbackSymbol(ctx, code, x, y, size);
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
    middle.push({ abbr: SUBTYPE_ICONS[subtype].placeholder });
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
    drawStat(ctx, LABELS.loyalty, model.loyalty, bottom - 60);
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

/**
 * Placeholder defense badge (D18, 5.7.7): a shield outline at the bottom of the
 * bar, like the planeswalker loyalty badge (7.2.3), until the icon exists.
 */
function drawDefenseBadge(ctx, defense) {
  const cx = BAR.width / 2;
  const w = 56;
  const top = CARD.height - 78;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, top);
  ctx.lineTo(cx + w / 2, top);
  ctx.lineTo(cx + w / 2, top + 36);
  ctx.quadraticCurveTo(cx + w / 2, top + 58, cx, top + 70);
  ctx.quadraticCurveTo(cx - w / 2, top + 58, cx - w / 2, top + 36);
  ctx.closePath();
  ctx.fillStyle = '#7a1f1f';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = FONT(fitSize(ctx, defense, w - 12, 32, FONT, 14));
  ctx.fillText(defense, cx, top + 30);
  ctx.restore();
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
  const paint = framePaint(ctx, model);
  const width = BOX.right - BOX.x;

  // Border: colour (or the art showing through, for devoid) plus texture.
  const frameBox = { x: BOX.x - 4, y: 4, w: width + 8, h: CARD.height - 8 - 80 };
  if (paint.devoid && art) drawCover(ctx, art, frameBox);
  ctx.fillStyle = paint.border;
  ctx.fillRect(frameBox.x, frameBox.y, frameBox.w, frameBox.h);
  ctx.fillStyle = texture(ctx);
  ctx.fillRect(frameBox.x, frameBox.y, frameBox.w, frameBox.h);

  // Name bar.
  ctx.fillStyle = paint.bar;
  pinline(ctx, paint.pin, BOX.x, NAME.y, width, NAME.h, 10);
  roundRect(ctx, BOX.x, NAME.y, width, NAME.h, 10);
  ctx.fillStyle = '#111';
  ctx.textBaseline = 'middle';
  ctx.font = FONT(fitSize(ctx, model.name, width - 30, 34, FONT));
  ctx.fillText(model.name, BOX.x + 14, NAME.y + NAME.h / 2 + 2);

  // Art box: the art crop, or the black placeholder when there is none (3.4.1).
  const artBox = { x: BOX.x + 6, y: ART.y, w: width - 12, h: ART.h };
  pinline(ctx, paint.pin, artBox.x, artBox.y, artBox.w, artBox.h, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(artBox.x, artBox.y, artBox.w, artBox.h);
  if (art) drawCover(ctx, art, artBox);

  // Type line with the set code standing in for the set symbol.
  ctx.fillStyle = paint.bar;
  pinline(ctx, paint.pin, BOX.x, TYPE.y, width, TYPE.h, 10);
  roundRect(ctx, BOX.x, TYPE.y, width, TYPE.h, 10);
  ctx.fillStyle = '#111';
  ctx.font = FONT(fitSize(ctx, model.typeLine, width - 100, 24, FONT));
  ctx.fillText(model.typeLine, BOX.x + 14, TYPE.y + TYPE.h / 2 + 2);
  ctx.font = LABEL(16);
  ctx.textAlign = 'right';
  ctx.fillText(
    `${model.setCode} ${model.rarity[0].toUpperCase()}`,
    BOX.right - 14,
    TYPE.y + TYPE.h / 2,
  );
  ctx.textAlign = 'left';

  // Text box.
  pinline(ctx, paint.pin, BOX.x + 6, TEXT.y, width - 12, TEXT.h, 0);
  ctx.fillStyle = paint.text;
  ctx.fillRect(BOX.x + 6, TEXT.y, width - 12, TEXT.h);
  if (model.watermark) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.font = LABEL(60);
    ctx.textAlign = 'center';
    ctx.fillText(model.watermark.toUpperCase(), BOX.x + width / 2, TEXT.y + TEXT.h / 2);
    ctx.textAlign = 'left';
  }
  const isBasic = model.supertypes.includes('Basic');
  if (isBasic) {
    const mana = /\{([WUBRGC])\}/.exec(model.oracleText);
    if (mana) await drawSymbol(ctx, mana[1], BOX.x + width / 2 - 90, TEXT.y + TEXT.h / 2 - 90, 180);
  } else {
    if (pw) await drawAbilityBands(ctx, pw, BOX.x + 6, width - 12);
    else await drawTextBox(ctx, model, BOX.x + 20, TEXT.y + 14, width - 40, TEXT.h - 24);
  }

  // Footer.
  ctx.fillStyle = '#fff';
  ctx.font = LABEL(15);
  ctx.textBaseline = 'top';
  ctx.fillText(`${model.collectorNumber} ${model.rarity[0].toUpperCase()}`, BOX.x, FOOTER.y + 6);
  ctx.fillText(`${model.setCode} - ${model.lang.toUpperCase()}`, BOX.x, FOOTER.y + 28);
  ctx.textAlign = 'right';
  ctx.fillText(model.artist.toUpperCase(), BOX.right, FOOTER.y + 6);
  // Copyright year is the year the image is generated; no holo stamp (D20).
  ctx.font = FONT(13);
  ctx.fillText(`™ & © ${new Date().getFullYear()} Wizards of the Coast`, BOX.right, FOOTER.y + 30);
  ctx.textAlign = 'left';
  if (model.faceIndex > 0) {
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
    await drawLines(ctx, band.layout, x + 20, top, width - 40, pw.size);
  }
}

/**
 * Loyalty cost marker in the bar (D22), shaped like printed cards: + points
 * up, − points down, 0 is flat. ±X is drawn like a number. Scales down to
 * fit short bands, so markers never touch.
 */
function drawLoyaltyCost(ctx, cost, cy, bandH) {
  const cx = BAR.width / 2;
  const scale = Math.min(1, (bandH - 6) / 52);
  const w = 66 * scale;
  const h = 34 * scale;
  const tip = 9 * scale;
  const [l, r, t, b] = [cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2];
  ctx.save();
  ctx.beginPath();
  if (cost.startsWith('+')) {
    ctx.moveTo(l, b);
    ctx.lineTo(l, t + tip);
    ctx.lineTo(cx, t - tip);
    ctx.lineTo(r, t + tip);
    ctx.lineTo(r, b);
  } else if (cost.startsWith('−')) {
    ctx.moveTo(l, t);
    ctx.lineTo(r, t);
    ctx.lineTo(r, b - tip);
    ctx.lineTo(cx, b + tip);
    ctx.lineTo(l, b - tip);
  } else {
    ctx.rect(l, t, w, h);
  }
  ctx.closePath();
  ctx.fillStyle = '#3a3a3a';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = FONT(fitSize(ctx, cost, w - 10, Math.round(24 * scale), FONT, 10));
  ctx.fillText(cost, cx, cy + 1);
  ctx.restore();
}

/**
 * Wraps oracle and flavour text with inline symbols (6.4.8, D20): if the text
 * doesn't fit at full size, flavour text is dropped first, then the rules text
 * shrinks to the minimum.
 */
async function drawTextBox(ctx, model, x, y, width, height) {
  const paragraphs = tokenizeCard(model);
  const rules = paragraphs.filter((p) => p.kind === 'rules');
  const flavor = paragraphs.filter((p) => p.kind === 'flavor');

  let size = 26;
  let layout = layoutText(ctx, [...rules, ...flavor], width, size);
  if (layout.height > height) {
    for (; size >= 12; size -= 1) {
      layout = layoutText(ctx, rules, width, size);
      if (layout.height <= height) break;
    }
  }

  await drawLines(ctx, layout, x, y, width, size);
}

/** Draw lines from layoutText at (x, y). */
async function drawLines(ctx, layout, x, y, width, size) {
  for (const line of layout.lines) {
    ctx.fillStyle = line.flavor ? '#3a3a3a' : '#111';
    ctx.font = FONT(line.flavor ? size - 2 : size);
    ctx.textBaseline = 'alphabetic';
    let lx = x;
    for (const token of line.tokens) {
      if (token.pt) {
        // Sword / shield after each number of a +N/+N or -N/-N modifier (6.4.5).
        const s = Math.round(size * 0.95);
        const icon = ICONS.get(`stats/${token.pt}`);
        if (icon) ctx.drawImage(icon, lx + 1, y + line.y - s * 0.82, s, s);
        else
          drawFallbackSymbol(
            ctx,
            token.pt === 'power' ? 'P' : 'T',
            lx + 1,
            y + line.y - s * 0.82,
            s,
          );
        ctx.fillStyle = line.flavor ? '#3a3a3a' : '#111';
      } else if (token.symbol) {
        const s = Math.round(size * 0.95);
        await drawSymbol(ctx, token.symbol, lx + 1, y + line.y - s * 0.82, s);
      } else {
        ctx.font = FONT(line.flavor ? size - 2 : size);
        if (token.italic) {
          // Slant around the baseline (no italic cut in Beleren).
          ctx.save();
          ctx.translate(lx, y + line.y);
          ctx.transform(1, 0, -0.2, 1, 0, 0);
          ctx.fillText(token.text, 0, 0);
          ctx.restore();
        } else ctx.fillText(token.text, lx, y + line.y);
      }
      lx += token.width;
    }
    if (line.rule) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, y + line.y - size * 1.25, width, 1.5);
    }
  }
}

function layoutText(ctx, paragraphs, width, size) {
  const lineHeight = Math.round(size * 1.22);
  const lines = [];
  let cursor = 0;
  paragraphs.forEach((p, pi) => {
    const flavor = p.kind === 'flavor';
    const textSize = flavor ? size - 2 : size;
    ctx.font = FONT(textSize);
    if (pi > 0) cursor += Math.round(size * (flavor ? 0.7 : 0.35));
    const icon = { width: Math.round(size * 0.95) + 2 };
    const measured = (text, italic) => ({ text, italic, width: ctx.measureText(text).width });
    // Tokenizer output (T-A7) → words, spaces, symbols and sword/shield groups.
    const tokens = [];
    for (const t of p.tokens) {
      if (t.type === 'symbol') {
        tokens.push({ symbol: t.symbol, ...icon });
      } else if (t.type === 'pt') {
        tokens.push(
          { ...measured(`${t.power} `, false), joined: true },
          { pt: 'power', ...icon, joined: true },
          { ...measured(` ${t.toughness} `, false), joined: true },
          { pt: 'toughness', ...icon, joined: false },
        );
      } else {
        for (const part of t.text.split(/(\s+)/).filter(Boolean)) {
          // Text straight after a modifier (e.g. the "." in "+2/+2.") stays with it.
          const last = tokens.at(-1);
          if (last?.pt === 'toughness' && !/^\s/.test(part)) last.joined = true;
          tokens.push({ ...measured(part, t.italic), space: /^\s+$/.test(part) });
        }
      }
    }
    let line = { tokens: [], flavor, rule: flavor && !lines.some((l) => l.flavor) };
    let lineWidth = 0;
    const push = () => {
      while (line.tokens.at(-1)?.space) line.tokens.pop();
      cursor += lineHeight;
      line.y = cursor;
      lines.push(line);
      line = { tokens: [], flavor };
      lineWidth = 0;
    };
    for (const [i, token] of tokens.entries()) {
      // Wrap before a modifier group as a whole, never inside it.
      const groupWidth =
        token.joined && !tokens[i - 1]?.joined
          ? tokens
              .slice(i)
              .reduce((w, t, j, rest) => (j && !rest[j - 1].joined ? w : w + t.width), 0)
          : token.width;
      if (tokens[i - 1]?.joined) {
        line.tokens.push(token);
        lineWidth += token.width;
        continue;
      }
      if (lineWidth + groupWidth > width && line.tokens.length && !token.space) push();
      if (token.space && !line.tokens.length) continue;
      line.tokens.push(token);
      lineWidth += token.width;
    }
    push();
  });
  return { lines, height: cursor + 6 };
}

/**
 * Scales the image to cover the box and crops the overflow evenly from both
 * sides (3.4.2).
 */
function drawCover(ctx, img, box) {
  const scale = Math.max(box.w / img.width, box.h / img.height);
  const sw = box.w / scale;
  const sh = box.h / scale;
  ctx.drawImage(
    img,
    (img.width - sw) / 2,
    (img.height - sh) / 2,
    sw,
    sh,
    box.x,
    box.y,
    box.w,
    box.h,
  );
}

function fitSize(ctx, text, maxWidth, size, font, min = 12) {
  for (; size > min; size -= 1) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  return size;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Blend two hex colours; `amount` 0 = a, 1 = b. */
function mix(a, b, amount) {
  const [x, y] = [a, b].map((hex) => parseInt(hex.slice(1), 16));
  const channel = (shift) =>
    Math.round(((x >> shift) & 255) * (1 - amount) + ((y >> shift) & 255) * amount);
  return `#${[16, 8, 0].map((sh) => channel(sh).toString(16).padStart(2, '0')).join('')}`;
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

const artFetcher = createArtFetcher(); // T-A10, shares cache/art/ with the app
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
