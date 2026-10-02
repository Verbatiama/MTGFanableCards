import { FONTS } from '../config/layout.js';

/** CSS font strings for the canvas (D6). */
export const textFont = (size) => `${FONTS.text.weight} ${size}px "${FONTS.text.family}"`;
export const labelFont = (size) => `${FONTS.label.weight} ${size}px "${FONTS.label.family}"`;

/**
 * Largest size from `size` down to `min` at which `text` fits in `maxWidth`.
 * Leaves `ctx.font` set to that size.
 */
export function fitFont(ctx, text, maxWidth, size, font, min = 12) {
  for (; size > min; size -= 1) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  ctx.font = font(min);
  return min;
}
