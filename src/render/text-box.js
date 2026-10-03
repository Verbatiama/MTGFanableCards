import { BOX, FULL_ART_BASIC, TEXT, TEXT_PADDING, TEXT_SIZE } from '../config/layout.js';
import { TEXT_SYMBOLS } from '../config/text-symbols.js';
import { tokenizeCard } from '../parse/oracle-text.js';
import { textFont } from './fonts.js';
import { drawSymbol } from './symbols.js';

/**
 * Text box contents (T-B5, D20; Requirements 6.4): rules text with inline
 * symbols, italic reminder and flavour text, and text fitting. No watermark
 * (T-S4, C22).
 *
 * Basic lands show a large mana symbol instead (6.4.4, T-B12). Planeswalker
 * ability bands (7.2) are drawn by planeswalker.js, which reuses layoutText
 * and drawLines.
 */

const RULES_COLOUR = '#111';
const FLAVOUR_COLOUR = '#3a3a3a';
/** Flavour text is this much smaller than the rules text. */
const FLAVOUR_SMALLER = 2;
/** Beleren has no italic cut, so italics are slanted. */
const SLANT = -0.2;

/** Width of the dark ring around inline mana symbols. */
const SYMBOL_RING = 1.5;

/** Inline symbol size for a text size. */
const symbolSize = (size) => Math.round(size * 0.95);

/**
 * Breaks paragraphs from the tokenizer (T-A7) into lines at a text size.
 *
 * Lines hold measured tokens: words and spaces (`text`, `italic`) and symbols
 * (`symbol`). The first flavour line has `rule` set: a divider is drawn above it.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../parse/oracle-text.js').Paragraph[]} paragraphs
 * @param {number} width
 * @param {number} size Rules text size in pixels.
 * @returns {{ lines: object[], height: number }} Line baselines (`y`) are from the top.
 */
export function layoutText(ctx, paragraphs, width, size) {
  const lineHeight = Math.round(size * 1.22);
  const lines = [];
  let cursor = 0;
  paragraphs.forEach((p, pi) => {
    const flavor = p.kind === 'flavor';
    ctx.font = textFont(flavor ? size - FLAVOUR_SMALLER : size);
    if (pi > 0) cursor += Math.round(size * (flavor ? 0.7 : 0.35));
    const icon = { width: symbolSize(size) + 2 };
    const measured = (text, italic) => ({ text, italic, width: ctx.measureText(text).width });
    // Tokens → words, spaces and symbols.
    const tokens = [];
    for (const t of p.tokens) {
      if (t.type === 'symbol') {
        tokens.push({ symbol: t.symbol, ...icon });
      } else {
        for (const part of t.text.split(/(\s+)/).filter(Boolean)) {
          tokens.push({ ...measured(part, t.italic), space: /^\s+$/.test(part) });
        }
      }
    }
    let line = { tokens: [], flavor, rule: flavor && !lines.some((l) => l.flavor) };
    let lineWidth = 0;
    const push = () => {
      while (line.tokens.at(-1)?.space) line.tokens.pop();
      cursor += lineHeight;
      line.y = cursor;
      lines.push(line);
      line = { tokens: [], flavor };
      lineWidth = 0;
    };
    for (const token of tokens) {
      if (lineWidth + token.width > width && line.tokens.length && !token.space) push();
      if (token.space && !line.tokens.length) continue;
      line.tokens.push(token);
      lineWidth += token.width;
    }
    push();
  });
  return { lines, height: cursor + 6 };
}

/**
 * Draws lines from layoutText with their top at (x, y).
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<typeof import('./assets.js').createAssets>} assets
 */
