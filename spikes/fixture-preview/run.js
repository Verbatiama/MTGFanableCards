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
import { drawSymbol as drawSymbolWith } from '../../src/render/symbols.js';
import { drawFooter } from '../../src/render/footer.js';
import {
  drawBadge,
  drawStatBarBottom,
  drawStatBarMiddle,
  drawStatBarTop,
} from '../../src/render/stat-bar.js';
import { drawLines, drawRulesText, drawWatermark, layoutText } from '../../src/render/text-box.js';
import {
  ART,
  BAR,
  BOX,
  CARD,
  FOOTER,
  TEXT,
  TYPE,
  BADGE_COLOURS,
  LOYALTY_BADGES,
} from '../../src/config/index.js';

// Card dimensions and fonts come from the real renderer's config (T-B2).
const FONT = textFont;
const LABEL = labelFont;

registerFont(path.join(FONT_DIR, 'Beleren2016-Bold.ttf'), { family: 'Beleren', weight: 'bold' });
registerFont(path.join(FONT_DIR, 'Beleren2016SmallCaps-Bold.ttf'), {
  family: 'Beleren SmallCaps',
  weight: 'bold',
});

// Symbols and icons come from the real asset loader (T-B3).
const drawSymbol = (ctx, ...rest) => drawSymbolWith(ctx, assets, ...rest);

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
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Top: card type icons, colour indicator, mana, from the real renderer (T-B7).
  const y = await drawStatBarTop(ctx, model, { assets });

  // Middle: the stack hanging from the type line and the land mana symbols,
  // from the real renderer (T-B8).
  await drawStatBarMiddle(ctx, model, { assets, from: y, type: layout.type, text: layout.text });

  // Loyalty costs, each centred on its ability band (7.2.1, D22).
  for (const band of layout.pw?.bands ?? []) {
    if (band.cost !== null) await drawLoyaltyCost(ctx, band.cost, band.top + band.h / 2, band.h);
  }

  // Bottom: stats, loyalty, defense badge, or NON-PERMANENT, from the real
  // renderer (T-B9).
  await drawStatBarBottom(ctx, model, { assets });
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
async function drawLoyaltyCost(ctx, cost, cy, bandH) {
  const badge = cost.startsWith('+') ? 'up' : cost.startsWith('−') ? 'down' : 'zero';
  const size = Math.min(70, bandH - 4);
  return drawBadge(
    ctx,
    assets,
    LOYALTY_BADGES[badge].icon,
    BADGE_COLOURS.loyalty,
    BAR.width / 2,
    cy,
    size,
    cost,
  );
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
