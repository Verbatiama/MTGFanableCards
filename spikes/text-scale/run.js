/**
 * Spike: how far can the card's text be scaled up? Two parts, each scaled on
 * its own with the other left as it is (the NON-PERMANENT label was measured
 * here too while it was stacked letters; it is one line since T-B18):
 *
 * - name: the card name in the name bar (TEXT_SIZE.name), shrunk by fitFont
 *   when it doesn't fit the bar's width (6.1);
 * - rules: the text box's starting size (TEXT_SIZE.rules), which drops the
 *   flavour text and then shrinks to fit, down to TEXT_SIZE.minRules (6.4.8);
 *   planeswalkers' ability bands grow into the art instead (7.2.6).
 *
 *   node spikes/text-scale/run.js [--no-art] [--no-db]
 *
 * About 7 minutes with the card data (laying out ~33,000 text boxes), about
 * 12 seconds with --no-db.
 *
 * Renders the card-model fixtures and the real Scryfall edge cases with the
 * real renderer at each scale (the sizes are config objects, changed while it
 * runs), and measures every English card in the local Scryfall data
 * (cache/scryfall; --no-db skips it) the same way, without drawing.
 *
 * Writes out/text-scale/: name.png and rules.png (cards down,
 * scales across) and report.md (the measurements).
 */
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';
import { createCanvas } from 'canvas';
import { DATA_DIR, OUT_DIR } from '../../src/paths.js';
import { registerFonts, renderCardCanvas } from '../../src/render/node.js';
import { fitFont, textFont } from '../../src/render/fonts.js';
import { layoutText } from '../../src/render/text-box.js';
import { cardLayout } from '../../src/render/planeswalker.js';
import { isFullArt } from '../../src/render/frame.js';
import { tokenizeCard } from '../../src/parse/oracle-text.js';
import { mapCard } from '../../src/model/from-scryfall.js';
import { BULK_FILES } from '../../src/data/scryfall-bulk.js';
import { createArtFetcher } from '../../src/art/art-cache.js';
import { createSetSymbolFetcher } from '../../src/art/set-symbols.js';
import { loadCardFixtures } from '../../test/fixtures/cards.js';
import { BOX, CARD, NAME, TEXT, TEXT_PADDING, TEXT_SIZE, TYPE } from '../../src/config/index.js';

const SCALES = [1, 1.1, 1.2, 1.3, 1.4, 1.5];
const BASE = {
  name: TEXT_SIZE.name,
  rules: TEXT_SIZE.rules,
};

/** Sets one part to `scale` × its current size, the others back to theirs. */
function setScale(part, scale) {
  TEXT_SIZE.name = part === 'name' ? Math.round(BASE.name * scale) : BASE.name;
  TEXT_SIZE.rules = part === 'rules' ? Math.round(BASE.rules * scale) : BASE.rules;
}

registerFonts();
const ctx = createCanvas(10, 10).getContext('2d');

// ---- Measurements (no drawing) ------------------------------------------

/** The name: the size fitFont settles on (as frame.js). */
function measureName(model) {
  const width = NAME.right - NAME.x - 30;
  const size = fitFont(ctx, model.name, width, TEXT_SIZE.name, textFont);
  return { size, shrunk: size < TEXT_SIZE.name };
}

const RULES_MAX = Math.round(BASE.rules * SCALES.at(-1));
const rulesFits = new WeakMap();

/**
 * Largest size in [TEXT_SIZE.minRules, RULES_MAX] at which `paragraphs` fit
 * the text box, or minRules − 1 if none does. Found by halving the range, as
 * the laid-out height only grows with the size.
 */
