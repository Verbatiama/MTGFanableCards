import { ART, BOX, CARD, FOOTER, NAME, TEXT, TEXT_SIZE, TYPE } from '../config/layout.js';
import { fitFont, textFont } from './fonts.js';

/**
 * Card renderer (T-B2 onwards, Requirements 4–7). Draws one card model onto a
 * Canvas 2D context of CARD.width × CARD.height. Works with node-canvas and
 * the browser's canvas alike (D5): anything environment-specific (creating
 * canvases, loading images and fonts) comes in through `options.env`.
 *
 * This is the foundation: the card and its regions. The stat bar, frame, text
 * box and footer are filled in by T-B3 to T-B12.
 *
 * @typedef {object} RenderEnv
 * @property {(width: number, height: number) => any} createCanvas For offscreen work.
 * @property {(source: any) => Promise<any>} loadImage
 *
 * @typedef {object} RenderOptions
 * @property {RenderEnv} env
 * @property {any} [art] Loaded art image, or null for the black placeholder (3.4.1).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../model/card-model.js').CardModel} model
 * @param {RenderOptions} options
 */
export async function renderCard(ctx, model, { art = null } = {}) {
  ctx.save();
  // The whole card is black: its border and the stat bar (3.5.1, 4.1).
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CARD.width, CARD.height);
  drawCardBox(ctx, model, art);
  ctx.restore();
}

/** Placeholder card box: plain panels with the name and type line (frames: T-B4). */
function drawCardBox(ctx, model, art) {
  const width = BOX.right - BOX.x;
  ctx.fillStyle = '#c9ced2';
  ctx.fillRect(BOX.x - 4, 4, width + 8, FOOTER.y - 12);

  ctx.fillStyle = '#e4e7ea';
  ctx.fillRect(BOX.x, NAME.y, width, NAME.h);
  ctx.fillRect(BOX.x, TYPE.y, width, TYPE.h);
  ctx.fillRect(BOX.x + 6, TEXT.y, width - 12, TEXT.h);

  const artBox = { x: BOX.x + 6, y: ART.y, w: width - 12, h: ART.h };
  ctx.fillStyle = '#000';
  ctx.fillRect(artBox.x, artBox.y, artBox.w, artBox.h);
  if (art) drawCover(ctx, art, artBox);

  ctx.fillStyle = '#111';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fitFont(ctx, model.name, width - 30, TEXT_SIZE.name, textFont);
  ctx.fillText(model.name, BOX.x + 14, NAME.y + NAME.h / 2 + 2);
  fitFont(ctx, model.typeLine, width - 100, TEXT_SIZE.typeLine, textFont);
  ctx.fillText(model.typeLine, BOX.x + 14, TYPE.y + TYPE.h / 2 + 2);
}

/**
 * Scales the art to cover the box and trims the overflow evenly from both
 * sides (3.4.2).
 */
export function drawCover(ctx, image, box) {
  const scale = Math.max(box.w / image.width, box.h / image.height);
  const sw = box.w / scale;
  const sh = box.h / scale;
  ctx.drawImage(
    image,
    (image.width - sw) / 2,
    (image.height - sh) / 2,
    sw,
    sh,
    box.x,
    box.y,
    box.w,
    box.h,
  );
}
