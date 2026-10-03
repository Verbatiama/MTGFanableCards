import { BOX, TEXT, TEXT_PADDING, TEXT_SIZE } from '../config/layout.js';
import { STAT_ICONS } from '../config/text-symbols.js';
import { WATERMARKS } from '../config/watermarks.js';
import { tokenizeCard } from '../parse/oracle-text.js';
import { labelFont, textFont } from './fonts.js';
import { drawFallbackSymbol, drawSymbol } from './symbols.js';

/**
 * Text box contents (T-B5, D20; Requirements 6.4): rules text with inline
 * symbols, italic reminder and flavour text, sword/shield P/T modifiers, the
 * watermark behind it, and text fitting.
 *
 * Basic lands (a large mana symbol, 6.4.4) and planeswalker ability bands
 * (7.2) are drawn by T-B12 and T-B11, which reuse layoutText and drawLines.
 */

const RULES_COLOUR = '#111';
const FLAVOUR_COLOUR = '#3a3a3a';
/** Flavour text is this much smaller than the rules text. */
const FLAVOUR_SMALLER = 2;
/** Beleren has no italic cut, so italics are slanted. */
const SLANT = -0.2;

/** Inline symbol size for a text size. */
const symbolSize = (size) => Math.round(size * 0.95);

/**
 * Breaks paragraphs from the tokenizer (T-A7) into lines at a text size.
 *
 * Lines hold measured tokens: words and spaces (`text`, `italic`), symbols
 * (`symbol`) and the sword/shield of a P/T modifier (`pt`: 'power' or
 * 'toughness'). A modifier and any punctuation straight after it wrap as one
 * group. The first flavour line has `rule` set: a divider is drawn above it.
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
    // Tokens → words, spaces, symbols and sword/shield groups.
    const tokens = [];
    for (const t of p.tokens) {
      if (t.type === 'symbol') {
        tokens.push({ symbol: t.symbol, ...icon });
      } else if (t.type === 'pt') {
        tokens.push(
          { ...measured(`${t.power} `, false), joined: true },
          { pt: 'power', ...icon, joined: true },
          { ...measured(` ${t.toughness} `, false), joined: true },
          { pt: 'toughness', ...icon, joined: false },
        );
      } else {
        for (const part of t.text.split(/(\s+)/).filter(Boolean)) {
          // Text straight after a modifier (e.g. the "." in "+2/+2.") stays with it.
          const last = tokens.at(-1);
          if (last?.pt === 'toughness' && !/^\s/.test(part)) last.joined = true;
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
    for (const [i, token] of tokens.entries()) {
      // Wrap before a modifier group as a whole, never inside it.
      const groupWidth =
        token.joined && !tokens[i - 1]?.joined
          ? tokens
              .slice(i)
              .reduce((w, t, j, rest) => (j && !rest[j - 1].joined ? w : w + t.width), 0)
          : token.width;
      if (tokens[i - 1]?.joined) {
        line.tokens.push(token);
        lineWidth += token.width;
        continue;
      }
      if (lineWidth + groupWidth > width && line.tokens.length && !token.space) push();
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
      if (token.pt) {
        // Sword / shield after each number of a +N/+N or -N/-N modifier (6.4.5).
        // The icons are white for the bar; tint them dark for the text box.
        const icon = await assets.icon(STAT_ICONS[token.pt].icon);
        if (icon) ctx.drawImage(assets.tinted(icon, RULES_COLOUR), lx + 1, top, s, s);
        else drawFallbackSymbol(ctx, STAT_ICONS[token.pt].placeholder, lx + 1, top, s);
        ctx.fillStyle = colour;
      } else if (token.symbol) {
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
 * The watermark, faint and centred behind the text (6.4.3, D20). A watermark
 * without an icon is shown as its name.
 * @param {{ y: number, h: number }} [box] The text box band.
 */
export async function drawWatermark(ctx, model, assets, box = TEXT) {
  if (!model.watermark) return;
  const width = BOX.right - BOX.x;
  const cx = BOX.x + width / 2;
  const cy = box.y + box.h / 2;
  const path = WATERMARKS[model.watermark]?.icon;
  const icon = path && (await assets.icon(path));
  ctx.save();
  if (icon) {
    const size = Math.min(box.h - 40, 300);
    ctx.globalAlpha = 0.12;
    ctx.drawImage(assets.tinted(icon, '#000', 400), cx - size / 2, cy - size / 2, size, size);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.font = labelFont(60);
    ctx.textAlign = 'center';
    ctx.fillText(model.watermark.toUpperCase(), cx, cy);
  }
  ctx.restore();
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
  await drawLines(ctx, assets, layout, x, box.y + TEXT_PADDING.top, width, size);
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
  await drawWatermark(ctx, model, assets, box);
  const special = model.supertypes.includes('Basic') || model.types.includes('Planeswalker');
  if (!special) await drawRulesText(ctx, model, assets, box, warn);
  ctx.restore();
}
