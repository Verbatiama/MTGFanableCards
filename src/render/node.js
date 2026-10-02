import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { CARD, FONTS } from '../config/layout.js';
import { FONT_DIR, SYMBOL_DIR } from '../paths.js';
import { createAssets } from './assets.js';
import { renderCard } from './render-card.js';

/**
 * The renderer on the server (D5): node-canvas with the Beleren fonts.
 * Runs on Linux; node-canvas can't load the fonts on native Windows (T-B1).
 */

/** Environment for renderCard and the asset loader: node-canvas and res/symbols/ on disk. */
export const nodeEnv = {
  createCanvas,
  loadImage: (bytes) => loadImage(Buffer.from(bytes)),
  loadAsset: (file) => loadImage(path.join(SYMBOL_DIR, file)),
  readAsset: (file) => readFile(path.join(SYMBOL_DIR, file), 'utf8'),
  loadSvg: (svg) => loadImage(Buffer.from(svg)),
};

/** Assets shared by every card rendered in this process (T-B3). */
export const nodeAssets = createAssets(nodeEnv);

let fontsRegistered = false;
/** Registers the Beleren fonts; must happen before the first canvas is created. */
export function registerFonts() {
  if (fontsRegistered) return;
  for (const font of Object.values(FONTS)) {
    registerFont(path.join(FONT_DIR, font.file), { family: font.family, weight: font.weight });
  }
  fontsRegistered = true;
}

/** Decodes image bytes, or null when they're missing or can't be decoded. */
export async function decode(bytes) {
  if (!bytes) return null;
  try {
    return await loadImage(Buffer.from(bytes));
  } catch {
    return null;
  }
}

/**
 * Scryfall's set SVGs have only a viewBox; give them a large pixel size so
 * node-canvas rasterises them sharply rather than at their tiny default size.
 */
function sizedSvg(bytes, height = 120) {
  const svg = Buffer.from(bytes).toString('utf8');
  const box = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!box) return bytes;
  const width = Math.round((height * Number(box[1])) / Number(box[2]));
  return Buffer.from(svg.replace('<svg ', `<svg width="${width}" height="${height}" `));
}

/** Decodes set symbol SVG bytes at a sharp size (T-B4). */
export const decodeSetSymbol = (bytes) => decode(bytes && sizedSvg(bytes));

/**
 * Renders a card model to a canvas.
 * @param {import('../model/card-model.js').CardModel} model
 * @param {{ art?: Uint8Array | null, setSymbol?: Uint8Array | null }} [options]
 *   Art bytes (T-A10) and set symbol SVG bytes (T-B4); null for the fallbacks.
 */
export async function renderCardCanvas(model, { art = null, setSymbol = null } = {}) {
  registerFonts();
  const canvas = createCanvas(CARD.width, CARD.height);
  await renderCard(canvas.getContext('2d'), model, {
    env: nodeEnv,
    assets: nodeAssets,
    art: await decode(art),
    setSymbol: await decodeSetSymbol(setSymbol),
  });
  return canvas;
}
/** Renders a card model to PNG bytes (3.5.1). */
export async function renderCardPng(model, options) {
  return (await renderCardCanvas(model, options)).toBuffer('image/png');
}
