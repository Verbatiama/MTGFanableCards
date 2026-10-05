import { zipSync } from 'fflate';
import { PDFDocument, grayscale } from 'pdf-lib';

/**
 * The bundles themselves (T-A11, D4, Requirements 3.5.1, 3.5.3), with no
 * Node-only code, so the browser builds the same files in frontend-render
 * mode (T-S14). bundle.js wraps them for the server and the CLI.
 *
 * @typedef {import('./bundle.js').OutputImage} OutputImage
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
export const JPEG_QUALITY = 0.92;
const CUT_LINE = { thickness: 0.3, color: grayscale(0.55) };

/**
 * `cards.zip` contents (3.5.1). PNGs are already compressed, so they're stored
 * as-is rather than deflated again.
 * @param {{ fileName: string, png: Uint8Array }[]} images
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
 * @param {object} env
 * @param {(image: OutputImage) => Promise<Uint8Array> | Uint8Array} env.readPng
 * @param {(png: Uint8Array) => Promise<Uint8Array>} env.toJpeg At JPEG_QUALITY.
 * @returns {Promise<Uint8Array>}
 */
export async function buildPdf(images, { readPng, toJpeg }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('MTG Fannable Cards');
  pdf.setCreator('MTGFannableCards');
  const left = (A4_W - PER_ROW * CARD_W) / 2;
  const bottom = (A4_H - PER_ROW * CARD_H) / 2;

  const embedded = new Map(); // png (or its file) → its embedded JPEG
  let page;
  for (const [i, image] of images.entries()) {
    if (i % PER_PAGE === 0) {
      page = pdf.addPage([A4_W, A4_H]);
      drawCutLines(page, left, bottom, Math.min(PER_PAGE, images.length - i));
    }
    const slot = i % PER_PAGE;
    const column = slot % PER_ROW;
    const row = Math.floor(slot / PER_ROW);
    const key = image.png ?? image.file;
    if (!embedded.has(key))
      embedded.set(key, await pdf.embedJpg(await toJpeg(await readPng(image))));
    page.drawImage(embedded.get(key), {
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
