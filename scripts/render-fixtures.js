/**
 * Renders every card-model fixture with the real renderer (T-B2 onwards) into
 * out/render/, plus a contact sheet (_all.png), so its progress can be checked
 * against the preview spike. `npm run render:fixtures [-- --no-art] [slug ...]`
 *
 * Like the spike, it reports which images are new or changed since the last run.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from 'canvas';
import { createArtFetcher } from '../src/art/art-cache.js';
import { createSetSymbolFetcher } from '../src/art/set-symbols.js';
import { OUT_DIR } from '../src/paths.js';
import { renderCardPng } from '../src/render/node.js';
import { loadCardFixtures } from '../test/fixtures/cards.js';

const args = process.argv.slice(2);
const noArt = args.includes('--no-art');
const wanted = args.filter((a) => !a.startsWith('--'));
const dir = path.join(OUT_DIR, 'render');
await mkdir(dir, { recursive: true });
const artFetcher = createArtFetcher();
const setSymbols = createSetSymbolFetcher();

const created = [];
const changed = [];
const rendered = [];
for (const [slug, model] of loadCardFixtures()) {
  if (wanted.length && !wanted.includes(slug)) continue;
  const art = noArt ? null : await artFetcher.fetchArt(model.artUrl);
  const setSymbol = noArt ? null : await setSymbols.fetchSetSymbol(model.setCode);
  const png = await renderCardPng(model, { art, setSymbol });
  const file = path.join(dir, `${slug}.png`);
  const previous = await readFile(file).catch(() => null);
  if (!previous) created.push(file);
  else if (!previous.equals(png)) changed.push(file);
  await writeFile(file, png);
  rendered.push([slug, png]);
}
await artFetcher.flush();

// Contact sheet: every card at a quarter size, six to a row, with its slug.
const [w, h, cols] = [188, 263, 6];
const sheet = createCanvas(cols * (w + 10) + 10, Math.ceil(rendered.length / cols) * (h + 34) + 10);
const ctx = sheet.getContext('2d');
ctx.fillStyle = '#2b2b2b';
ctx.fillRect(0, 0, sheet.width, sheet.height);
ctx.fillStyle = '#ddd';
ctx.font = '14px sans-serif';
for (const [i, [slug, png]] of rendered.entries()) {
  const x = 10 + (i % cols) * (w + 10);
  const y = 10 + Math.floor(i / cols) * (h + 34);
  ctx.drawImage(await loadImage(png), x, y, w, h);
  ctx.fillText(slug, x, y + h + 20);
}
await writeFile(path.join(dir, '_all.png'), sheet.toBuffer('image/png'));

const list = (files) =>
  files.length ? files.map((f) => path.relative(process.cwd(), f)).join(' ') : 'none';
console.log(`Rendered ${rendered.length} cards and _all.png to ${dir}`);
console.log(`New: ${list(created)}`);
console.log(`Changed: ${list(changed)}`);
