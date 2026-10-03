import { CARD } from '../config/layout.js';
import { drawFooter } from './footer.js';
import { drawFrame } from './frame.js';
import { cardLayout, drawAbilityBands, drawLoyaltyCosts } from './planeswalker.js';
import { drawStatBarBottom, drawStatBarMiddle, drawStatBarTop } from './stat-bar.js';
import { drawTextBox } from './text-box.js';

/**
 * Card renderer (T-B2 onwards, Requirements 4–7). Draws one card model onto a
 * Canvas 2D context of CARD.width × CARD.height. Works with node-canvas and
 * the browser's canvas alike (D5): anything environment-specific (creating
 * canvases, loading images and fonts) comes in through `options.env`.
 *
 * Draws the frame (T-B4), the text box contents (T-B5), the footer (T-B6), the
 * stat bar (T-B7 to T-B10) and planeswalker ability bands and loyalty costs
 * (T-B11); the basic land symbol follows in T-B12.
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
 * @returns {Promise<{ warnings: string[] }>} Anything that didn't fit even at its
 *   smallest (D19, D20). It is still drawn, never hidden.
 */
export async function renderCard(ctx, model, { env, assets, art = null, setSymbol = null } = {}) {
  const warnings = [];
  const warn = (message) => warnings.push(message);
  ctx.save();
  // The whole card is black: its border and the stat bar (3.5.1, 4.1).
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CARD.width, CARD.height);
  // Bands first: a planeswalker's abilities decide where everything goes (7.2.6).
  const layout = cardLayout(ctx, model);
  const bands = { art: layout.art, type: layout.type, text: layout.text };
  if (layout.art.h <= 0) warn('text box: the abilities need more room than the art box has');
  drawFrame(ctx, model, { env, art, setSymbol, layout: bands });
  await drawTextBox(ctx, model, { assets, box: layout.text, warn });
  if (layout.pw) await drawAbilityBands(ctx, assets, layout.pw);
  await drawFooter(ctx, model, { assets });
  const from = await drawStatBarTop(ctx, model, { assets, warn, ...bands });
  await drawStatBarMiddle(ctx, model, { assets, from, warn, ...bands });
  if (layout.pw) await drawLoyaltyCosts(ctx, assets, layout.pw);
  await drawStatBarBottom(ctx, model, { assets, ...bands });
  ctx.restore();
  return { warnings };
}
