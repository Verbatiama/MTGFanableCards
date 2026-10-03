/**
 * Performance run (T-S6, D24, Requirements 10.5): generates a 100-card
 * Commander deck twice through the real pipeline, first with an empty art
 * cache (every image downloaded from Scryfall, 100ms apart) and then with the
 * cache that run filled. Reports the time of each step; there is no pass/fail
 * threshold.
 *
 *   npm run perf [-- decklist.txt]
 *
 * Uses the Scryfall bulk files already in the data directory (no refresh), and
 * a temporary art and set-symbol cache, so the project's cache isn't touched.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createArtFetcher } from '../src/art/art-cache.js';
import { createSetSymbolFetcher } from '../src/art/set-symbols.js';
import { CardDatabase } from '../src/data/card-database.js';
import { BULK_FILES } from '../src/data/scryfall-bulk.js';
import { generateCards, hasProblems } from '../src/generate.js';
import { pdfSheets, zipImages } from '../src/output/index.js';
import { DATA_DIR, ROOT_DIR } from '../src/paths.js';

const deckFile = process.argv[2] ?? path.join(ROOT_DIR, 'scripts/perf/commander-100.txt');
const decklist = await readFile(deckFile, 'utf8');
const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;

let started = performance.now();
const db = await CardDatabase.fromFiles({
  defaultCards: path.join(DATA_DIR, BULK_FILES.default_cards),
  uniqueArtwork: path.join(DATA_DIR, BULK_FILES.unique_artwork),
});
const loadMs = performance.now() - started;
const peakAfterLoad = process.resourceUsage().maxRSS * 1024;
globalThis.gc?.();
const memoryAfterLoad = process.memoryUsage();

const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'fannable-perf-'));
try {
  const cold = await run();
  const warm = await run();
  report(cold, warm);
} finally {
  await rm(cacheDir, { recursive: true, force: true });
}

/** One generation of the deck, timed step by step. */
async function run() {
  const art = createArtFetcher({ dir: path.join(cacheDir, 'art') });
  const sets = createSetSymbolFetcher({ dir: path.join(cacheDir, 'sets') });
  started = performance.now();
  const { images, report } = await generateCards(db, decklist, {
    fetchArt: art.fetchArt,
    fetchSetSymbol: sets.fetchSetSymbol,
  });
  const generateMs = performance.now() - started;
  const peakAfterImages = process.resourceUsage().maxRSS * 1024;
  await art.flush();

  started = performance.now();
  const zip = zipImages(images);
  const zipMs = performance.now() - started;

  started = performance.now();
  const pdf = await pdfSheets(images);
  const pdfMs = performance.now() - started;

  if (hasProblems(report)) console.warn('Decklist problems:', JSON.stringify(report, null, 2));
  return {
    images: images.length,
    rendered: new Set(images.map((i) => i.png)).size,
    art: { ...art.stats },
    generateMs,
    peakAfterImages,
    zipMs,
    pdfMs,
    zipBytes: zip.length,
    pdfBytes: pdf.length,
  };
}

function report(cold, warm) {
  const mb = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;
  const row = (label, a, b) => console.log(`| ${label} | ${a} | ${b} |`);
  console.log(`Deck: ${path.relative(process.cwd(), deckFile)}`);
  console.log(`Card database: ${db.size} cards loaded in ${seconds(loadMs)}`);
  console.log(
    `Images: ${cold.images} (${cold.rendered} rendered once, copies reuse their image)\n`,
  );
  console.log('| Step | Cold art cache | Warm art cache |');
  console.log('| --- | --- | --- |');
  row(
    'Art',
    `${cold.art.downloaded} downloaded, ${cold.art.failed} failed`,
    `${warm.art.cached} from cache`,
  );
  // Art downloads run alongside rendering (generate.js); with the art cached,
  // generating is almost all rendering.
  row('Decklist → images', seconds(cold.generateMs), seconds(warm.generateMs));
  row(`cards.zip (${mb(cold.zipBytes)})`, seconds(cold.zipMs), seconds(warm.zipMs));
  row(`cards.pdf (${mb(cold.pdfBytes)})`, seconds(cold.pdfMs), seconds(warm.pdfMs));
  row(
    'Total, with the zip',
    seconds(cold.generateMs + cold.zipMs),
    seconds(warm.generateMs + warm.zipMs),
  );
  console.log(
    `\nMemory: card database ${mb(memoryAfterLoad.heapUsed)} heap once loaded ` +
      `(peak RSS while loading ${mb(peakAfterLoad)}); ` +
      `peak RSS ${mb(cold.peakAfterImages)} after the images, ` +
      `${mb(process.resourceUsage().maxRSS * 1024)} for the whole run (both PDFs included)`,
  );
}
