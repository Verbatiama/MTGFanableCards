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
import { textFont, labelFont } from '../../src/render/fonts.js';
import { drawFooter } from '../../src/render/footer.js';
import { cardLayout, drawAbilityBands, drawLoyaltyCosts } from '../../src/render/planeswalker.js';
import { drawStatBarBottom, drawStatBarMiddle, drawStatBarTop } from '../../src/render/stat-bar.js';
import { drawBasicLandSymbol, drawRulesText } from '../../src/render/text-box.js';
import { BOX, CARD, FOOTER } from '../../src/config/index.js';

// Card dimensions and fonts come from the real renderer's config (T-B2).
const FONT = textFont;
const LABEL = labelFont;

registerFont(path.join(FONT_DIR, 'Beleren2016-Bold.ttf'), { family: 'Beleren', weight: 'bold' });
registerFont(path.join(FONT_DIR, 'Beleren2016SmallCaps-Bold.ttf'), {
  family: 'Beleren SmallCaps',
  weight: 'bold',
});

// Symbols and icons come from the real asset loader (T-B3).

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

// Layout warnings for the card being drawn (D19, D20), printed after the run.
let warnings = [];
const warn = (message) => warnings.push(message);

async function drawCard(model) {
  const art = await loadArt(model);
  const canvas = createCanvas(CARD.width, CARD.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CARD.width, CARD.height);

  const layout = cardLayout(ctx, model);
  await drawCardBox(ctx, model, art, layout);
  // The bar last: the art box reaches under its icons.
  await drawStatBar(ctx, model, layout);
  return canvas;
}

async function drawStatBar(ctx, model, layout) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Top: card type icons, colour indicator, mana, from the real renderer (T-B7).
  const y = await drawStatBarTop(ctx, model, { assets, warn, art: layout.art, type: layout.type });

  // Middle: the stack hanging from the type line and the land mana symbols,
  // from the real renderer (T-B8).
  await drawStatBarMiddle(ctx, model, {
    assets,
    warn,
    from: y,
    type: layout.type,
    text: layout.text,
  });

  // Loyalty costs, each centred on its ability band, from the real renderer (T-B11).
  if (layout.pw) await drawLoyaltyCosts(ctx, assets, layout.pw);

  // Bottom: stats, loyalty, defense badge, or NON-PERMANENT, from the real
  // renderer (T-B9).
  await drawStatBarBottom(ctx, model, { assets, text: layout.text });
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

  // Rules text from the real renderer (T-B5).
  if (model.supertypes.includes('Basic')) {
    // The large mana symbol, from the real renderer (T-B12).
    await drawBasicLandSymbol(ctx, model, assets);
  } else {
    if (pw) await drawAbilityBands(ctx, assets, pw);
    else await drawRulesText(ctx, model, assets, TEXT, warn);
  }

  // Footer from the real renderer (T-B6).
  await drawFooter(ctx, model, { assets });
  if (model.faceIndex > 0) {
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'top';
    ctx.font = LABEL(14);
    ctx.fillText(`BACK FACE (${model.layout})`, BOX.x + 200, FOOTER.y + 28);
  }
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
  warnings = [];
  const canvas = await drawCard(model);
  for (const message of warnings) console.warn(`${slug}: ${message}`);
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
