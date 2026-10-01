/**
 * Traces raster icons into single-colour SVG symbols for res/symbols/.
 *
 *   node scripts/trace-symbol.js            # rebuild every symbol in SYMBOLS
 *   node scripts/trace-symbol.js types/land # rebuild only matching outputs
 *
 * Sources are the project mockups (Examples/) and magarena PNGs (GPL-3.0),
 * downloaded into cache/magarena/ on first use. See res/symbols/README.md.
 *
 * How it works: each pixel gets an "ink" value from 0 to 1, the outline is
 * found with marching squares at ink 0.5 (interpolated between pixels, so
 * edges are smooth), simplified with Ramer–Douglas–Peucker, and scaled into a
 * 100×100 cell like the mana sheet. Holes (RIP letters, shield bars) are kept
 * with fill-rule="evenodd".
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from 'canvas';
import { CACHE_DIR, ROOT_DIR, SYMBOL_DIR } from '../src/paths.js';

const MAGARENA = 'https://raw.githubusercontent.com/magarena/magarena/master/resources/';
const MAGARENA_CACHE = path.join(CACHE_DIR, 'magarena');

/** Stat-bar icons are white, because the bar is black (4.1). */
const WHITE = '#FFFFFF';
const INK = '#0D0F0F';
const GENERIC_DISC = '#CAC5C0';

/**
 * Every traced symbol. `ink` picks how a pixel counts as part of the glyph:
 * 'dark' = opaque and dark (also ignores white glows), 'alpha' = opaque.
 * `size` is the glyph's longest side in the 100-unit cell.
 */
export const SYMBOLS = [
  // Generic mana (D11): only for the grouped generic cost in the stat bar.
  {
    out: 'generic',
    file: path.join(ROOT_DIR, 'Examples', 'K3uIZAk.jpeg'),
    ink: 'dark',
    fill: INK,
    disc: GENERIC_DISC,
    size: 64,
  },
  // Card type icons (5.1, D14).
  ...['artifact', 'creature', 'enchantment', 'instant', 'land', 'planeswalker', 'sorcery'].map(
    (type) => ({ out: `types/${type}`, magarena: `cardbuilder/images/${type}Symbol.png` }),
  ),
  // Zone and timing symbols (5.4, D12). Flash uses the instant bolt (5.4.1).
  { out: 'zones/flash', magarena: 'cardbuilder/images/instantSymbol.png' },
  { out: 'zones/hand', magarena: 'magic/data/icons/b_hand_zone.png' },
  { out: 'zones/library', magarena: 'magic/data/icons/b_library_zone.png' },
  { out: 'zones/graveyard', magarena: 'magic/data/icons/b_graveyard_zone.png' },
  // Toughness (5.7.1): magarena's round shield, white on transparent.
  { out: 'stats/toughness', magarena: 'magic/data/icons/round-shield.png', ink: 'alpha' },
];

/** Inputs smaller than this are upscaled (bilinear) before tracing. */
const MIN_TRACE_SIZE = 256;
/** Simplification tolerance, in traced pixels. */
const EPSILON = 0.6;
/** Contours shorter than this (in points) are specks and are dropped. */
const MIN_CONTOUR = 12;

