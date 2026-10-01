import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Bundled assets: Beleren fonts (D6) and custom mana symbols (D7). */
export const RES_DIR = path.join(ROOT_DIR, 'res');
export const FONT_DIR = path.join(RES_DIR, 'fonts');
export const SYMBOL_DIR = path.join(RES_DIR, 'symbols');

/** Scryfall bulk data and downloaded art (D2, D10). Not committed. */
export const CACHE_DIR = path.join(ROOT_DIR, 'cache');

/** Generated card images and zips (D4). Not committed. */
export const OUT_DIR = path.join(ROOT_DIR, 'out');
