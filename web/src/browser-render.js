import { CARD, FONTS } from '../../src/config/layout.js';
import { createAssets } from '../../src/render/assets.js';
import { renderCard } from '../../src/render/render-card.js';
import { sizeSvg } from '../../src/render/svg.js';

/**
 * The renderer in the browser (D27, Requirements 3.6.2): the same drawing code
 * as the server (src/render/), with the Beleren fonts and symbol files served
 * by the API under /assets/, and art and set symbols from the preview
 * endpoints. Small font-rendering differences from node-canvas are possible;
 * the server's files are the reference. In frontend-render mode (T-S14) it
 * also renders whole batches to PNG (browser-batch.js). Every request goes to
 * this server; none to Scryfall.
 */

const createCanvas = (width, height) =>
  Object.assign(document.createElement('canvas'), { width, height });

function imageFrom(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Can't load ${src}`));
    image.src = src;
  });
}

async function imageFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  try {
    return await imageFrom(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const svgImage = (svg) => imageFromBlob(new Blob([svg], { type: 'image/svg+xml' }));

/** @type {import('../../src/render/render-card.js').RenderEnv & import('../../src/render/assets.js').AssetEnv} */
const browserEnv = {
  createCanvas,
  loadImage: (bytes) => imageFromBlob(new Blob([bytes])),
  loadAsset: (file) => imageFrom(`/assets/symbols/${file}`),
  readAsset: async (file) => {
    const response = await fetch(`/assets/symbols/${file}`);
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    return response.text();
  },
  loadSvg: svgImage,
};

/** Shared by every preview on the page, so symbols load once (T-B3). */
const assets = createAssets(browserEnv);

let fontsLoaded = null;
/** Loads the Beleren fonts (D6) once; canvas text needs them loaded before drawing. */
function loadFonts() {
  fontsLoaded ??= Promise.all(
    Object.values(FONTS).map(async ({ family, weight, file }) => {
      const face = new FontFace(family, `url(/assets/fonts/${file})`, { weight });
      document.fonts.add(await face.load());
    }),
  );
  return fontsLoaded;
}

const RETRIES = 5;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A response from this server (/api/art/, /api/set-symbols/), or null when it
 * has nothing (404). A batch asks for every card's art at once, so a rate
 * limit (429) is waited out rather than shown as missing art.
 */
async function fetchAsset(url) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url);
    if (response.ok) return response;
    if (response.status === 404) return null;
    if (response.status !== 429 || attempt === RETRIES) {
      throw new Error(`${url}: the server answered ${response.status}`);
    }
    const wait = Number(response.headers.get('Retry-After')) || 2 ** attempt;
    await sleep(wait * 1000);
  }
}

/**
 * Art from the art cache (an /api/art/ path), or null for the black
 * placeholder (3.4.1). Throws when the server can't be reached, so a batch
 * reports the card rather than drawing it without its art.
 */
export async function loadArt(url) {
  if (!url) return null;
  const response = await fetchAsset(url);
  return response && imageFromBlob(await response.blob()).catch(() => null);
}

/** The set symbol, sized to draw sharply, or null to show the set code (6.3). */
export async function loadSetSymbol(url) {
  const response = await fetchAsset(url);
  return response && svgImage(sizeSvg(await response.text())).catch(() => null);
}

/** Draws a card model offscreen; art and set symbol already loaded. */
async function drawCard(model, { art, setSymbol, onWarning = () => {} }) {
  await loadFonts();
  const canvas = createCanvas(CARD.width, CARD.height);
  const { warnings } = await renderCard(canvas.getContext('2d'), model, {
    env: browserEnv,
    assets,
    art,
    setSymbol,
  });
  warnings.forEach(onWarning);
  return canvas;
}

const toBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error(`Can't encode ${type}`))),
      type,
      quality,
    ),
  );
const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());

/**
 * Renders a card model to PNG bytes, as the server's renderCardPng does
 * (frontend-render mode, T-S14).
 */
export async function renderCardPng(model, options) {
  const canvas = await drawCard(model, options);
  const png = await bytesOf(await toBlob(canvas, 'image/png'));
  canvas.width = 0; // free the pixels now
  return png;
}

/** PNG to JPEG bytes for the PDF (3.5.3). */
export async function pngToJpeg(png, quality) {
  const image = await imageFromBlob(new Blob([png], { type: 'image/png' }));
  const canvas = createCanvas(image.width, image.height);
  canvas.getContext('2d').drawImage(image, 0, 0);
  const jpeg = await bytesOf(await toBlob(canvas, 'image/jpeg', quality));
  canvas.width = 0;
  return jpeg;
}

/**
 * Draws one face from GET /api/cards onto a canvas, resizing it to the card.
 * @param {HTMLCanvasElement} canvas
 * @param {{ model: object, art: string | null, setSymbol: string }} face
 * @returns {Promise<string[]>} renderCard's warnings (T-B10).
 */
export async function renderFace(canvas, face) {
  const [art, setSymbol] = await Promise.all([
    loadArt(face.art).catch(() => null),
    loadSetSymbol(face.setSymbol).catch(() => null),
    loadFonts(),
  ]);
  // Draw offscreen, then copy, so a slow render never shows half-drawn.
  const warnings = [];
  const offscreen = await drawCard(face.model, {
    art,
    setSymbol,
    onWarning: (w) => warnings.push(w),
  });
  canvas.width = CARD.width;
  canvas.height = CARD.height;
  canvas.getContext('2d').drawImage(offscreen, 0, 0);
  return warnings;
}