export async function drawLines(ctx, assets, layout, x, y, width, size) {
  for (const line of layout.lines) {
    const colour = line.flavor ? FLAVOUR_COLOUR : RULES_COLOUR;
    const font = textFont(line.flavor ? size - FLAVOUR_SMALLER : size);
    ctx.fillStyle = colour;
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    let lx = x;
    for (const token of line.tokens) {
      const s = symbolSize(size);
      const top = y + line.y - s * 0.82;
      if (token.symbol) {
        // A dark ring keeps the pale mana discs from blending into the text
        // box (T-S4, C17b); the extra text symbols are bare icons, with no disc.
        if (!TEXT_SYMBOLS[token.symbol.toUpperCase()]) {
          ctx.beginPath();
          ctx.arc(lx + 1 + s / 2, top + s / 2, s / 2 + SYMBOL_RING, 0, Math.PI * 2);
          ctx.fillStyle = RULES_COLOUR;
          ctx.fill();
          ctx.fillStyle = colour;
        }
        await drawSymbol(ctx, assets, token.symbol, lx + 1, top, s);
      } else {
        ctx.font = font;
        if (token.italic) {
          // Slant around the baseline.
          ctx.save();
          ctx.translate(lx, y + line.y);
          ctx.transform(1, 0, SLANT, 1, 0, 0);
          ctx.fillText(token.text, 0, 0);
          ctx.restore();
        } else ctx.fillText(token.text, lx, y + line.y);
      }
      lx += token.width;
    }
    if (line.rule) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, y + line.y - size * 1.25, width, 1.5);
    }
  }
}

/**
 * The size and lines that fit `height` (6.4.8, D20): everything at full size
 * if it fits; otherwise the flavour text is dropped and the rules text shrinks,
 * down to the minimum size. Rules text is never cut, so at the minimum it may
 * overflow.
 */
export function fitText(ctx, paragraphs, width, height) {
  const rules = paragraphs.filter((p) => p.kind === 'rules');
  let size = TEXT_SIZE.rules;
  let layout = layoutText(ctx, paragraphs, width, size);
  if (layout.height > height) {
    layout = layoutText(ctx, rules, width, size);
    while (layout.height > height && size > TEXT_SIZE.minRules) {
      layout = layoutText(ctx, rules, width, --size);
    }
  }
  return { size, layout };
}

/**
 * Draws the rules and flavour text inside the text box band, fitted (6.4.1–6.4.8).
 * @param {(message: string) => void} [warn] Told when the text overflows at the minimum size.
 */
export async function drawRulesText(ctx, model, assets, box = TEXT, warn = () => {}) {
  const x = BOX.x + TEXT_PADDING.x;
  const width = BOX.right - BOX.x - TEXT_PADDING.x * 2;
  const height = box.h - TEXT_PADDING.top - TEXT_PADDING.bottom;
  const { size, layout } = fitText(ctx, tokenizeCard(model), width, height);
  if (layout.height > height) warn(`text box: the rules text does not fit, even at ${size}px`);
  // Centred vertically, like printed cards (T-S4, C15).
  const top = box.y + TEXT_PADDING.top + Math.max(0, (height - layout.height) / 2);
  await drawLines(ctx, assets, layout, x, top, width, size);
}

/** The mana symbol a basic land taps for, from its rules text ("{T}: Add {G}."), or null. */
export const basicLandMana = (model) => /\{([WUBRGC])\}/.exec(model.oracleText)?.[1] ?? null;

/**
 * A basic land's large mana symbol, over its full art where the text box would
 * be (6.4.4, T-S4 C21), placed as in the mockup's Forest.
 */
export async function drawBasicLandSymbol(ctx, model, assets) {
  const mana = basicLandMana(model);
  if (!mana) return;
  const { size, symbolY } = FULL_ART_BASIC;
  const cx = BOX.x + (BOX.right - BOX.x) / 2;
  await drawSymbol(ctx, assets, mana, cx - size / 2, symbolY - size / 2, size);
}

/**
 * Draws the text box contents over the frame's background.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../model/card-model.js').CardModel} model
 * @param {{ assets: ReturnType<typeof import('./assets.js').createAssets>, box?: { y: number, h: number },
 *   warn?: (message: string) => void }} options
 */
export async function drawTextBox(ctx, model, { assets, box = TEXT, warn }) {
  ctx.save();
  if (model.supertypes.includes('Basic')) await drawBasicLandSymbol(ctx, model, assets);
  else if (!model.types.includes('Planeswalker'))
    await drawRulesText(ctx, model, assets, box, warn);
  ctx.restore();
}
