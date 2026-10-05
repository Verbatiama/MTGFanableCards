import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveDecklist } from './data/resolve.js';
import { mapCard, UnsupportedLayoutError } from './model/from-scryfall.js';
import { renderDeck } from './render/deck.js';
import { renderCardPng } from './render/node.js';

/**
 * Decklist to card images (T-A12, Requirements 3.2, 3.5), shared by the CLI and
 * the API's jobs (T-C1).
 *
 * Every matched line is mapped to its faces (planDeck) and rendered once by
 * renderDeck, shared with the browser's frontend-render mode (T-S14); copies
 * reuse the image (3.2.3). Problems never stop the batch (3.2.6); they are
 * collected in the report.
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
  const { lines, report } = planDeck(db, decklist);
  let pngCount = 0; // files written to pngDir
  const { images, skipped, renderWarnings } = await renderDeck(lines, {
    fetchArt,
    fetchSetSymbol,
    onProgress,
    async renderFace(model, assets) {
      const png = await renderCardPng(model, assets);
      if (!pngDir) return { png };
      const file = path.join(pngDir, `${pngCount++}.png`);
      await writeFile(file, png);
      return { file };
    },
  });
  report.skipped.push(...skipped);
  report.renderWarnings.push(...renderWarnings);
  return { images, report };
}

/**
 * Resolves a decklist into the lines to render (T-S14): each matched line's
 * faces, keyed by printing, with art and set symbol keys for the fetchers
 * (the art URL and the set code). Unreadable, unmatched, fallback and
 * out-of-scope lines go in the report; `renderWarnings` stays empty until the
 * lines are rendered.
 * @param {import('./data/card-database.js').CardDatabase} db
 * @param {string} decklist
 * @returns {{ lines: import('./render/deck.js').DeckLine[], report: GenerateReport }}
 */
export function planDeck(db, decklist) {
  const { cards, unmatched, errors } = resolveDecklist(db, decklist);
  const report = { errors, unmatched, fallbacks: [], skipped: [], renderWarnings: [] };
  const lines = [];
  for (const card of cards) {
    const { lineNumber, line, name, quantity } = card;
    if (card.warning) report.fallbacks.push({ lineNumber, line, warning: card.warning });
    let models;
    try {
      models = mapCard(card.printing);
    } catch (error) {
      if (!(error instanceof UnsupportedLayoutError)) throw error;
      report.skipped.push({ lineNumber, line, name, reason: error.message });
      continue;
    }
    lines.push({
      key: card.printing.id,
      lineNumber,
      line,
      name,
      quantity,
      faces: models.map((model) => ({ model, art: model.artUrl, setSymbol: model.setCode })),
    });
  }
  return { lines, report };
}

/** True when the decklist had problems: unreadable lines, unmatched names, fallbacks or skipped cards. */
export function hasProblems(report) {
  return ['errors', 'unmatched', 'fallbacks', 'skipped'].some((key) => report[key].length > 0);
}
