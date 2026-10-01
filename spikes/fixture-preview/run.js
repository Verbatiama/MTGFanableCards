/**
 * Throwaway preview of the card-model fixtures (T-A2), so their data can be
 * checked by eye before the real renderer (T-B2 onwards) exists. Not the
 * renderer: no icons for types/stats, fixed dimensions. Art crops are
 * downloaded from Scryfall (see art.js); pass --no-art to skip them.
 *
 *   node spikes/fixture-preview/run.js [--no-art] [slug ...]
 *
 * Writes out/fixture-preview/<slug>.png and a contact sheet, _all.png.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { FONT_DIR, OUT_DIR, SYMBOL_DIR } from '../../src/paths.js';
import { extractSymbolSvg, listSymbolCodes } from '../rendering/symbols.js';
import { loadCardFixtures } from '../../test/fixtures/cards.js';
import { fetchArt, stats as artStats } from './art.js';

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

const FRAMES = {
  W: '#f2ecd2',
  U: '#a9cbe8',
  B: '#9e9893',
  R: '#eba98d',
  G: '#a9cba0',
  gold: '#e3c873',
  colourless: '#c9ced2',
  land: '#d3bf98',
};
const PIPS = { W: '#f8f3dc', U: '#4a8fd0', B: '#3b3633', R: '#d9583b', G: '#3f9a54' };
const PERMANENT_TYPES = ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Land', 'Planeswalker'];
// Placeholder type icons until the real set arrives (D14). Full-size icon
// height; two or three types shrink to fit one row.
const TYPE_ROW = 44;
const TYPE_ICONS = {
  Kindred: 'KIN',
  Artifact: 'ART',
  Enchantment: 'ENC',
  Land: 'LND',
  Creature: 'CRE',
  Planeswalker: 'PW',
  Battle: 'BTL',
  Instant: 'INS',
  Sorcery: 'SOR',
};
// Labels for the zone and timing symbols (D12, 5.4.2).
const ZONE_LABELS = {
  flash: 'Flash',
  'split-second': 'Split second',
  hand: 'Hand',
  library: 'Library',
  graveyard: 'Graveyard',
};
// Subtypes of these types don't get icons (5.5.6), so the preview skips them.
const NO_SUBTYPE_ICON = ['Creature', 'Planeswalker', 'Kindred'];

registerFont(path.join(FONT_DIR, 'Beleren2016-Bold.ttf'), { family: 'Beleren', weight: 'bold' });
registerFont(path.join(FONT_DIR, 'Beleren2016SmallCaps-Bold.ttf'), {
  family: 'Beleren SmallCaps',
  weight: 'bold',
});

const sheet = await readFile(path.join(SYMBOL_DIR, 'symbols.svg'), 'utf8');
const sheetCodes = new Set(listSymbolCodes(sheet));
const symbolCache = new Map();
const genericSymbol = await loadImage(path.join(SYMBOL_DIR, 'generic.svg'));

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

function frameColour(model) {
  if (model.colors.length > 1) return FRAMES.gold;
  if (model.colors.length === 1) return FRAMES[model.colors[0]];
  return model.types.includes('Land') ? FRAMES.land : FRAMES.colourless;
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
  const bytes = await fetchArt(model.artUrl);
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

  await drawStatBar(ctx, model);
  await drawCardBox(ctx, model, art);
  return canvas;
}

async function drawStatBar(ctx, model) {
  const cx = BAR.width / 2;
  let y = 14;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Top: card type icons, colour indicator, mana.
  drawTypeIcons(ctx, model.types, y);
  y += TYPE_ROW + 8;

  if (model.colorIndicator) {
    const pip = 16;
    const width = model.colorIndicator.length * (pip + 3) - 3;
    model.colorIndicator.forEach((c, i) => {
      ctx.fillStyle = PIPS[c];
      ctx.beginPath();
      ctx.arc(cx - width / 2 + i * (pip + 3) + pip / 2, y + pip / 2, pip / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    y += pip + 8;
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

  // Middle: anchored at the type line, growing upward. Top to bottom: zone and
  // timing symbols (D12), supertypes, subtypes (5.6.1). Boxes stand in for icons;
  // zone/timing boxes are gold so they stand out from type boxes.
  const middle = model.zoneSymbols.map((z) => ({ label: ZONE_LABELS[z], zone: true }));
  middle.push(...model.supertypes.map((label) => ({ label })));
  if (!model.types.some((t) => NO_SUBTYPE_ICON.includes(t))) {
    middle.push(...model.subtypes.map((label) => ({ label })));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  let my = TYPE.y + TYPE.h - 4;
  for (const { label, zone } of middle.reverse()) {
    const text = label.toUpperCase();
    ctx.fillStyle = '#fff';
    ctx.font = LABEL(fitSize(ctx, text, BAR.width - 6, 13, LABEL, 8));
    ctx.fillText(text, cx, my);
    ctx.strokeStyle = zone ? '#d9a441' : '#777';
    ctx.lineWidth = zone ? 2 : 1;
    ctx.strokeRect(cx - 18, my - 54, 36, 34);
    my -= 62;
  }
  if (my < y) {
    // Flag stat-bar collisions (4.4 / D19) rather than hiding them.
    ctx.fillStyle = '#e33';
    ctx.fillRect(0, my, 4, y - my);
  }

  // Bottom: stats, loyalty/defense, or the permanence label.
  ctx.fillStyle = '#fff';
  const bottom = CARD.height - 14;
  if (model.power !== null) {
    drawStat(ctx, 'PWR', model.power, bottom - 120);
    ctx.fillRect(18, bottom - 64, BAR.width - 36, 2);
    drawStat(ctx, 'TGH', model.toughness, bottom - 56);
  } else if (model.loyalty !== null) {
    drawStat(ctx, 'LOYALTY', model.loyalty, bottom - 60);
  } else if (model.defense !== null) {
    drawStat(ctx, 'DEFENSE', model.defense, bottom - 60);
  } else {
    const permanent = model.types.some((t) => PERMANENT_TYPES.includes(t));
    const letters = [...(permanent ? 'PERMANENT' : 'NON-PERMANENT')];
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
  const shown = types.filter((t) => TYPE_ICONS[t]);
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
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, top, size, size, size / 5);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    const text = TYPE_ICONS[type];
    ctx.font = LABEL(fitSize(ctx, text, size - 4, Math.round(size / 2.6), LABEL, 6));
    ctx.fillText(text, x + size / 2, top + size / 2 + 1);
    x += size + gap;
  }
  ctx.restore();
}

function drawStat(ctx, label, value, y) {
  const cx = BAR.width / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = FONT(value.length > 2 ? 26 : 36);
  ctx.fillText(value, cx, y);
  ctx.font = LABEL(12);
  ctx.fillText(label, cx, y + 40);
}

async function drawCardBox(ctx, model, art) {
  const frame = frameColour(model);
  const width = BOX.right - BOX.x;

  ctx.fillStyle = frame;
  ctx.fillRect(BOX.x - 4, 4, width + 8, CARD.height - 8 - 80);

  // Name bar.
  ctx.fillStyle = shade(frame, 1.12);
  roundRect(ctx, BOX.x, NAME.y, width, NAME.h, 10);
  ctx.fillStyle = '#111';
  ctx.textBaseline = 'middle';
  ctx.font = FONT(fitSize(ctx, model.name, width - 30, 34, FONT));
  ctx.fillText(model.name, BOX.x + 14, NAME.y + NAME.h / 2 + 2);

  // Art box: the art crop, or the black placeholder when there is none (3.4.1).
  const artBox = { x: BOX.x + 6, y: ART.y, w: width - 12, h: ART.h };
  ctx.fillStyle = '#000';
  ctx.fillRect(artBox.x, artBox.y, artBox.w, artBox.h);
  if (art) drawCover(ctx, art, artBox);

  // Type line with the set code standing in for the set symbol.
  ctx.fillStyle = shade(frame, 1.12);
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
  ctx.fillStyle = shade(frame, 1.22);
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
    await drawTextBox(ctx, model, BOX.x + 20, TEXT.y + 14, width - 40, TEXT.h - 24);
  }

  // Footer.
  ctx.fillStyle = '#fff';
  ctx.font = LABEL(15);
  ctx.textBaseline = 'top';
  ctx.fillText(`${model.collectorNumber} ${model.rarity[0].toUpperCase()}`, BOX.x, FOOTER.y + 6);
  ctx.fillText(`${model.setCode} - ${model.lang.toUpperCase()}`, BOX.x, FOOTER.y + 28);
  ctx.textAlign = 'right';
  ctx.fillText(model.artist.toUpperCase(), BOX.right, FOOTER.y + 6);
  ctx.font = FONT(13);
  ctx.fillText(model.copyright, BOX.right, FOOTER.y + 30);
  ctx.textAlign = 'left';
  if (model.faceIndex > 0) {
    ctx.font = LABEL(14);
    ctx.fillText(`BACK FACE (${model.layout})`, BOX.x + 200, FOOTER.y + 52);
  }
}

/**
 * Wraps oracle and flavour text with inline symbols, shrinking the font until
 * it fits (a stand-in for the real text fitting, 6.4.8).
 */
