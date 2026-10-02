import { access } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from '../paths.js';
import { CardDatabase } from './card-database.js';
import { BULK_FILES, downloadBulkData } from './scryfall-bulk.js';

/**
 * Keeps the current card database and refreshes it from Scryfall every
 * `SCRYFALL_REFRESH_HOURS` (24 by default), swapping the new data in without
 * a restart (D30, Requirements 3.6.5). Lookups keep using the old database
 * until the new one is fully built.
 *
 * If Scryfall can't be reached, the files already on disk are used.
 *
 * @param {object} [options]
 * @param {string} [options.dir] Data directory (`DATA_DIR`).
 * @param {number} [options.refreshHours] 0 turns periodic refresh off.
 * @param {typeof fetch} [options.fetch] Injected for tests.
 * @param {{ info: Function, warn: Function, error: Function }} [options.log]
 */
export function createCardStore({
  dir = DATA_DIR,
  refreshHours = Number(process.env.SCRYFALL_REFRESH_HOURS ?? 24),
  fetch = globalThis.fetch,
  log = console,
} = {}) {
  let db = null;
  let running = null;
  let timer = null;

  const files = {
    defaultCards: path.join(dir, BULK_FILES.default_cards),
    uniqueArtwork: path.join(dir, BULK_FILES.unique_artwork),
  };

  async function update() {
    let updated = [];
    try {
      ({ updated } = await downloadBulkData({ dir, fetch }));
      if (updated.length) log.info(`Scryfall bulk data updated: ${updated.join(', ')}`);
    } catch (error) {
      if (!db && !(await exists(files.defaultCards))) throw error;
      log.warn(`Scryfall refresh failed, keeping current data: ${error.message}`);
    }
    if (updated.length || !db) {
      const started = Date.now();
      db = await CardDatabase.fromFiles(files);
      log.info(`Card database loaded: ${db.size} cards in ${Date.now() - started} ms`);
    }
    return { updated };
  }

  /** Downloads newer data if there is any and swaps it in. Concurrent calls share one run. */
  function refresh() {
    running ??= update().finally(() => (running = null));
    return running;
  }

  const ready = refresh();
  if (refreshHours > 0) {
    timer = setInterval(() => refresh().catch((e) => log.error(e)), refreshHours * 3_600_000);
    timer.unref();
  }

  return {
    /** Resolves once the first database is loaded. */
    ready,
    /** The current database, or null before `ready` resolves. */
    get db() {
      return db;
    },
    refresh,
    stop() {
      clearInterval(timer);
    },
  };
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}
