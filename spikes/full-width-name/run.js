/**
 * Spike: the name bar runs the full width of the card, over the top of the
 * stat bar, and the stat bar's top section (type icons, colour indicator,
 * mana) starts below it instead of beside it.
 *
 *   node spikes/full-width-name/run.js [--no-art] [slug ...]
 *   node spikes/full-width-name/run.js --card "Progenitus" [--card "<name>" ...]
 *
 * `--card` renders real cards by name from the local Scryfall data
 * (cache/scryfall, printing chosen as for a decklist) instead of the fixtures,
 * and also writes each one's spike render on its own as <slug>-spike.png.
 *
 * Renders every card-model fixture, stress case and edge case with the real
 * renderer twice: as it is, then with the change. The change is made from out
 * here, without touching src/: `BAR_TOP.y` is moved below the name bar before
 * rendering, and the wider name bar is painted over the normal one afterwards
 * (nothing from the stat bar is left in its band once the top section has
 * moved down). The type icons are centred on the mana symbols' centre line
 * rather than the bar's: the renderer's own type icon draws are held back and
 * the row is drawn again at the new place, shrunk only as far as it must be to
 * stay inside the border. The colour indicator is centred on the same line:
 * the renderer gets the card without its indicator (and the top section starts
 * one indicator row lower, so the mana block lands where it would have), and
 * the spike draws the indicator itself.
 *
 * Writes out/full-width-name/<slug>.png (current | spike, side by side) and a
 * contact sheet of the spike renders (_all.png). Prints the layout warnings
 * the change adds (mana rows that no longer fit above the type line, 4.4).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas } from 'canvas';
import { OUT_DIR } from '../../src/paths.js';
import {
  decode,
  decodeSetSymbol,
  nodeAssets,
  nodeEnv,
  registerFonts,
  renderCardCanvas,
} from '../../src/render/node.js';
import { renderCard } from '../../src/render/render-card.js';
import { framePalette } from '../../src/render/frame.js';
import { fitFont, textFont } from '../../src/render/fonts.js';
import { createArtFetcher } from '../../src/art/art-cache.js';
import { createSetSymbolFetcher } from '../../src/art/set-symbols.js';
import { mapCard } from '../../src/model/from-scryfall.js';
import { BULK_FILES } from '../../src/data/scryfall-bulk.js';
import { CardDatabase } from '../../src/data/card-database.js';
import { selectPrinting } from '../../src/data/resolve.js';
import { DATA_DIR } from '../../src/paths.js';
import { fixtureSlug, loadCardFixtures } from '../../test/fixtures/cards.js';
import { stressModels } from '../fixture-preview/stress.js';
import {
  ART,
  BAR,
  BAR_TOP,
  BOX,
  CARD,
  CARD_TYPES,
  INDICATOR,
  NAME,
  TEXT_SIZE,
} from '../../src/config/index.js';

/** The wider name bar: as far in from the left edge as the frame is from the right. */
const SPIKE_NAME = { x: CARD.width - BOX.right, right: BOX.right };
/** The type icon row starts this far below the name bar's pinline (the art's top edge). */
const BELOW_NAME = 8;

const CURRENT_TOP = BAR_TOP.y;
const SPIKE_TOP = ART.y + BELOW_NAME;

