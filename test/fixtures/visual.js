import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from 'canvas';
import { renderCardPng } from '../../src/render/node.js';
import { loadCardFixture, MOCKUP_FIXTURES } from './cards.js';

/**
 * Visual regression references (T-S4): the ten mockup cards (MOCKUP_FIXTURES),
 * rendered offline (no art or set symbol, so the black placeholder and the set
 * code) with a fixed copyright year, in test/fixtures/visual/<slug>.png. They
 * were approved against the mockups (changes.md); `npm run visual:update`
 * re-renders them after an intended change.
 */
export const VISUAL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'visual');
export const VISUAL_YEAR = 2026;
export { MOCKUP_FIXTURES };

/** A pixel counts as different when a channel differs by more than this. */
const CHANNEL_TOLERANCE = 32;
/**
 * At most this share of pixels (about 150) may differ, for anti-aliasing
 * differences between machines; one extra sentence of rules text is about 0.1%.
 */
export const MAX_DIFFERENT = 0.0002;

export const renderReference = (slug) =>
  renderCardPng(loadCardFixture(slug), { year: VISUAL_YEAR });

/**
 * Compares two PNGs of the same size.
 * @returns {Promise<{ share: number, diff: Buffer }>} The share of pixels that
 *   differ, and an image marking them in red over a faded copy of `expected`.
 */
export async function comparePngs(actual, expected) {
  const [a, b] = await Promise.all([loadImage(actual), loadImage(expected)]);
  if (a.width !== b.width || a.height !== b.height) return { share: 1, diff: Buffer.from(actual) };
  const pixels = (image) => {
    const ctx = createCanvas(image.width, image.height).getContext('2d');
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, image.width, image.height);
  };
  const [pa, pb] = [pixels(a), pixels(b)];
  const out = createCanvas(a.width, a.height);
  const ctx = out.getContext('2d');
  const marked = ctx.createImageData(a.width, a.height);
  let different = 0;
  for (let i = 0; i < pa.data.length; i += 4) {
    const delta = Math.max(
      Math.abs(pa.data[i] - pb.data[i]),
      Math.abs(pa.data[i + 1] - pb.data[i + 1]),
      Math.abs(pa.data[i + 2] - pb.data[i + 2]),
    );
    const off = delta > CHANNEL_TOLERANCE;
    if (off) different += 1;
    const grey = (pb.data[i] + pb.data[i + 1] + pb.data[i + 2]) / 12 + 160;
    marked.data.set(off ? [255, 0, 0, 255] : [grey, grey, grey, 255], i);
  }
  ctx.putImageData(marked, 0, 0);
  return { share: different / (a.width * a.height), diff: out.toBuffer('image/png') };
}
