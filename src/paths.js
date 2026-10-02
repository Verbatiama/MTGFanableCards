import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Bundled assets: Beleren fonts (D6) and custom mana symbols (D7). */
export const RES_DIR = path.join(ROOT_DIR, 'res');
export const FONT_DIR = path.join(RES_DIR, 'fonts');
export const SYMBOL_DIR = path.join(RES_DIR, 'symbols');

/** Scryfall bulk data and downloaded art (D2, D10). Not committed. */
export const CACHE_DIR = path.join(ROOT_DIR, 'cache');

/**
 * Where the Scryfall bulk files are kept. `DATA_DIR` overrides it, e.g. `/data`
 * in the Docker image (D29).
 */
export const DATA_DIR = process.env.DATA_DIR ?? path.join(CACHE_DIR, 'scryfall');

/** Downloaded art (D10). `ART_CACHE_DIR` overrides it, e.g. `/data/art` in Docker (D29). */
export const ART_CACHE_DIR = process.env.ART_CACHE_DIR ?? path.join(CACHE_DIR, 'art');

/** Generated card images and zips (D4). Not committed. */
export const OUT_DIR = path.join(ROOT_DIR, 'out');
