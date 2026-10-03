import { TEXT_SYMBOLS } from '../config/text-symbols.js';
import { textFont } from './fonts.js';

/**
 * Drawing mana and text symbols (D7, D11; Requirements 6.4.6–6.4.7), shared by
 * the text box and the stat bar.
 */

/**
 * A symbol's image by Scryfall code, ready for the text box, or null when it
 * has none. The extra text symbols (chaos, ticket, planeswalker) are white
 * icons, so they come back tinted dark.
 */
export async function textSymbolImage(assets, code) {
  const image = await assets.symbol(code);
  return image && TEXT_SYMBOLS[code.toUpperCase()] ? assets.tinted(image, '#111') : image;
}

/** Grey circle with the code, for symbols without an image (e.g. G/U/P; 6.4.7). */
export function drawFallbackSymbol(ctx, code, x, y, size) {
  ctx.save();
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = textFont(Math.round(size / (code.length > 2 ? 3.2 : 2)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, x + size / 2, y + size / 2 + 1);
  ctx.restore();
}

/** Draws a symbol in a `size` square at (x, y), or its fallback. */
export async function drawSymbol(ctx, assets, code, x, y, size) {
  const image = await textSymbolImage(assets, code);
  if (image) ctx.drawImage(image, x, y, size, size);
  else drawFallbackSymbol(ctx, code, x, y, size);
}
