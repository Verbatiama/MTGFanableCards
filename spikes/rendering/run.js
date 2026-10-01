/**
 * T-B1 rendering spike. Draws spikes/rendering/scene.js with each candidate
 * backend and writes out/spike/<backend>.png.
 *
 *   node spikes/rendering/run.js
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { FONT_DIR, OUT_DIR, SYMBOL_DIR } from '../../src/paths.js';
import { extractSymbolSvg, listSymbolCodes } from './symbols.js';
import { CARD, drawScene } from './scene.js';

const SYMBOL_CODES = ['2', 'u', 'r', 'wu', 't'];
const ITERATIONS = 20;

const FONTS = [
  { file: 'Beleren2016-Bold.ttf', family: 'Beleren' },
  { file: 'Beleren2016SmallCaps-Bold.ttf', family: 'Beleren SmallCaps' },
];

const backends = {
  async 'node-canvas'() {
    const { createCanvas, loadImage, registerFont } = await import('canvas');
    for (const font of FONTS)
      registerFont(path.join(FONT_DIR, font.file), { family: font.family, weight: 'bold' });
    return {
      createCanvas,
      loadSvg: (svg) => loadImage(Buffer.from(svg)),
      toPng: (canvas) => canvas.toBuffer('image/png'),
    };
  },
  async 'napi-rs-canvas'() {
    const { createCanvas, loadImage, GlobalFonts } = await import('@napi-rs/canvas');
    for (const font of FONTS)
      GlobalFonts.registerFromPath(path.join(FONT_DIR, font.file), font.family);
    return {
      createCanvas,
      loadSvg: (svg) => loadImage(Buffer.from(svg)),
      toPng: (canvas) => canvas.encode('png'),
    };
  },
};

async function run(name, sheet) {
  const t0 = performance.now();
  const backend = await backends[name]();
  const symbols = {};
  // Load at 4× the bar size so raster backends still look sharp when scaled.
  for (const code of SYMBOL_CODES)
    symbols[code] = await backend.loadSvg(extractSymbolSvg(sheet, code, 200));
  const setupMs = performance.now() - t0;

  let png;
  const t1 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const canvas = backend.createCanvas(CARD.width, CARD.height);
    drawScene(canvas.getContext('2d'), symbols);
    png = await backend.toPng(canvas);
  }
  const perCardMs = (performance.now() - t1) / ITERATIONS;

  const file = path.join(OUT_DIR, 'spike', `${name}.png`);
  await writeFile(file, png);
  await writeFile(
    path.join(OUT_DIR, 'spike', `${name}-symbols.png`),
    await backend.toPng(await drawContactSheet(backend, sheet)),
  );
  return {
    backend: name,
    setupMs: setupMs.toFixed(0),
    perCardMs: perCardMs.toFixed(1),
    pngKB: (png.length / 1024).toFixed(0),
    file,
  };
}

/** Every symbol in the sheet with its code, to check extraction and SVG support. */
async function drawContactSheet(backend, sheet) {
  const codes = listSymbolCodes(sheet);
  const cols = 10;
  const cell = 70;
  const canvas = backend.createCanvas(cols * cell, Math.ceil(codes.length / cols) * cell);
  const ctx = canvas.getContext('2d');
  // Mid grey, so symbols without a circle (energy) stay visible.
  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 12px "Beleren"';
  ctx.textAlign = 'center';
  for (const [i, code] of codes.entries()) {
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * cell;
    ctx.drawImage(await backend.loadSvg(extractSymbolSvg(sheet, code, 100)), x + 10, y + 4, 50, 50);
    ctx.fillText(code, x + cell / 2, y + 66);
  }
  return canvas;
}

const sheet = await readFile(path.join(SYMBOL_DIR, 'symbols.svg'), 'utf8');
await mkdir(path.join(OUT_DIR, 'spike'), { recursive: true });
const results = [];
for (const name of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(backends)) {
  results.push(await run(name, sheet));
}
console.table(results);
