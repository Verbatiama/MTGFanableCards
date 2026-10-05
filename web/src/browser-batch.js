import { renderDeck } from '../../src/render/deck.js';
import { buildPdf, JPEG_QUALITY, zipImages } from '../../src/output/sheets.js';
import { createDeck } from './api.js';
import { loadArt, loadSetSymbol, pngToJpeg, renderCardPng } from './browser-render.js';

/**
 * Frontend-render mode (T-S14, Requirements 3.6.2): the browser renders a
 * whole decklist and builds cards.zip or cards.pdf itself, with the same code
 * as the server's jobs (src/render/deck.js, src/output/sheets.js), so the
 * files have the same names, order and layout. The server only resolves the
 * decklist (POST /api/decks) and serves art, set symbols, fonts and symbols.
 *
 * @param {string} decklist
 * @param {'zip' | 'pdf'} format
 * @param {(progress: { done: number, total: number }) => void} onProgress
 * @returns {Promise<{ blob: Blob | null, count: number, report: object }>}
 *   The bundle (null when no card could be rendered), how many images it
 *   holds, and the problem report in the shape of a job's (GET /api/jobs/:id).
 */
export async function generateInBrowser(decklist, format, onProgress) {
  const { lines, ...report } = await createDeck(decklist);
  onProgress({ done: 0, total: lines.reduce((n, l) => n + l.quantity * l.faces.length, 0) });
  const { images, skipped, renderWarnings } = await renderDeck(lines, {
    fetchArt: loadArt,
    fetchSetSymbol: loadSetSymbol,
    renderFace: async (model, options) => ({ png: await renderCardPng(model, options) }),
    onProgress,
  });
  report.skipped.push(...skipped);
  report.renderWarnings = renderWarnings;
  if (!images.length) return { blob: null, count: 0, report };
  const blob =
    format === 'pdf'
      ? new Blob(
          [
            await buildPdf(images, {
              readPng: (image) => image.png,
              toJpeg: (png) => pngToJpeg(png, JPEG_QUALITY),
            }),
          ],
          { type: 'application/pdf' },
        )
      : new Blob([zipImages(images)], { type: 'application/zip' });
  return { blob, count: images.length, report };
}