async function drawTextBox(ctx, model, x, y, width, height) {
  const paragraphs = model.oracleText ? model.oracleText.split('\n').map((t) => ({ t })) : [];
  if (model.flavorText) paragraphs.push({ t: model.flavorText, flavor: true });

  let size = 26;
  let layout;
  for (; size >= 12; size -= 1) {
    layout = layoutText(ctx, paragraphs, width, size);
    if (layout.height <= height) break;
  }

  for (const line of layout.lines) {
    ctx.fillStyle = line.flavor ? '#3a3a3a' : '#111';
    ctx.font = FONT(line.flavor ? size - 2 : size);
    ctx.textBaseline = 'alphabetic';
    let lx = x;
    for (const token of line.tokens) {
      if (token.symbol) {
        const s = Math.round(size * 0.95);
        await drawSymbol(ctx, token.symbol, lx + 1, y + line.y - s * 0.82, s);
      } else {
        ctx.fillText(token.text, lx, y + line.y);
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
    ctx.font = FONT(p.flavor ? size - 2 : size);
    if (pi > 0) cursor += Math.round(size * (p.flavor ? 0.7 : 0.35));
    const tokens = p.t
      .split(/(\{[^}]+\}|\s+)/)
      .filter(Boolean)
      .map((part) => {
        const sym = /^\{(.+)\}$/.exec(part);
        if (sym) return { symbol: sym[1], width: Math.round(size * 0.95) + 2 };
        return { text: part, width: ctx.measureText(part).width, space: /^\s+$/.test(part) };
      });
    let line = { tokens: [], flavor: p.flavor, rule: p.flavor && !lines.some((l) => l.flavor) };
    let lineWidth = 0;
    const push = () => {
      while (line.tokens.at(-1)?.space) line.tokens.pop();
      cursor += lineHeight;
      line.y = cursor;
      lines.push(line);
      line = { tokens: [], flavor: p.flavor };
      lineWidth = 0;
    };
    for (const token of tokens) {
      if (lineWidth + token.width > width && line.tokens.length && !token.space) push();
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
 * sides. Cropping is still open (3.4.2); this is the simplest choice.
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

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift) => Math.min(255, Math.round(((n >> shift) & 255) * factor));
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
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

const fixtures = loadCardFixtures();
const args = process.argv.slice(2);
const noArt = args.includes('--no-art');
const wanted = args.filter((a) => !a.startsWith('--'));
const dir = path.join(OUT_DIR, 'fixture-preview');
await mkdir(dir, { recursive: true });

const cards = [];
for (const [slug, model] of fixtures) {
  if (wanted.length && !wanted.includes(slug)) continue;
  const canvas = await drawCard(model);
  await writeFile(path.join(dir, `${slug}.png`), canvas.toBuffer('image/png'));
  cards.push([slug, canvas]);
}
await writeFile(path.join(dir, '_all.png'), (await drawContactSheet(cards)).toBuffer('image/png'));
console.log(`Wrote ${cards.length} previews and _all.png to ${dir}`);
if (!noArt) {
  console.log(
    `Art: ${artStats.downloaded} downloaded, ${artStats.cached} from cache, ${artStats.failed} failed`,
  );
}
