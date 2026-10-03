/**
 * Low-memory mode (T-S13, D31, Requirements 3.6.4): `LOW_MEMORY=true` (or 1)
 * fits the app on a 1 GB server. The card data skips Scryfall's Unique Artwork
 * file and shares repeated strings, a refresh drops the old data before
 * loading the new, one job runs at a time, and a job's images go to disk as
 * they render instead of staying in memory.
 */

/** @param {Record<string, string | undefined>} [env] */
export function isLowMemory(env = process.env) {
  return ['true', '1'].includes(env.LOW_MEMORY ?? '');
}
