import path from 'node:path';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { CARD, FONTS } from '../config/layout.js';
import { FONT_DIR } from '../paths.js';
import { renderCard } from './render-card.js';

/**
 * The renderer on the server (D5): node-canvas with the Beleren fonts.
 * Runs on Linux; node-canvas can't load the fonts on native Windows (T-B1).
 */

/** Environment for renderCard: canvases and images from node-canvas. */
export const nodeEnv = { createCanvas, loadImage };

let fontsRegistered = false;
/** Registers the Beleren fonts; must happen before the first canvas is created. */
export function registerFonts() {
  if (fontsRegistered) return;
  for (const font of Object.values(FONTS)) {
    registerFont(path.join(FONT_DIR, font.file), { family: font.family, weight: font.weight });
  }
  fontsRegistered = true;
}

/**
 * Renders a card model to a canvas.
 * @param {import('../model/card-model.js').CardModel} model
 * @param {{ art?: Buffer | Uint8Array | null }} [options] Art bytes from the art fetcher (T-A10).
 */
export async function renderCardCanvas(model, { art = null } = {}) {
  registerFonts();
  const canvas = createCanvas(CARD.width, CARD.height);
  let image = null;
  if (art) {
    try {
      image = await loadImage(Buffer.from(art));
    } catch {
      image = null; // undecodable art: black placeholder (3.4.1)
    }
  }
  await renderCard(canvas.getContext('2d'), model, { env: nodeEnv, art: image });
  return canvas;
}

/** Renders a card model to PNG bytes (3.5.1). */
export async function renderCardPng(model, options) {
  return (await renderCardCanvas(model, options)).toBuffer('image/png');
}