function largestFit(paragraphs, width, height) {
  let lo = TEXT_SIZE.minRules - 1;
  let hi = RULES_MAX;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (layoutText(ctx, paragraphs, width, mid).height <= height) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * The text box, as text-box.js fitText, but also saying whether the flavour
 * was dropped. Each card's largest fitting sizes (with and without flavour)
 * are found once and reused for every starting size. Planeswalkers: their band
 * size and how far the box grows into the art (planeswalker.js cardLayout).
 */
function measureRules(model) {
  if (isFullArt(model) || !model.oracleText) return null;
  if (model.types.includes('Planeswalker')) {
    const layout = cardLayout(ctx, model);
    if (!layout.pw) return null;
    const grow = TEXT.y - layout.text.y;
    return { pw: true, size: layout.pw.size, shrunk: layout.pw.size < TEXT_SIZE.rules, grow };
  }
  if (!rulesFits.has(model)) {
    const width = BOX.right - BOX.x - TEXT_PADDING.x * 2;
    const height = TEXT.h - TEXT_PADDING.top - TEXT_PADDING.bottom;
    const paragraphs = tokenizeCard(model);
    const rules = paragraphs.filter((p) => p.kind === 'rules');
    const hasFlavour = paragraphs.length > rules.length;
    rulesFits.set(model, {
      hasFlavour,
      full: largestFit(paragraphs, width, height),
      rules: hasFlavour ? largestFit(rules, width, height) : null,
    });
  }
  const fit = rulesFits.get(model);
  const start = TEXT_SIZE.rules;
  if (fit.full >= start)
    return { pw: false, size: start, dropped: false, shrunk: false, overflow: false };
  const best = fit.hasFlavour ? fit.rules : fit.full;
  const size = Math.max(TEXT_SIZE.minRules, Math.min(start, best));
  return {
    pw: false,
    size,
    dropped: fit.hasFlavour,
    shrunk: size < start,
    overflow: best < TEXT_SIZE.minRules,
  };
}

// ---- Models --------------------------------------------------------------

async function edgeCaseModels() {
  const file = new URL('../../test/fixtures/scryfall/edge-cases.json', import.meta.url);
  const printings = JSON.parse(await readFile(file, 'utf8'));
  return printings.flatMap(mapCard).map((model) => [`edge-${model.name}`, model]);
}

const SKIP_LAYOUTS = new Set([
  'split',
  'flip',
  'adventure',
  'room',
  'token',
  'double_faced_token',
  'emblem',
  'art_series',
  'planar',
  'scheme',
  'vanguard',
  'augment',
  'host',
  'reversible_card',
]);

/** One model per face of every English card name in Default Cards (first printing seen). */
async function databaseModels() {
  const file = path.join(DATA_DIR, BULK_FILES.default_cards);
  const lines = readline.createInterface({
    input: createReadStream(file).pipe(zlib.createGunzip()),
  });
  const seen = new Set();
  const models = [];
  for await (const line of lines) {
    if (!line.startsWith('{')) continue;
    const card = JSON.parse(line.replace(/,$/, ''));
    if (card.lang !== 'en' || seen.has(card.name)) continue;
    if (
      SKIP_LAYOUTS.has(card.layout) ||
      ['funny', 'memorabilia', 'token'].includes(card.set_type)
    ) {
      continue;
    }
    seen.add(card.name);
    try {
      models.push(...mapCard(card));
    } catch {
      // Not something the renderer takes; skip it.
    }
  }
  return models;
}

// ---- Report --------------------------------------------------------------

const pct = (n, of) => (of ? `${((100 * n) / of).toFixed(1)}%` : '—');

function nameTable(models) {
  const rows = SCALES.map((scale) => {
    setScale('name', scale);
    const fits = models.map(measureName);
    const shrunk = fits.filter((f) => f.shrunk);
    const smallest = Math.min(...fits.map((f) => f.size));
    return `| ${scale}× | ${TEXT_SIZE.name}px | ${shrunk.length} (${pct(shrunk.length, fits.length)}) | ${smallest}px |`;
  });
  return [
    '| Scale | Name size | Names shrunk to fit | Smallest name |',
    '| ----- | --------- | ------------------- | ------------- |',
    ...rows,
  ].join('\n');
}

function rulesTable(models) {
  const rows = SCALES.map((scale) => {
    setScale('rules', scale);
    const fits = models.map(measureRules).filter(Boolean);
    const normal = fits.filter((f) => !f.pw);
    const pws = fits.filter((f) => f.pw);
    const at = (f) => !f.shrunk && !f.dropped;
    const sizes = normal.map((f) => f.size).sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)];
    return (
      `| ${scale}× | ${TEXT_SIZE.rules}px | ${pct(normal.filter(at).length, normal.length)} ` +
      `| ${pct(normal.filter((f) => f.dropped).length, normal.length)} ` +
      `| ${pct(normal.filter((f) => f.shrunk).length, normal.length)} ` +
      `| ${normal.filter((f) => f.overflow).length} | ${median}px ` +
      `| ${pct(pws.filter((f) => f.shrunk).length, pws.length)} ` +
      `| ${pct(pws.filter((f) => f.grow > 0).length, pws.length)} |`
    );
  });
  return [
    '| Scale | Start size | Fit as is | Flavour dropped | Shrunk | Overflow at min | Median size | PW shrunk | PW grows into art |',
    '| ----- | ---------- | --------- | --------------- | ------ | --------------- | ----------- | --------- | ----------------- |',
    ...rows,
  ].join('\n');
}