async function sourceBytes(symbol) {
  if (symbol.file) return readFile(symbol.file);
  const file = path.join(MAGARENA_CACHE, path.basename(symbol.magarena));
  try {
    return await readFile(file);
  } catch {
    const response = await fetch(MAGARENA + symbol.magarena);
    if (!response.ok) throw new Error(`${symbol.magarena}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(MAGARENA_CACHE, { recursive: true });
    await writeFile(file, bytes);
    return bytes;
  }
}

/** Ink grid with a one-pixel empty border, so every contour closes. */
function inkGrid(img, mode) {
  const scale = Math.max(1, MIN_TRACE_SIZE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = createCanvas(w + 2, h + 2);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 1, 1, w, h);
  const data = ctx.getImageData(0, 0, w + 2, h + 2).data;
  const ink = new Float32Array((w + 2) * (h + 2));
  for (let i = 0; i < ink.length; i++) {
    const [r, g, b, a] = data.subarray(i * 4, i * 4 + 4);
    const alpha = a / 255;
    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    ink[i] = mode === 'alpha' ? alpha : alpha * (1 - luma);
  }
  return { ink, width: w + 2, height: h + 2 };
}

/** Marching squares at ink 0.5 → closed contours as point lists. */
function contours({ ink, width, height }) {
  const ISO = 0.5;
  const at = (x, y) => ink[y * width + x];
  const points = new Map();
  const links = new Map();
  const point = (key, x0, y0, x1, y1) => {
    if (!points.has(key)) {
      const t = (ISO - at(x0, y0)) / (at(x1, y1) - at(x0, y0));
      points.set(key, [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
    return key;
  };
  const link = (a, b) => {
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      if (!links.has(from)) links.set(from, []);
      links.get(from).push(to);
    }
  };

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const tl = at(x, y) > ISO;
      const tr = at(x + 1, y) > ISO;
      const br = at(x + 1, y + 1) > ISO;
      const bl = at(x, y + 1) > ISO;
      const top = () => point(`h${x},${y}`, x, y, x + 1, y);
      const bottom = () => point(`h${x},${y + 1}`, x, y + 1, x + 1, y + 1);
      const left = () => point(`v${x},${y}`, x, y, x, y + 1);
      const right = () => point(`v${x + 1},${y}`, x + 1, y, x + 1, y + 1);
      const edges = [];
      if (tl !== tr) edges.push(top);
      if (tr !== br) edges.push(right);
      if (bl !== br) edges.push(bottom);
      if (tl !== bl) edges.push(left);
      if (edges.length === 2) link(edges[0](), edges[1]());
      else if (edges.length === 4) {
        // Saddle: keep diagonal ink corners apart.
        if (tl) {
          link(top(), right());
          link(bottom(), left());
        } else {
          link(top(), left());
          link(right(), bottom());
        }
      }
    }
  }

  const seen = new Set();
  const loops = [];
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let previous = null;
    let current = start;
    while (current && !seen.has(current)) {
      seen.add(current);
      loop.push(points.get(current));
      const next = links.get(current).find((k) => k !== previous && !seen.has(k));
      previous = current;
      current = next;
    }
    if (loop.length >= MIN_CONTOUR) loops.push(loop);
  }
  return loops;
}

function simplify(points, epsilon) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points.at(-1)];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let max = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const d = Math.abs((b[0] - a[0]) * (a[1] - py) - (a[0] - px) * (b[1] - a[1])) / length;
    if (d > max) [max, index] = [d, i];
  }
  if (max <= epsilon) return [a, b];
  return [
    ...simplify(points.slice(0, index + 1), epsilon).slice(0, -1),
    ...simplify(points.slice(index), epsilon),
  ];
}

/** Closed loop: simplify each half so the start point isn't a forced vertex. */
function simplifyLoop(loop) {
  const half = loop.length >> 1;
  return [
    ...simplify(loop.slice(0, half + 1), EPSILON).slice(0, -1),
    ...simplify(loop.slice(half), EPSILON).slice(0, -1),
  ];
}

function toSvg(loops, symbol) {
  const all = loops.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const size = symbol.size ?? 84;
  const scale = size / Math.max(maxX - minX, maxY - minY);
  const ox = 50 - ((maxX - minX) * scale) / 2;
  const oy = 50 - ((maxY - minY) * scale) / 2;
  const n = (v) => +v.toFixed(2);
  const d = loops
    .map(
      (loop) =>
        'M' +
        loop
          .map(([x, y]) => `${n(ox + (x - minX) * scale)},${n(oy + (y - minY) * scale)}`)
          .join('L') +
        'Z',
    )
    .join('');
  const source = symbol.file
    ? path.relative(ROOT_DIR, symbol.file)
    : `magarena (GPL-3.0): ${MAGARENA}${symbol.magarena}`;
  const disc = symbol.disc ? `\n  <circle cx="50" cy="50" r="50" fill="${symbol.disc}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Traced by scripts/trace-symbol.js from ${source} -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${disc}
  <path fill="${symbol.fill ?? WHITE}" fill-rule="evenodd" d="${d}"/>
</svg>
`;
}

export async function traceSymbol(symbol) {
  const img = await loadImage(await sourceBytes(symbol));
  const loops = contours(inkGrid(img, symbol.ink ?? 'dark')).map(simplifyLoop);
  if (!loops.length) throw new Error(`${symbol.out}: nothing traced`);
  const file = path.join(SYMBOL_DIR, `${symbol.out}.svg`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, toSvg(loops, symbol));
  return {
    symbol: symbol.out,
    contours: loops.length,
    points: loops.reduce((n, l) => n + l.length, 0),
  };
}

const filters = process.argv.slice(2);
const results = [];
for (const symbol of SYMBOLS) {
  if (filters.length && !filters.some((f) => symbol.out.includes(f))) continue;
  results.push(await traceSymbol(symbol));
}
console.table(results);
