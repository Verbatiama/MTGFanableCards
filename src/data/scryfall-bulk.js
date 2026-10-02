import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * Scryfall bulk data download (D2, Requirements 3.3.1–3.3.2).
 *
 * Scryfall publishes each bulk file as gzipped JSON Lines, one card per line.
 * The files are saved as-is in the data directory and only downloaded again
 * when Scryfall's `updated_at` changes.
 */

const BULK_INDEX_URL = 'https://api.scryfall.com/bulk-data';
// Scryfall asks API clients to send a User-Agent and an Accept header.
const HEADERS = { 'User-Agent': 'MTGFannableCards/0.1', Accept: 'application/json' };

/** The bulk files the app uses (D2), and their names in the data directory. */
export const BULK_FILES = {
  default_cards: 'default-cards.jsonl.gz',
  unique_artwork: 'unique-artwork.jsonl.gz',
};

const META_FILE = 'bulk-meta.json';

/** `updated_at` of each bulk file on disk, or {} if none have been downloaded. */
export async function readBulkMeta(dir) {
  try {
    return JSON.parse(await readFile(path.join(dir, META_FILE), 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Downloads any bulk file that is missing or older than Scryfall's copy.
 * Each file is written to a temporary name and renamed into place, so a
 * failed download never replaces a good file.
 *
 * @param {object} options
 * @param {string} options.dir Data directory.
 * @param {typeof fetch} [options.fetch] Injected for tests.
 * @returns {Promise<{ updated: string[] }>} The bulk types that were downloaded.
 */
export async function downloadBulkData({ dir, fetch = globalThis.fetch }) {
  await mkdir(dir, { recursive: true });
  const response = await fetch(BULK_INDEX_URL, { headers: HEADERS });
  if (!response.ok) throw new Error(`Scryfall bulk index: HTTP ${response.status}`);
  const { data } = await response.json();

  const meta = await readBulkMeta(dir);
  const updated = [];
  for (const [type, file] of Object.entries(BULK_FILES)) {
    const entry = data.find((b) => b.type === type);
    if (!entry) throw new Error(`Scryfall bulk index has no ${type} file`);
    if (meta[type] === entry.updated_at) continue;

    const download = await fetch(entry.jsonl_download_uri, { headers: HEADERS });
    if (!download.ok || !download.body) {
      throw new Error(`Scryfall ${type} download: HTTP ${download.status}`);
    }
    const target = path.join(dir, file);
    const partial = `${target}.partial`;
    try {
      await pipeline(Readable.fromWeb(download.body), createWriteStream(partial));
      await rename(partial, target);
    } catch (error) {
      await rm(partial, { force: true });
      throw error;
    }
    meta[type] = entry.updated_at;
    await writeFile(path.join(dir, META_FILE), `${JSON.stringify(meta, null, 2)}\n`);
    updated.push(type);
  }
  return { updated };
}
