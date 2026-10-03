/**
 * Side-by-side comparisons with the reference mockups (T-S4): each of the ten
 * mockup cards, cut from the composite (Examples/jauIjDF.jpeg), next to the
 * real renderer's output for its fixture, into out/mockups/<slug>.png.
 * `npm run mockups:compare` (renders with art from the cache, downloading any
 * that is missing).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from 'canvas';
import { createArtFetcher } from '../src/art/art-cache.js';
import { createSetSymbolFetcher } from '../src/art/set-symbols.js';
import { CARD } from '../src/config/layout.js';
import { OUT_DIR, ROOT_DIR } from '../src/paths.js';
import { renderCardPng } from '../src/render/node.js';
import { loadCardFixture } from '../test/fixtures/cards.js';

const COMPOSITE = path.join(ROOT_DIR, 'Examples', 'jauIjDF.jpeg');
/** Where each card sits in the composite (2165 × 1191): 5 columns, 2 rows. */
const CELL = { left: [24, 451, 879, 1308, 1734], top: [22, 608], width: 400, height: 560 };
const MOCKUP_LAYOUT = [
  ['damnation', 'feral-invocation', 'fiendslayer-paladin', 'forest', 'jace-the-mind-sculptor'],
  [
    'lightning-strike',
    'niv-mizzet-the-firemind',
    'sword-of-fire-and-ice',
    'wasteland',
    'wurmcoil-engine',
  ],
];

const dir = path.join(OUT_DIR, 'mockups');
await mkdir(dir, { recursive: true });
const composite = await loadImage(await readFile(COMPOSITE));
const artFetcher = createArtFetcher();
const setSymbols = createSetSymbolFetcher();
const gap = 20;

for (const [row, slugs] of MOCKUP_LAYOUT.entries()) {
  for (const [column, slug] of slugs.entries()) {
    const model = loadCardFixture(slug);
    const png = await renderCardPng(model, {
      art: await artFetcher.fetchArt(model.artUrl),
      setSymbol: await setSymbols.fetchSetSymbol(model.setCode),
    });
    const canvas = createCanvas(CARD.width * 2 + gap, CARD.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const [x, y] = [CELL.left[column], CELL.top[row]];
    ctx.drawImage(composite, x, y, CELL.width, CELL.height, 0, 0, CARD.width, CARD.height);
    ctx.drawImage(await loadImage(png), CARD.width + gap, 0);
    await writeFile(path.join(dir, `${slug}.png`), canvas.toBuffer('image/png'));
  }
}
await artFetcher.flush();
console.log(`Wrote 10 mockup comparisons (mockup left, render right) to ${dir}`);
