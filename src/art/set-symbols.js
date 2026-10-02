import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from '../paths.js';

/**
 * Set symbol fetcher (T-B4, D7, Requirements 6.3.3): Scryfall's set SVGs,
 * cached on disk. Scryfall's set list maps each set code to its icon (promo
 * and other sets often share their parent set's icon); it is cached too and
 * fetched again, at most once a day, when a code isn't in it, so new sets
 * appear. Any failure returns null, and the renderer shows the set code.
 */

const SETS_URL = 'https://api.scryfall.com/sets';
// Scryfall asks API clients to send a User-Agent and an Accept header.
const HEADERS = { 'User-Agent': 'MTGFannableCards/0.1', Accept: 'application/json' };
const INDEX_FILE = 'sets.json';
const DAY_MS = 86_400_000;

/**
 * @param {object} [options]
 * @param {string} [options.dir] Cache directory.
 * @param {typeof fetch} [options.fetch] Injected for tests.
 * @param {() => number} [options.now]
 * @param {{ warn: Function }} [options.log]
 */
export function createSetSymbolFetcher({
  dir = path.join(CACHE_DIR, 'sets'),
  fetch = globalThis.fetch,
  now = Date.now,
  log = console,
} = {}) {
  let index = null; // set code → icon URL
  let indexAge = 0;
  let refreshing = null;
  const inFlight = new Map();

  async function loadIndex() {
    if (index) return;
    try {
      const file = path.join(dir, INDEX_FILE);
      index = JSON.parse(await readFile(file, 'utf8'));
      indexAge = (await stat(file)).mtimeMs;
    } catch {
      await refreshIndex();
    }
  }

  function refreshIndex() {
    refreshing ??= (async () => {
      const response = await fetch(SETS_URL, { headers: HEADERS });
      if (!response.ok) throw new Error(`Scryfall sets: HTTP ${response.status}`);
      const { data } = await response.json();
      index = Object.fromEntries(data.map((s) => [s.code, s.icon_svg_uri]));
      indexAge = now();
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, INDEX_FILE), JSON.stringify(index));
    })().finally(() => (refreshing = null));
    return refreshing;
  }

  async function download(url, file) {
    const response = await fetch(url, { headers: { ...HEADERS, Accept: 'image/svg+xml' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(dir, { recursive: true });
    await writeFile(file, bytes);
    return bytes;
  }

  /**
   * @param {string} setCode e.g. 'M10' or 'm10'.
   * @returns {Promise<Buffer | null>} SVG bytes, or null.
   */
  async function fetchSetSymbol(setCode) {
    const code = setCode.toLowerCase();
    try {
      await loadIndex();
      if (!index[code] && now() - indexAge > DAY_MS) await refreshIndex();
      const url = index[code];
      if (!url) return null;
      const file = path.join(dir, path.basename(new URL(url).pathname));
      try {
        return await readFile(file);
      } catch {
        if (!inFlight.has(file)) {
          inFlight.set(
            file,
            download(url, file).finally(() => inFlight.delete(file)),
          );
        }
        return await inFlight.get(file);
      }
    } catch (error) {
      log.warn(`set symbol ${setCode}: ${error.message}`);
      return null;
    }
  }

  return { fetchSetSymbol };
}