// Copied from src/render/frame.js (private there): pinline width, bar corner
// radius, the panel texture, panel and pinline.
const PIN = 6;
const BAR_RADIUS = 16;
let textureCanvas;
function texture(ctx) {
  if (!textureCanvas) {
    textureCanvas = nodeEnv.createCanvas(240, 240);
    const t = textureCanvas.getContext('2d');
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
  return ctx.createPattern(textureCanvas, 'repeat');
}
function panel(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = texture(ctx);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
}
function pinline(ctx, pin, x, y, w, h, r) {
  ctx.strokeStyle = pin;
  ctx.lineWidth = PIN;
  ctx.beginPath();
  ctx.roundRect(x - PIN / 2, y - PIN / 2, w + PIN, h + PIN, r + PIN / 2);
  ctx.stroke();
}
/** One colour, or a left-to-right blend across the (wider) bar. */
function across(ctx, colours, x, right) {
  if (colours.length === 1) return colours[0];
  const gradient = ctx.createLinearGradient(x, 0, right, 0);
  gradient.addColorStop(0.3, colours[0]);
  gradient.addColorStop(0.7, colours[1]);
  return gradient;
}

/** Paints the full-width name bar over the band the normal one and the type icons used. */
function drawWideNameBar(ctx, model) {
  const { x, right } = SPIKE_NAME;
  const width = right - x;
  const palette = framePalette(model);
  ctx.save();
  // Clear the old band (old name bar, its pinline) back to the black bar.
  ctx.fillStyle = '#000';
  ctx.fillRect(x - PIN, NAME.y - PIN, width + PIN * 2, NAME.h + PIN * 2);
  ctx.fillStyle = palette.bar;
  pinline(ctx, across(ctx, palette.pin, x, right), x, NAME.y, width, NAME.h, BAR_RADIUS);
  panel(ctx, x, NAME.y, width, NAME.h, BAR_RADIUS);
  ctx.fillStyle = '#111';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fitFont(ctx, model.name, width - 30, TEXT_SIZE.name, textFont);
  ctx.fillText(model.name, x + 14, NAME.y + NAME.h / 2 + 2);
  ctx.restore();
}

/** The mana symbols' centre line (they sit 8px in from the bar's left edge). */
const MANA_CENTRE = BAR.x + 8 + BAR.icon / 2;

/**
 * The type icon row centred on MANA_CENTRE: icons at full size where they
 * fit, otherwise shrunk so the row stays between the border and the frame's
 * mirror image (2 × (MANA_CENTRE − BAR.x) wide).
 */
function typeRow(model, top) {
  const shown = model.types.filter((t) => CARD_TYPES[t]);
  const n = shown.length;
  const gap = BAR_TOP.typeGap;
  const room = 2 * (MANA_CENTRE - BAR.x);
  const size = Math.min(BAR_TOP.typeRow, Math.floor((room - gap * (n - 1)) / n));
  const left = MANA_CENTRE - (size * n + gap * (n - 1)) / 2;
  return shown.map((type, i) => ({
    type,
    x: left + i * (size + gap),
    y: top + (BAR_TOP.typeRow - size) / 2,
    size,
  }));
}

// Copied from src/render/stat-bar.js (private there): the colour indicator.
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

async function typeIconImages() {
  const images = new Set();
  for (const { icon, placeholder } of Object.values(CARD_TYPES)) {
    images.add(await nodeAssets.iconOrPlaceholder(icon, placeholder));
  }
  return images;
}

async function render(model, inputs, spike) {
  if (!spike) {
    const warnings = [];
    const canvas = await renderCardCanvas(model, { ...inputs, onWarning: (m) => warnings.push(m) });
    return { canvas, warnings };
  }
  registerFonts();
  const canvas = createCanvas(CARD.width, CARD.height);
  const ctx = canvas.getContext('2d');
  // Hold back the renderer's type icons (drawn in the type icon row's band).
  const icons = await typeIconImages();
  const drawImage = ctx.drawImage.bind(ctx);
  ctx.drawImage = (image, ...rest) => {
    const y = rest[1];
    const inRow = rest.length === 4 && y >= BAR_TOP.y && y < BAR_TOP.y + BAR_TOP.typeRow;
    if (!(icons.has(image) && inRow)) drawImage(image, ...rest);
  };
  // Without its indicator, the renderer's top section starts one indicator
  // row lower, so the mana block stays where the indicator would leave it.
  const r = BAR_TOP.indicator;
  const indicatorRow = model.colorIndicator ? r * 2 + BAR_TOP.rowGap : 0;
  BAR_TOP.y = SPIKE_TOP + indicatorRow;
  try {
    const { warnings } = await renderCard(
      ctx,
      { ...model, colorIndicator: null },
      {
        env: nodeEnv,
        assets: nodeAssets,
        art: await decode(inputs.art),
        setSymbol: await decodeSetSymbol(inputs.setSymbol),
      },
    );
    ctx.drawImage = drawImage;
    drawWideNameBar(ctx, model);
    for (const { type, x, y, size } of typeRow(model, SPIKE_TOP)) {
      const { icon, placeholder } = CARD_TYPES[type];
      ctx.drawImage(await nodeAssets.iconOrPlaceholder(icon, placeholder), x, y, size, size);
    }
    if (model.colorIndicator) {
      const cy = SPIKE_TOP + BAR_TOP.typeRow + BAR_TOP.rowGap + r;
      drawIndicator(ctx, { colours: model.colorIndicator, cx: MANA_CENTRE, cy, r });
    }
    return { canvas, warnings };
  } finally {
    BAR_TOP.y = CURRENT_TOP;
  }
}

function sideBySide(before, after) {
  const gap = 20;
  const canvas = createCanvas(CARD.width * 2 + gap, CARD.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(before, 0, 0);
  ctx.drawImage(after, CARD.width + gap, 0);
  return canvas;
}

function contactSheet(cards) {
  const cols = 6;
  const scale = 0.3;
  const w = CARD.width * scale;
  const h = CARD.height * scale;
  const canvas = createCanvas(cols * (w + 10) + 10, Math.ceil(cards.length / cols) * (h + 34) + 10);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.font = textFont(13);
  ctx.textAlign = 'center';
  cards.forEach(([slug, card], i) => {
    const x = 10 + (i % cols) * (w + 10);
    const y = 10 + Math.floor(i / cols) * (h + 34);
    ctx.drawImage(card, x, y, w, h);
    ctx.fillText(slug, x + w / 2, y + h + 18);
  });
  return canvas;
}

async function edgeCaseModels() {
  const file = new URL('../../test/fixtures/scryfall/edge-cases.json', import.meta.url);
  const printings = JSON.parse(await readFile(file, 'utf8'));
  const slug = (name) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  return printings.flatMap(mapCard).map((model) => [`edge-${slug(model.name)}`, model]);
}

/** Real cards by name from the local Scryfall data, one entry per face. */
async function namedModels(names) {
  const db = await CardDatabase.fromFiles({
    defaultCards: path.join(DATA_DIR, BULK_FILES.default_cards),
    uniqueArtwork: path.join(DATA_DIR, BULK_FILES.unique_artwork),
  });
  return names.flatMap((name) => {
    const card = db.lookup(name);
    if (!card)
      throw new Error(`No card named "${name}"; did you mean ${db.suggest(name).join(', ')}?`);
    return mapCard(selectPrinting(card).printing).map((model) => [fixtureSlug(model.name), model]);
  });
}

registerFonts();
const args = process.argv.slice(2);
const noArt = args.includes('--no-art');
const named = args.flatMap((a, i) => (args[i - 1] === '--card' ? [a] : []));
const wanted = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--card');
const artFetcher = createArtFetcher();
const setSymbols = createSetSymbolFetcher();
const fixtures = loadCardFixtures();
const dir = path.join(OUT_DIR, 'full-width-name');
await mkdir(dir, { recursive: true });

const sheet = [];
const added = [];
const models = named.length
  ? await namedModels(named)
  : [...fixtures, ...stressModels(fixtures), ...(await edgeCaseModels())];
for (const [slug, model] of models) {
  if (wanted.length && !wanted.includes(slug)) continue;
  const inputs = noArt
    ? {}
    : {
        art: await artFetcher.fetchArt(model.artUrl),
        setSymbol: await setSymbols.fetchSetSymbol(model.setCode),
      };
  const before = await render(model, inputs, false);
  const after = await render(model, inputs, true);
  const known = new Set(before.warnings);
  for (const message of after.warnings.filter((m) => !known.has(m))) {
    added.push(`${slug}: ${message}`);
  }
  await writeFile(
    path.join(dir, `${slug}.png`),
    sideBySide(before.canvas, after.canvas).toBuffer('image/png'),
  );
  if (named.length) {
    await writeFile(path.join(dir, `${slug}-spike.png`), after.canvas.toBuffer('image/png'));
  }
  sheet.push([slug, after.canvas]);
}
// The contact sheet is for the full fixture run; --card leaves it alone.
if (!named.length) {
  await writeFile(path.join(dir, '_all.png'), contactSheet(sheet).toBuffer('image/png'));
}
console.log(`Wrote ${sheet.length} comparisons (current | spike) and _all.png to ${dir}`);
console.log(
  `Type icon row: y ${CURRENT_TOP} → ${SPIKE_TOP}, centred at x ${BAR.x + BAR.width / 2} → ${MANA_CENTRE}; name bar x ${BOX.x} → ${SPIKE_NAME.x}`,
);
console.log(
  added.length
    ? `Warnings added by the change:\n  ${added.join('\n  ')}`
    : 'Warnings added by the change: none',
);
