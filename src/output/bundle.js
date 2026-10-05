import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadImage, createCanvas } from 'canvas';
import { Zip, ZipPassThrough } from 'fflate';
import { buildPdf, JPEG_QUALITY } from './sheets.js';

export { zipImages } from './sheets.js';

/**
 * Output bundles (T-A11, D4, Requirements 3.5): the PNG files themselves,
 * `cards.zip`, or the optional A4 PDF with 9 cards per page.
 *
 * Every function takes the images in output order as
 * `{ fileName, png }` (file names from assignFileNames), or as
 * `{ fileName, file }` when the PNG was written to disk as it rendered
 * (low-memory mode, T-S13).
 *
 * @typedef {{ fileName: string, png: Uint8Array } | { fileName: string, file: string }} OutputImage
 */

/** An image's PNG bytes, read from disk if it was written there. */
const readPng = (image) => image.png ?? readFile(image.file);

/** Writes each image to `dir` (scripts and the CLI write to out/, 3.5.6). */
export async function writeImages(dir, images) {
  await mkdir(dir, { recursive: true });
  for (const image of images) {
    await writeFile(path.join(dir, image.fileName), await readPng(image));
  }
}

/**
 * Writes the same zip as `zipImages` to `target`, one image at a time, so the
 * images and the zip are never all in memory (low-memory mode, T-S13).
 * @param {OutputImage[]} images
 * @param {string} target
 */
export async function zipImagesToFile(images, target) {
  const out = createWriteStream(target);
  const finished = once(out, 'finish');
  const zip = new Zip((error, chunk, final) => {
    if (error) return out.destroy(error);
    out.write(chunk);
    if (final) out.end();
  });
  for (const image of images) {
    const entry = new ZipPassThrough(image.fileName);
    zip.add(entry);
    entry.push(await readPng(image), true);
    if (out.writableNeedDrain) await once(out, 'drain');
  }
  zip.end();
  await finished;
}

/**
 * `cards.pdf` contents (3.5.3); see buildPdf.
 * @param {OutputImage[]} images
 * @returns {Promise<Uint8Array>}
 */
export const pdfSheets = (images) => buildPdf(images, { readPng, toJpeg });

async function toJpeg(png) {
  const image = await loadImage(Buffer.from(png));
  const canvas = createCanvas(image.width, image.height);
  canvas.getContext('2d').drawImage(image, 0, 0);
  const jpeg = canvas.toBuffer('image/jpeg', { quality: JPEG_QUALITY });
  // Free the decoded pixels now rather than at the next collection, which the
  // card database's steady heap makes rare (T-S6): an empty source drops them.
  canvas.width = 0;
  image.onerror = () => {};
  image.src = Buffer.alloc(0);
  return jpeg;
}