// ---- Renders -------------------------------------------------------------

/** A grid: one row per card, one column per scale, each a crop of the card. */
async function sheet(part, models, crop, scaleDown) {
  const w = crop.w * scaleDown;
  const h = crop.h * scaleDown;
  const head = 30;
  const left = 0;
  const canvas = createCanvas(
    left + SCALES.length * (w + 10) + 10,
    head + models.length * (h + 10),
  );
  const out = canvas.getContext('2d');
  out.fillStyle = '#fff';
  out.fillRect(0, 0, canvas.width, canvas.height);
  out.fillStyle = '#000';
  out.font = textFont(18);
  out.textAlign = 'center';
  for (const [col, scale] of SCALES.entries()) {
    setScale(part, scale);
    const size = `${part === 'name' ? TEXT_SIZE.name : TEXT_SIZE.rules}px`;
    out.fillText(`${scale}× (${size})`, left + 10 + col * (w + 10) + w / 2, 22);
    for (const [row, [, model]] of models.entries()) {
      const card = await renderCardCanvas(model, await inputs(model));
      const x = left + 10 + col * (w + 10);
      const y = head + row * (h + 10);
      out.drawImage(card, crop.x, crop.y, crop.w, crop.h, x, y, w, h);
      card.width = 0;
    }
  }
  setScale(part, 1);
  return canvas;
}

const args = process.argv.slice(2);
const noArt = args.includes('--no-art');
const artFetcher = createArtFetcher();
const setSymbols = createSetSymbolFetcher();
async function inputs(model) {
  if (noArt) return {};
  return {
    art: await artFetcher.fetchArt(model.artUrl),
    setSymbol: await setSymbols.fetchSetSymbol(model.setCode),
  };
}

const fixtures = [...loadCardFixtures(), ...(await edgeCaseModels())];
const fixtureModels = fixtures.map(([, m]) => m);
const dir = path.join(OUT_DIR, 'text-scale');
await mkdir(dir, { recursive: true });

const report = ['# Text scale spike', ''];
const sections = [
  ['Name bar', 'name', nameTable],
  ['Text box', 'rules', rulesTable],
];
let database = [];
if (!args.includes('--no-db')) {
  database = await databaseModels();
  console.log(`Card data: ${database.length} faces`);
}
for (const [title, , table] of sections) {
  report.push(`## ${title}`, '', `Fixtures and edge cases (${fixtureModels.length} faces):`, '');
  report.push(table(fixtureModels), '');
  if (database.length) {
    report.push(`Every English card in the local Scryfall data (${database.length} faces):`, '');
    report.push(table(database), '');
  }
}
setScale(null, 1);
await writeFile(path.join(dir, 'report.md'), report.join('\n'));

// Cards for each sheet: the longest names and a spread of text boxes.
const byName = [...fixtures].sort((a, b) => b[1].name.length - a[1].name.length).slice(0, 6);
// Text boxes from short to long (with flavour where there is one), spread
// evenly; planeswalkers are in the report (their bands are already shrunk).
const textLength = (m) => (m.oracleText?.length ?? 0) + (m.flavorText?.length ?? 0);
const withText = fixtures
  .filter(([, m]) => measureRules(m) && !m.types.includes('Planeswalker'))
  .sort((a, b) => textLength(a[1]) - textLength(b[1]));
const byText = [0, 0.3, 0.5, 0.7, 0.85, 1].map(
  (q) => withText[Math.round(q * (withText.length - 1))],
);

await writeFile(
  path.join(dir, 'name.png'),
  (await sheet('name', byName, { x: 0, y: 0, w: CARD.width, h: 120 }, 0.6)).toBuffer('image/png'),
);
await writeFile(
  path.join(dir, 'rules.png'),
  (
    await sheet(
      'rules',
      byText,
      { x: 0, y: TYPE.y - 10, w: CARD.width, h: CARD.height - TYPE.y + 10 },
      0.45,
    )
  ).toBuffer('image/png'),
);
console.log(report.join('\n'));
console.log(`\nWrote name.png, rules.png and report.md to ${dir}`);
