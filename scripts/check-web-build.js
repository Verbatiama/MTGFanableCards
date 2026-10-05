import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT_DIR } from '../src/paths.js';

/**
 * Fails when the built frontend could reach Scryfall (T-S14, Requirements
 * 3.6.2): `npm run web:check` after `npm run web:build`, in CI. The browser
 * gets card data, art and set symbols from this server only, so the build
 * must hold no Scryfall API, image or bulk-data address. The footer's
 * attribution link to the scryfall.com home page is a link people follow,
 * not a request the page makes, so it's allowed.
 *
 *   npm run web:check [-- <dir>]   (default web/dist)
 */

const SCRYFALL = [
  /\b(?:[a-z0-9-]+\.)+scryfall\.(?:com|io)\b/gi, // api., cards., data., svgs., c1. ...
  /(?<![\w.-])scryfall\.io\b/gi,
  /(?<![\w.-])scryfall\.com\/[^\s"'`<)]+/gi, // any page past the home page
];

/** Scryfall addresses in some text, other than the home page link. */
export function findScryfallUrls(text) {
  return [...new Set(SCRYFALL.flatMap((pattern) => text.match(pattern) ?? []))];
}

/** Every file under `dir` with the Scryfall addresses it holds. */
export function scanBuild(dir) {
  const found = [];
  const walk = (folder) => {
    for (const name of readdirSync(folder)) {
      const file = path.join(folder, name);
      if (statSync(file).isDirectory()) walk(file);
      else {
        const urls = findScryfallUrls(readFileSync(file, 'latin1'));
        if (urls.length) found.push({ file: path.relative(dir, file), urls });
      }
    }
  };
  walk(dir);
  return found;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = path.resolve(process.argv[2] ?? path.join(ROOT_DIR, 'web', 'dist'));
  let found;
  try {
    found = scanBuild(dir);
  } catch (error) {
    console.error(`Can't read ${dir} (run npm run web:build first): ${error.message}`);
    process.exit(1);
  }
  if (found.length) {
    console.error('The frontend build must not call Scryfall; it does here:');
    for (const { file, urls } of found) console.error(`  ${file}: ${urls.join(', ')}`);
    process.exit(1);
  }
  console.log(`No Scryfall addresses in ${path.relative(process.cwd(), dir) || dir}`);
}
