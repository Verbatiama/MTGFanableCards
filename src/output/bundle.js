import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';

/**
 * Output bundles (T-A11, D4, Requirements 3.5): the PNG files themselves,
 * `cards.zip`, or the optional A4 PDF with 9 cards per page.
 *
 * Every function takes the images in output order as
 * `{ fileName, png }` (file names from assignFileNames).
 *
 * @typedef {{ fileName: string, png: Uint8Array }} OutputImage
 */

/** Physical card size (63 × 88 mm), so printed cards can be cut out and sleeved. */
const MM = 72 / 25.4; // PDF points per millimetre
const CARD_W = 63 * MM;
const CARD_H = 88 * MM;
const A4_W = 210 * MM;
const A4_H = 297 * MM;
const PER_ROW = 3;
const PER_PAGE = 9;

/** Writes each image to `dir` (scripts and the CLI write to out/, 3.5.6). */
export async function writeImages(dir, images) {
  await mkdir(dir, { recursive: true });
  for (const { fileName, png } of images) await writeFile(path.join(dir, fileName), png);
}

/**
 * `cards.zip` contents (3.5.1). PNGs are already compressed, so they're stored
 * as-is rather than deflated again.
 * @param {OutputImage[]} images
 * @returns {Uint8Array}
 */
export function zipImages(images) {
  const entries = Object.fromEntries(
    images.map(({ fileName, png }) => [fileName, [png, { level: 0 }]]),
  );
  return zipSync(entries);
}

/**
 * `cards.pdf` contents (3.5.3): A4 pages with up to 9 cards each, 3 × 3, at
 * real card size, centred on the page, in output order.
 * @param {OutputImage[]} images
 * @returns {Promise<Uint8Array>}
 */
export async function pdfSheets(images) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('MTG Fannable Cards');
  pdf.setCreator('MTGFannableCards');
  const left = (A4_W - PER_ROW * CARD_W) / 2;
  const top = (A4_H - PER_ROW * CARD_H) / 2;

  let page;
  for (const [i, { png }] of images.entries()) {
    if (i % PER_PAGE === 0) page = pdf.addPage([A4_W, A4_H]);
    const slot = i % PER_PAGE;
    const column = slot % PER_ROW;
    const row = Math.floor(slot / PER_ROW);
    page.drawImage(await pdf.embedPng(png), {
      x: left + column * CARD_W,
      // PDF y runs upwards, so the first row is the highest.
      y: A4_H - top - (row + 1) * CARD_H,
      width: CARD_W,
      height: CARD_H,
    });
  }
  return pdf.save();
}
