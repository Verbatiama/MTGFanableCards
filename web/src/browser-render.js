import { CARD, FONTS } from '../../src/config/layout.js';
import { createAssets } from '../../src/render/assets.js';
import { renderCard } from '../../src/render/render-card.js';
import { sizeSvg } from '../../src/render/svg.js';

/**
 * The renderer in the browser (D27, Requirements 3.6.2): the same drawing code
 * as the server (src/render/), with the Beleren fonts and symbol files served
 * by the API under /assets/, and art and set symbols from the preview
 * endpoints. Small font-rendering differences from node-canvas are possible;
 * the downloaded files are the reference.
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

/** Art from the art cache, or null for the black placeholder (3.4.1). */
async function loadArt(url) {
  if (!url) return null;
  return imageFrom(url).catch(() => null);
}

/** The set symbol, sized to draw sharply, or null to show the set code (6.3). */
async function loadSetSymbol(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await svgImage(sizeSvg(await response.text()));
  } catch {
    return null;
  }
}

/**
 * Draws one face from GET /api/cards onto a canvas, resizing it to the card.
 * @param {HTMLCanvasElement} canvas
 * @param {{ model: object, art: string | null, setSymbol: string }} face
 * @returns {Promise<string[]>} renderCard's warnings (T-B10).
 */
export async function renderFace(canvas, face) {
  const [art, setSymbol] = await Promise.all([
    loadArt(face.art),
    loadSetSymbol(face.setSymbol),
    loadFonts(),
  ]);
  // Draw offscreen, then copy, so a slow render never shows half-drawn.
  const offscreen = createCanvas(CARD.width, CARD.height);
  const { warnings } = await renderCard(offscreen.getContext('2d'), face.model, {
    env: browserEnv,
    assets,
    art,
    setSymbol,
  });
  canvas.width = CARD.width;
  canvas.height = CARD.height;
  canvas.getContext('2d').drawImage(offscreen, 0, 0);
  return warnings;
}
