import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { ART_CACHE_DIR } from '../paths.js';

/**
 * Art fetcher with a capped cache (T-A10, D10, D29; Requirements 3.4).
 *
 * - Art crops are cached on disk, so each image is downloaded once.
 * - Network requests start at least 100ms apart, to respect Scryfall. Cache hits
 *   don't count, and simultaneous requests for the same art share one download.
 * - Any failure returns null, and the renderer draws the black placeholder.
 * - The cache records how often each image is used. When it grows past its cap,
 *   the least-used 25% of images are deleted, least recently used first among
 *   ties (3.6.4).
 */

// Scryfall asks API clients to send a User-Agent and an Accept header.
const HEADERS = { 'User-Agent': 'MTGFannableCards/0.1', Accept: 'image/*' };
const INDEX_FILE = 'index.json';
const EVICT_FRACTION = 0.25;

/** `.../art_crop/front/6/7/67f4….jpg?123` → `front-67f4….jpg` */
export function cacheFileName(url) {
  const { pathname } = new URL(url);
  const [, face, file] = /\/(front|back)\/\w\/\w\/([^/]+)$/.exec(pathname) ?? [];
  if (!file) throw new Error(`Unexpected Scryfall art URL: ${url}`);
  return `${face}-${file}`;
}

/**
 * @param {object} [options]
 * @param {string} [options.dir] Cache directory (`ART_CACHE_DIR`).
 * @param {number} [options.maxBytes] Cache cap; `ART_CACHE_MAX_GB` (10) by default.
 * @param {number} [options.spacingMs] Gap between network requests.
 * @param {typeof fetch} [options.fetch] Injected for tests.
 * @param {() => number} [options.now] Clock, injected for tests.
 * @param {{ warn: Function }} [options.log]
 */
export function createArtFetcher({
  dir = ART_CACHE_DIR,
  maxBytes = Number(process.env.ART_CACHE_MAX_GB ?? 10) * 1e9,
  spacingMs = 100,
  fetch = globalThis.fetch,
  now = Date.now,
  log = console,
} = {}) {
  const stats = { cached: 0, downloaded: 0, failed: 0, evicted: 0 };
  const inFlight = new Map();
  let index = null; // file name → { uses, lastUsed, size }
  let loading = null;
  let queue = Promise.resolve();
  let lastRequestAt = -Infinity;
  let saving = Promise.resolve();

  async function loadIndex() {
    loading ??= (async () => {
      await mkdir(dir, { recursive: true });
      try {
        index = JSON.parse(await readFile(path.join(dir, INDEX_FILE), 'utf8'));
      } catch {
        index = {};
      }
      // Pick up images the index doesn't know about (e.g. an older cache).
      for (const file of await readdir(dir)) {
        if (file === INDEX_FILE || file.endsWith('.partial') || index[file]) continue;
        const { size, mtimeMs } = await stat(path.join(dir, file));
        index[file] = { uses: 0, lastUsed: mtimeMs, size };
      }
    })();
    return loading;
  }

  function saveIndex() {
    saving = saving.then(() =>
      writeFile(path.join(dir, INDEX_FILE), JSON.stringify(index)).catch((error) =>
        log.warn(`art cache index not saved: ${error.message}`),
      ),
    );
    return saving;
  }

  /** Starts `request` at least `spacingMs` after the previous one started. */
  function rateLimited(request) {
    const started = queue.then(async () => {
      // Timers can fire a millisecond early, so re-check rather than trust one sleep.
      while (performance.now() < lastRequestAt + spacingMs) {
        await sleep(lastRequestAt + spacingMs - performance.now());
      }
      const response = request();
      lastRequestAt = performance.now();
      return { response };
    });
    queue = started;
    return started.then(({ response }) => response);
  }

  function touch(file) {
    index[file].uses += 1;
    index[file].lastUsed = now();
  }

  async function evictIfFull() {
    let total = Object.values(index).reduce((sum, e) => sum + e.size, 0);
    while (total > maxBytes && Object.keys(index).length) {
      const victims = Object.entries(index)
        .sort(([, a], [, b]) => a.uses - b.uses || a.lastUsed - b.lastUsed)
        .slice(0, Math.max(1, Math.ceil(Object.keys(index).length * EVICT_FRACTION)));
      for (const [file, entry] of victims) {
        await rm(path.join(dir, file), { force: true });
        delete index[file];
        total -= entry.size;
        stats.evicted += 1;
      }
    }
  }

  async function download(url, file) {
    const response = await rateLimited(() =>
      fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) }),
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(path.join(dir, file), bytes);
    // The downloading caller's use; others sharing the download add theirs after.
    index[file] = { uses: 1, lastUsed: now(), size: bytes.length };
    stats.downloaded += 1;
    await evictIfFull();
    return bytes;
  }

  /**
   * @param {string | null} url Scryfall art crop URL from the card model.
   * @returns {Promise<Buffer | null>} Image bytes, or null for the placeholder.
   */
  async function fetchArt(url) {
    if (!url) return null;
    try {
      await loadIndex();
      const file = cacheFileName(url);
      if (index[file]) {
        try {
          const bytes = await readFile(path.join(dir, file));
          touch(file);
          stats.cached += 1;
          saveIndex();
          return bytes;
        } catch {
          delete index[file]; // listed but gone: download it again
        }
      }
      let shared = true;
      if (!inFlight.has(file)) {
        shared = false;
        inFlight.set(
          file,
          download(url, file).finally(() => inFlight.delete(file)),
        );
      }
      const bytes = await inFlight.get(file);
      if (shared && index[file]) touch(file);
      saveIndex();
      return bytes;
    } catch (error) {
      stats.failed += 1;
      log.warn(`art: ${url} failed (${error.message}); using placeholder`);
      return null;
    }
  }

  return {
    fetchArt,
    stats,
    /** Waits for pending index writes, e.g. before shutdown. */
    flush: () => saving,
  };
}
