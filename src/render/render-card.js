import { CARD } from '../config/layout.js';
import { drawFooter } from './footer.js';
import { drawFrame } from './frame.js';
import { drawStatBarBottom, drawStatBarMiddle, drawStatBarTop } from './stat-bar.js';
import { drawTextBox } from './text-box.js';

/**
 * Card renderer (T-B2 onwards, Requirements 4–7). Draws one card model onto a
 * Canvas 2D context of CARD.width × CARD.height. Works with node-canvas and
 * the browser's canvas alike (D5): anything environment-specific (creating
 * canvases, loading images and fonts) comes in through `options.env`.
 *
 * Draws the frame (T-B4), the text box contents (T-B5), the footer (T-B6) and
 * the stat bar (T-B7 to T-B9); planeswalker bands and the basic land symbol
 * follow in T-B11 and T-B12.
 *
 * @typedef {object} RenderEnv
 * @property {(width: number, height: number) => any} createCanvas For offscreen work.
 * @property {(source: any) => Promise<any>} loadImage
 *
 * @typedef {object} RenderOptions
 * @property {RenderEnv} env
 * @property {ReturnType<typeof import('./assets.js').createAssets>} assets Shared asset loader (T-B3).
 * @property {any} [art] Loaded art image, or null for the black placeholder (3.4.1).
 * @property {any} [setSymbol] Loaded set symbol image, or null to show the set code (6.3).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../model/card-model.js').CardModel} model
 * @param {RenderOptions} options
 */
export async function renderCard(ctx, model, { env, assets, art = null, setSymbol = null } = {}) {
  ctx.save();
  // The whole card is black: its border and the stat bar (3.5.1, 4.1).
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CARD.width, CARD.height);
  drawFrame(ctx, model, { env, art, setSymbol });
  await drawTextBox(ctx, model, { assets });
  await drawFooter(ctx, model, { assets });
  const from = await drawStatBarTop(ctx, model, { assets });
  await drawStatBarMiddle(ctx, model, { assets, from });
  await drawStatBarBottom(ctx, model, { assets });
  ctx.restore();
}
