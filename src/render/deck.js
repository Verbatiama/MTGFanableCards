import { assignFileNames } from '../output/file-names.js';

/**
 * Renders a resolved decklist into output images (Requirements 3.2.3, 3.5.4):
 * the loop shared by the server's jobs (generateCards) and the browser in
 * frontend-render mode (T-S14), so both give the same files in the same order.
 *
 * Each printing is rendered once; copies reuse the image. Images come out in
 * decklist order, each copy's faces together (front, then back), so a PDF
 * keeps them side by side. A printing that fails to render is skipped and
 * reported; the rest carry on (3.2.6).
 *
 * @typedef {object} DeckFace
 * @property {import('../model/card-model.js').CardModel} model
 * @property {string | null} art Key for `fetchArt`: the art URL on the server,
 *   the /api/art/ path in the browser.
 * @property {string} setSymbol Key for `fetchSetSymbol`.
 *
 * @typedef {object} DeckLine
 * @property {string} key Identifies the printing: lines with the same key share images.
 * @property {number} lineNumber
 * @property {string} line
 * @property {string} name
 * @property {number} quantity
 * @property {DeckFace[]} faces
 *
 * @template Image
 * @param {DeckLine[]} lines
 * @param {object} env
 * @param {(key: string | null) => Promise<any>} env.fetchArt
 * @param {(key: string) => Promise<any>} env.fetchSetSymbol
 * @param {(model: object, assets: { art: any, setSymbol: any,
 *   onWarning: (warning: string) => void }) => Promise<Image>} env.renderFace
 *   One face's image, e.g. `{ png }`, passing on renderCard's warnings (T-B10).
 * @param {(progress: { done: number, total: number }) => void} [env.onProgress]
 *   Called after each line is rendered, counting images.
 * @returns {Promise<{ images: (Image & { fileName: string })[],
 *   skipped: { lineNumber: number, line: string, name: string, reason: string }[],
 *   renderWarnings: { fileName: string, warning: string }[] }>}
 */
export async function renderDeck(lines, { fetchArt, fetchSetSymbol, renderFace, onProgress }) {
  const total = lines.reduce((sum, l) => sum + l.quantity * l.faces.length, 0);
  const skipped = [];

  // Ask for every face's art and set symbol now, in decklist order (T-S6): the
  // fetches arrive while earlier cards render instead of one card at a time.
  const art = new Map(); // key → pending art, or null
  const setSymbols = new Map();
  const prefetch = (cache, key, fetch) => {
    if (cache.has(key)) return;
    const pending = fetch(key);
    pending.catch(() => {}); // a failure is reported when the face renders
    cache.set(key, pending);
  };
  for (const { faces } of lines) {
    for (const face of faces) {
      prefetch(art, face.art, fetchArt);
      prefetch(setSymbols, face.setSymbol, fetchSetSymbol);
    }
  }

  const output = []; // { name, image } per image, in output order
  const rendered = new Map(); // printing key → that printing's faces, rendered
  for (const line of lines) {
    let printed = rendered.get(line.key);
    if (!printed) {
      try {
        printed = await Promise.all(
          line.faces.map(async (face) => {
            const warnings = [];
            const image = await renderFace(face.model, {
              art: await art.get(face.art),
              setSymbol: await setSymbols.get(face.setSymbol),
              onWarning: (w) => warnings.push(w),
            });
            return { name: face.model.name, image, warnings };
          }),
        );
      } catch (error) {
        const reason = `${line.name}: rendering failed (${error.message})`;
        skipped.push({ lineNumber: line.lineNumber, line: line.line, name: line.name, reason });
        continue;
      }
      rendered.set(line.key, printed);
    }
    for (let copy = 0; copy < line.quantity; copy++) output.push(...printed);
    onProgress?.({ done: output.length, total });
  }

  const fileNames = assignFileNames(output.map((f) => f.name));
  const images = output.map(({ image }, i) => ({ fileName: fileNames[i], ...image }));
  // Warnings once per rendered face, under its first file name.
  const renderWarnings = [];
  const reported = new Set();
  output.forEach((face, i) => {
    if (reported.has(face)) return;
    reported.add(face);
    for (const warning of face.warnings) renderWarnings.push({ fileName: fileNames[i], warning });
  });
  return { images, skipped, renderWarnings };
}
