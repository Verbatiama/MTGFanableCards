/**
 * Art download for the fixture preview: a throwaway version of the T-A10
 * fetcher (D10, Requirements 3.4.1).
 *
 * - Downloads Scryfall art crops into cache/art/, keyed by face and card id,
 *   so reruns don't hit the network.
 * - Starts network requests at least 100ms apart. Cache hits don't count.
 * - Returns null on any failure, so the caller draws the black placeholder.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { CACHE_DIR } from '../../src/paths.js';

const ART_CACHE_DIR = path.join(CACHE_DIR, 'art');
const REQUEST_SPACING_MS = 100;
// Scryfall asks API clients to send a User-Agent and an Accept header.
const HEADERS = { 'User-Agent': 'MTGFannableCards/0.1', Accept: 'image/*' };

let queue = Promise.resolve();
let lastRequestAt = -Infinity;
export const stats = { cached: 0, downloaded: 0, failed: 0 };

/**
 * Calls `request` at least 100ms after the previous request was sent.
 * Concurrent callers are served in order. The request is started inside the
 * queue, so no await can delay it, and the time is recorded once fetch() has
 * returned, so its own set-up time can't eat into the next gap.
 */
function rateLimited(request) {
  const started = queue.then(async () => {
    // Timers can fire a millisecond early, so re-check rather than trust one sleep.
    while (performance.now() < lastRequestAt + REQUEST_SPACING_MS) {
      await sleep(lastRequestAt + REQUEST_SPACING_MS - performance.now());
    }
    const response = request();
    lastRequestAt = performance.now();
    return { response };
  });
  queue = started;
  // Wrapped so the queue moves on as soon as the request starts, not when it ends.
  return started.then(({ response }) => response);
}

/** `.../art_crop/front/6/7/67f4….jpg?123` → `front-67f4….jpg` */
function cacheFile(url) {
  const { pathname } = new URL(url);
  const [, face, , , file] = /\/(front|back)\/(\w)\/(\w)\/([^/]+)$/.exec(pathname) ?? [];
  if (!file) throw new Error(`Unexpected Scryfall art URL: ${url}`);
  return path.join(ART_CACHE_DIR, `${face}-${file}`);
}

/**
 * @param {string | null} url Scryfall art_crop URL from the card model.
 * @returns {Promise<Buffer | null>} Image bytes, or null for the placeholder.
 */
export async function fetchArt(url) {
  if (!url) return null;
  let file;
  try {
    file = cacheFile(url);
    const bytes = await readFile(file);
    stats.cached += 1;
    return bytes;
  } catch (error) {
    if (!file || error.code !== 'ENOENT') {
      stats.failed += 1;
      console.warn(`art: ${error.message}`);
      return null;
    }
  }

  try {
    const response = await rateLimited(() =>
      fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) }),
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(ART_CACHE_DIR, { recursive: true });
    await writeFile(file, bytes);
    stats.downloaded += 1;
    return bytes;
  } catch (error) {
    stats.failed += 1;
    console.warn(`art: ${url} failed (${error.message}); using placeholder`);
    return null;
  }
}
