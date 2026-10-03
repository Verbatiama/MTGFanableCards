import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveDecklist } from './data/resolve.js';
import { mapCard, UnsupportedLayoutError } from './model/from-scryfall.js';
import { assignFileNames } from './output/file-names.js';
import { renderCardPng } from './render/node.js';

/**
 * Decklist to card images (T-A12, Requirements 3.2, 3.5), shared by the CLI and
 * the API's jobs (T-C1).
 *
 * Every matched line is mapped to its faces and rendered once; copies reuse
 * the image (3.2.3). Images come out in decklist order, each copy's faces
 * together (front, then back, 3.5.4), so a PDF keeps them side by side.
 * Problems never stop the batch (3.2.6); they are collected in the report.
 *
 * @typedef {object} GenerateReport
 * @property {{ lineNumber: number, line: string, error: string }[]} errors Lines that couldn't be read.
 * @property {{ lineNumber: number, line: string, name: string, suggestions: string[] }[]} unmatched
 * @property {{ lineNumber: number, line: string, warning: string }[]} fallbacks
 *   Printings that weren't found as written (3.3.3).
 * @property {{ lineNumber: number, line: string, name: string, reason: string }[]} skipped
 *   Cards that matched but can't be rendered: layouts out of scope (D1) or render failures.
 * @property {{ fileName: string, warning: string }[]} renderWarnings
 *   Parts that didn't fit even at their smallest; still drawn (T-B10).
 *
 * @param {import('./data/card-database.js').CardDatabase} db
 * @param {string} decklist
 * @param {object} options
 * @param {(url: string | null) => Promise<Uint8Array | null>} options.fetchArt Art fetcher (T-A10).
 * @param {(code: string) => Promise<Uint8Array | null>} options.fetchSetSymbol Set symbols (T-B4).
 * @param {(progress: { done: number, total: number }) => void} [options.onProgress]
 *   Called after each line is rendered, counting images.
 * @param {string} [options.pngDir] An existing directory to write each image
 *   to as it renders, so images don't stay in memory (low-memory mode, T-S13):
 *   they then come back as `{ fileName, file }` instead of `{ fileName, png }`.
 * @returns {Promise<{ images: import('./output/bundle.js').OutputImage[], report: GenerateReport }>}
 */
export async function generateCards(
  db,
  decklist,
  { fetchArt, fetchSetSymbol, onProgress, pngDir },
) {
  const { cards, unmatched, errors } = resolveDecklist(db, decklist);
  const report = { errors, unmatched, fallbacks: [], skipped: [], renderWarnings: [] };

  // Map every line first, so the total is known before rendering starts.
  const lines = [];
  for (const card of cards) {
    const { lineNumber, line } = card;
    if (card.warning) report.fallbacks.push({ lineNumber, line, warning: card.warning });
    try {
      lines.push({ card, models: mapCard(card.printing) });
    } catch (error) {
      if (!(error instanceof UnsupportedLayoutError)) throw error;
      report.skipped.push({ lineNumber, line, name: card.name, reason: error.message });
    }
  }
  const total = lines.reduce((sum, { card, models }) => sum + card.quantity * models.length, 0);

  // Ask for every face's art and set symbol now, in decklist order (T-S6): the
  // art fetcher still starts downloads 100ms apart, but they arrive while
  // earlier cards render instead of one card at a time.
  const art = new Map(); // art URL → bytes, or null
  const setSymbols = new Map(); // set code → bytes, or null
  const prefetch = (cache, key, fetch) => {
    if (cache.has(key)) return;
    const pending = fetch(key);
    pending.catch(() => {}); // a failure is reported when the face renders
    cache.set(key, pending);
  };
  for (const { models } of lines) {
    for (const model of models) {
      prefetch(art, model.artUrl, fetchArt);
      prefetch(setSymbols, model.setCode, fetchSetSymbol);
    }
  }

  let pngCount = 0; // files written to pngDir
  const faces = []; // { name, png or file, warnings } per image, in output order
  const rendered = new Map(); // printing id → that printing's faces, rendered
  for (const { card, models } of lines) {
    let printed = rendered.get(card.printing.id);
    if (!printed) {
      try {
        printed = await Promise.all(models.map((model) => renderFace(model)));
      } catch (error) {
        const reason = `${card.name}: rendering failed (${error.message})`;
        report.skipped.push({
          lineNumber: card.lineNumber,
          line: card.line,
          name: card.name,
          reason,
        });
        continue;
      }
      rendered.set(card.printing.id, printed);
    }
    for (let copy = 0; copy < card.quantity; copy++) faces.push(...printed);
    onProgress?.({ done: faces.length, total });
  }

  const fileNames = assignFileNames(faces.map((f) => f.name));
  const images = faces.map(({ png, file }, i) =>
    file ? { fileName: fileNames[i], file } : { fileName: fileNames[i], png },
  );
  // Warnings once per rendered face, under its first file name.
  const reported = new Set();
  faces.forEach((face, i) => {
    if (reported.has(face)) return;
    reported.add(face);
    for (const warning of face.warnings)
      report.renderWarnings.push({ fileName: fileNames[i], warning });
  });
  return { images, report };

  async function renderFace(model) {
    const warnings = [];
    const png = await renderCardPng(model, {
      art: await art.get(model.artUrl),
      setSymbol: await setSymbols.get(model.setCode),
      onWarning: (w) => warnings.push(w),
    });
    if (!pngDir) return { name: model.name, png, warnings };
    const file = path.join(pngDir, `${pngCount++}.png`);
    await writeFile(file, png);
    return { name: model.name, file, warnings };
  }
}

/** True when the decklist had problems: unreadable lines, unmatched names, fallbacks or skipped cards. */
export function hasProblems(report) {
  return ['errors', 'unmatched', 'fallbacks', 'skipped'].some((key) => report[key].length > 0);
}
