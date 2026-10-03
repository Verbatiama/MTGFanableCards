import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from 'canvas';
import { BOX, TEXT, TEXT_SIZE } from '../../src/config/layout.js';
import { tokenizeCard, tokenizeLine } from '../../src/parse/oracle-text.js';
import { registerFonts, renderCardCanvas } from '../../src/render/node.js';
import { fitText, layoutText } from '../../src/render/text-box.js';
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

test('a P/T modifier and the punctuation after it wrap together (6.4.5)', () => {
  const paragraph = rules('Enchanted creature gets +2/+2.');
  const full = layoutText(ctx, [paragraph], 600, 26);
  assert.equal(lineText(full.lines[0]), 'Enchanted creature gets +2 [power] +2 [toughness].');
  // Too narrow for the whole modifier after "gets": it moves to the next line as one.
  const words = ctx.measureText('Enchanted creature gets ').width;
  const { lines } = layoutText(ctx, [paragraph], words + 30, 26);
  assert.equal(lineText(lines.at(-1)), '+2 [power] +2 [toughness].');
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
  const region = (canvas) =>
    canvas.getContext('2d').getImageData(BOX.x + 20, TEXT.y + 14, 400, 60).data;
  assert.notDeepEqual(region(drawn), region(empty));
});
