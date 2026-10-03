import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from 'canvas';
import { BOX, FULL_ART_BASIC, TEXT, TEXT_SIZE } from '../../src/config/layout.js';
import { tokenizeCard, tokenizeLine } from '../../src/parse/oracle-text.js';
import { registerFonts, renderCardCanvas } from '../../src/render/node.js';
import { basicLandMana, fitText, layoutText } from '../../src/render/text-box.js';
import { loadCardFixture } from '../fixtures/cards.js';

registerFonts();
const ctx = createCanvas(10, 10).getContext('2d');
const rules = (text) => ({ kind: 'rules', cost: null, tokens: tokenizeLine(text) });
const flavor = (text) => ({
  kind: 'flavor',
  cost: null,
  tokens: tokenizeLine(text, { flavor: true }),
});
const lineText = (line) => line.tokens.map((t) => t.text ?? `[${t.symbol ?? t.pt}]`).join('');

test('text wraps to the width, without leading or trailing spaces', () => {
  const { lines } = layoutText(ctx, [rules('word '.repeat(40).trim())], 300, 26);
  assert.ok(lines.length > 1);
  for (const line of lines) {
    assert.ok(line.tokens.reduce((w, t) => w + t.width, 0) <= 300);
    assert.ok(!line.tokens[0].space && !line.tokens.at(-1).space);
  }
});

test('inline symbols are one token each, as printed (6.4.6)', () => {
  const { lines } = layoutText(ctx, [rules('{2}{U}, {T}: Add {C}{C}.')], 600, 26);
  assert.equal(lineText(lines[0]), '[2][U], [T]: Add [C][C].');
});

test('a P/T modifier is plain text, in standard formatting (C17)', () => {
  const { lines } = layoutText(ctx, [rules('Enchanted creature gets +2/+2.')], 600, 26);
  assert.equal(lineText(lines[0]), 'Enchanted creature gets +2/+2.');
});

test('reminder text is italic; flavour text gets a divider above its first line', () => {
  const { lines } = layoutText(
    ctx,
    [rules('Flash (You may cast it.)'), flavor('One line. '.repeat(12))],
    500,
    26,
  );
  const italic = lines[0].tokens
    .filter((t) => t.italic)
    .map((t) => t.text)
    .join('');
  assert.equal(italic, '(You may cast it.)');
  const flavourLines = lines.filter((l) => l.flavor);
  assert.ok(flavourLines.length > 1);
  assert.deepEqual(
    flavourLines.map((l) => Boolean(l.rule)),
    flavourLines.map((_, i) => i === 0),
  );
});

test('text that fits stays at full size, flavour included (6.4.8)', () => {
  const paragraphs = tokenizeCard(loadCardFixture('lightning-strike'));
  const { size, layout } = fitText(ctx, paragraphs, 600, 340);
  assert.equal(size, TEXT_SIZE.rules);
  assert.ok(layout.lines.some((l) => l.flavor));
});

test('too much text drops the flavour first, then shrinks the rules text (6.4.8, D20)', () => {
  const paragraphs = [rules('Rules text. '.repeat(30)), flavor('Flavour. '.repeat(20))];
  const full = layoutText(ctx, paragraphs, 600, TEXT_SIZE.rules).height;
  const rulesOnly = layoutText(ctx, paragraphs.slice(0, 1), 600, TEXT_SIZE.rules).height;

  // Room for the rules but not the flavour: flavour dropped, size kept.
  let fitted = fitText(ctx, paragraphs, 600, (full + rulesOnly) / 2);
  assert.equal(fitted.size, TEXT_SIZE.rules);
  assert.ok(!fitted.layout.lines.some((l) => l.flavor));

  // Less room: the rules text shrinks until it fits.
  fitted = fitText(ctx, paragraphs, 600, rulesOnly / 2);
  assert.ok(fitted.size < TEXT_SIZE.rules && fitted.size >= TEXT_SIZE.minRules);
  assert.ok(fitted.layout.height <= rulesOnly / 2);

  // Never cut: at the minimum size every word is still laid out.
  fitted = fitText(ctx, paragraphs, 600, 10);
  assert.equal(fitted.size, TEXT_SIZE.minRules);
  assert.deepEqual(fitted.layout, layoutText(ctx, paragraphs.slice(0, 1), 600, TEXT_SIZE.minRules));
  const words = fitted.layout.lines.flatMap((l) => l.tokens).filter((t) => t.text === 'Rules');
  assert.equal(words.length, 30);
});

test('the renderer draws the text in the text box', async () => {
  const model = loadCardFixture('lightning-strike');
  const empty = await renderCardCanvas({ ...model, oracleText: '', flavorText: null });
  const drawn = await renderCardCanvas(model);
  // Short text is centred vertically (C15), so look across the whole box.
  const region = (canvas) =>
    canvas.getContext('2d').getImageData(BOX.x + 20, TEXT.y + 14, 400, TEXT.h - 28).data;
  assert.notDeepEqual(region(drawn), region(empty));
});

test('short rules text is centred vertically in the text box (C15)', async () => {
  const model = { ...loadCardFixture('lightning-strike'), flavorText: null };
  const canvas = await renderCardCanvas(model);
  const empty = await renderCardCanvas({ ...model, oracleText: '' });
  const rows = (c, y) => c.getContext('2d').getImageData(BOX.x + 20, y, 400, 10).data;
  // Nothing at the top of the box, text in the middle.
  assert.deepEqual(rows(canvas, TEXT.y + 16), rows(empty, TEXT.y + 16));
  assert.notDeepEqual(rows(canvas, TEXT.y + TEXT.h / 2 - 8), rows(empty, TEXT.y + TEXT.h / 2 - 8));
});

test('basic lands show the mana symbol they tap for, from their rules text (6.4.4)', () => {
  assert.equal(basicLandMana(loadCardFixture('forest')), 'G');
  assert.equal(basicLandMana(loadCardFixture('snow-covered-forest')), 'G');
  assert.equal(basicLandMana({ oracleText: '({T}: Add {C}.)' }), 'C');
  assert.equal(basicLandMana({ oracleText: '' }), null);
});

test('a basic land is full-art, with its mana symbol and type line over the art (6.4.4, C21)', async () => {
  const model = loadCardFixture('forest');
  const red = createCanvas(40, 30);
  red.getContext('2d').fillStyle = '#f00';
  red.getContext('2d').fillRect(0, 0, 40, 30);
  const art = red.toBuffer('image/png');
  const canvas = await renderCardCanvas(model, { art });
  const noSymbol = await renderCardCanvas({ ...model, oracleText: '' }, { art });
  const cx = BOX.x + (BOX.right - BOX.x) / 2;
  const { symbolY } = FULL_ART_BASIC;
  const region = (c, x, y, w, h) => c.getContext('2d').getImageData(x, y, w, h).data;
  // The symbol sits where the mockup's does...
  assert.notDeepEqual(
    region(canvas, cx - 10, symbolY - 10, 20, 20),
    region(noSymbol, cx - 10, symbolY - 10, 20, 20),
  );
  // ...and the art, not a text box, fills the space down to the footer.
  const [r, g, b] = region(canvas, BOX.x + 30, TEXT.y + TEXT.h - 10, 1, 1);
  assert.ok(r > 40 && g < 20 && b < 20, `expected darkened red art, got ${[r, g, b]}`);
});
