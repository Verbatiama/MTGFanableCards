/**
 * Spike scene: the same drawing code for every Canvas 2D backend.
 * Uses only the standard CanvasRenderingContext2D API so it also runs in the
 * browser. `symbols` maps a symbol code to an already-loaded image.
 */

export const CARD = { width: 750, height: 1050 };
const BAR = { width: 90, iconSize: 50, gap: 8 };
const FRAME = '#e8e2d0';
// The Beleren TTFs are bold-only; asking for normal weight makes node-canvas
// (Pango) reject them and fall back to a system font.
const NAME_FONT = 'bold 36px "Beleren"';
const RULES_FONT = 'bold 28px "Beleren"';
const LABEL_FONT = 'bold 22px "Beleren SmallCaps"';

export function drawScene(ctx, symbols) {
  drawCardBox(ctx);
  drawStatBar(ctx, symbols);
  drawRulesText(ctx, symbols);
  // Vector-scaling check: one symbol drawn much larger than its loaded size.
  ctx.drawImage(symbols.u, 430, 760, 200, 200);
}

function drawCardBox(ctx) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CARD.width, CARD.height);
  ctx.fillStyle = FRAME;
  ctx.fillRect(BAR.width, 0, CARD.width - BAR.width, CARD.height);

  ctx.fillStyle = '#222';
  ctx.font = NAME_FONT;
  ctx.textBaseline = 'middle';
  ctx.fillText('Niv-Mizzet, the Firemind', BAR.width + 24, 48);

  ctx.fillStyle = '#6b7c8f';
  ctx.fillRect(BAR.width + 16, 90, CARD.width - BAR.width - 32, 420);
}

function drawStatBar(ctx, symbols) {
  const x = (BAR.width - BAR.iconSize) / 2;
  let y = 20;
  for (const code of ['2', 'u', 'r', 'wu']) {
    ctx.drawImage(symbols[code], x, y, BAR.iconSize, BAR.iconSize);
    y += BAR.iconSize + BAR.gap;
  }

  // Vertical permanence label, read bottom to top.
  ctx.save();
  ctx.translate(BAR.width / 2, CARD.height - 40);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#fff';
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('PERMANENT', 0, 0);
  ctx.restore();
}

function drawRulesText(ctx, symbols) {
  ctx.fillStyle = '#111';
  ctx.font = RULES_FONT;
  ctx.textBaseline = 'alphabetic';
  const lines = [
    '{T}: Add {R}{R}.',
    'Whenever you draw a card, deal 1 damage.',
    '{2}{U}: Draw a card.',
  ];
  let y = 580;
  for (const line of lines) {
    drawInlineLine(ctx, line, BAR.width + 24, y, symbols);
    y += 44;
  }
}

/** Draws text containing Scryfall-style {X} symbols, with icons sized to the font. */
export function drawInlineLine(ctx, text, x, baseline, symbols) {
  const metrics = ctx.measureText('M');
  const capHeight = metrics.actualBoundingBoxAscent;
  const iconSize = Math.round(capHeight * 1.25);
  const gap = 2;

  for (const part of text.split(/(\{[^}]+\})/)) {
    if (!part) continue;
    const symbol = /^\{(.+)\}$/.exec(part);
    if (symbol) {
      const img = symbols[symbol[1].toLowerCase().replace('/', '')];
      // Centre the icon on the cap height so it sits with the letters.
      ctx.drawImage(img, x + gap, baseline - capHeight / 2 - iconSize / 2, iconSize, iconSize);
      x += iconSize + gap * 2;
    } else {
      ctx.fillText(part, x, baseline);
      x += ctx.measureText(part).width;
    }
  }
}
