import { BOX, FOOTER, TEXT_SIZE } from '../config/layout.js';
import { FOOTER_ICONS } from '../config/text-symbols.js';
import { fitFont, labelFont, textFont } from './fonts.js';

/**
 * Footer (T-B6, D20; Requirements 6.5), white on the black border below the
 * card box. Left: set code and language, on the second row; there is no
 * collector number or rarity (T-S4, C23). Right: the artist with the paintbrush, then the copyright line.
 * No holo stamp; the centre stays empty (6.5.3).
 */

/** Row offsets below FOOTER.y. */
const ROW = { first: 6, second: 28, copyright: 30 };
const COPYRIGHT_SIZE = 13;
/** The artist's name never runs into the left column. */
const LEFT_COLUMN = 160;
/** The brush is wide and flat in a square icon, so it is drawn larger than the text. */
const BRUSH_SIZE = 28;

/** The copyright line for a year: the year the image is generated (6.5.2). */
export const copyrightLine = (year) => `™ & © ${year} Wizards of the Coast`;

/**
 * Draws the footer.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../model/card-model.js').CardModel} model
 * @param {{ assets: ReturnType<typeof import('./assets.js').createAssets>, year?: number }} options
 */
export async function drawFooter(ctx, model, { assets, year = new Date().getFullYear() }) {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'top';

  ctx.font = labelFont(TEXT_SIZE.footer);
  ctx.textAlign = 'left';
  ctx.fillText(`${model.setCode} - ${model.lang.toUpperCase()}`, BOX.x, FOOTER.y + ROW.second);

  // Artist, with the paintbrush to the left of the name (6.5.1).
  const brush = await assets.icon(FOOTER_ICONS.artist.icon);
  const brushSize = brush ? BRUSH_SIZE : 0;
  const artist = model.artist.toUpperCase();
  const maxWidth = BOX.right - BOX.x - LEFT_COLUMN - brushSize - 3;
  fitFont(ctx, artist, maxWidth, TEXT_SIZE.footer, labelFont, 9);
  ctx.textAlign = 'right';
  ctx.fillText(artist, BOX.right, FOOTER.y + ROW.first);
  if (brush) {
    // Centred on the middle of the capitals.
    const left = BOX.right - ctx.measureText(artist).width - brushSize - 3;
    const middle = FOOTER.y + ROW.first + TEXT_SIZE.footer * 0.45;
    ctx.drawImage(brush, left, middle - brushSize / 2, brushSize, brushSize);
  }

  ctx.font = textFont(COPYRIGHT_SIZE);
  ctx.fillText(copyrightLine(year), BOX.right, FOOTER.y + ROW.copyright);
  ctx.restore();
}
