import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadImage, createCanvas } from 'canvas';
import { zipSync } from 'fflate';
import { PDFDocument, grayscale } from 'pdf-lib';

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
/** JPEG quality for PDF pages: about 5× smaller than PNG, no visible loss in print. */
const JPEG_QUALITY = 0.92;
const CUT_LINE = { thickness: 0.3, color: grayscale(0.55) };

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
 * real card size, centred on the page, in output order. Cards are embedded as
 * JPEGs to keep the file small, and thin grey cut lines run the full width and
 * height of the page along every card edge, so they show on the margins and
 * on the cards' black borders. Copies that share one PNG (generateCards reuses
 * a face's image for each copy) are converted and embedded once.
 * @param {OutputImage[]} images
 * @returns {Promise<Uint8Array>}
 */
export async function pdfSheets(images) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('MTG Fannable Cards');
  pdf.setCreator('MTGFannableCards');
  const left = (A4_W - PER_ROW * CARD_W) / 2;
  const bottom = (A4_H - PER_ROW * CARD_H) / 2;

  const embedded = new Map(); // png → its embedded JPEG
  let page;
  for (const [i, { png }] of images.entries()) {
    if (i % PER_PAGE === 0) {
      page = pdf.addPage([A4_W, A4_H]);
      drawCutLines(page, left, bottom, Math.min(PER_PAGE, images.length - i));
    }
    const slot = i % PER_PAGE;
    const column = slot % PER_ROW;
    const row = Math.floor(slot / PER_ROW);
    if (!embedded.has(png)) embedded.set(png, await pdf.embedJpg(await toJpeg(png)));
    page.drawImage(embedded.get(png), {
      x: left + column * CARD_W,
      // PDF y runs upwards, so the first row is the highest.
      y: bottom + (PER_ROW - 1 - row) * CARD_H,
      width: CARD_W,
      height: CARD_H,
    });
  }
  return pdf.save();
}

/**
 * Cut lines along the edges of the rows and columns in use: horizontal lines
 * run the full page width; vertical lines run from the top of the page to the
 * bottom of the last used row (to the bottom of the page when it's full), so a
 * part-filled last page isn't covered in lines.
 */
function drawCutLines(page, left, bottom, cards) {
  const rows = Math.ceil(cards / PER_ROW);
  const columns = Math.min(cards, PER_ROW);
  const top = bottom + PER_ROW * CARD_H;
  const lowest = top - rows * CARD_H;
  const end = cards === PER_PAGE ? 0 : lowest;
  for (let i = 0; i <= rows; i++) {
    const y = top - i * CARD_H;
    page.drawLine({ start: { x: 0, y }, end: { x: A4_W, y }, ...CUT_LINE });
  }
  for (let i = 0; i <= columns; i++) {
    const x = left + i * CARD_W;
    page.drawLine({ start: { x, y: A4_H }, end: { x, y: end }, ...CUT_LINE });
  }
}

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
