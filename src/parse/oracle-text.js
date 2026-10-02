/**
 * Oracle text tokenizer (T-A7, Requirements 6.4, 7.2).
 *
 * Splits a card's rules and flavour text into paragraphs of tokens the text
 * box can draw:
 *
 * - `{ type: 'text', text, italic }`: a run of text. Reminder text (anything in
 *   parentheses, 6.4.2) and flavour text (6.4.1) are italic.
 * - `{ type: 'symbol', symbol }`: an inline symbol such as `{T}` or `{2}`, one
 *   per symbol as printed, never grouped (D11, 6.4.6). Codes are kept as
 *   written (`'T'`, `'2'`, `'G/U/P'`, `'CHAOS'`), so the renderer can fall back
 *   to the text code for symbols without an icon (6.4.7).
 * - `{ type: 'pt', power, toughness }`: a numeric power/toughness modifier
 *   such as +2/+2 or -5/-5, drawn with the sword and shield (D20, 6.4.5).
 *   Counters ("a +1/+1 counter"), X modifiers and plain stats ("a 1/1 token")
 *   stay as text, and flavour text is never converted.
 *
 * Planeswalker lines are split into a loyalty cost and the ability (7.2.1);
 * static abilities get a null cost (7.2.4). ±X costs are kept as written (D22).
 */

const SYMBOL = /\{([^}]+)\}/g;
// +N/+N, -N/-N or mixed signs; Scryfall writes minus as "-" in rules text.
const PT = /(?<![\w/+\-−])([+\-−]\d+)\/([+\-−]\d+)(?![\w/])/g;
const COUNTER_AFTER = /^\s+counters?\b/;
const LOYALTY_COST = /^([+−-](?:\d+|X)|0):\s*/;

/**
 * @typedef {{ type: 'text', text: string, italic: boolean }
 *   | { type: 'symbol', symbol: string }
 *   | { type: 'pt', power: string, toughness: string }} TextToken
 * @typedef {{ kind: 'rules' | 'flavor', cost: string | null, tokens: TextToken[] }} Paragraph
 */

/**
 * Tokenizes one paragraph.
 * @param {string} text
 * @param {{ flavor?: boolean }} [options]
 * @returns {TextToken[]}
 */
export function tokenizeLine(text, { flavor = false } = {}) {
  const tokens = [];
  let depth = 0;

  const pushText = (run) => {
    // Split the run where reminder text opens and closes, so italics are exact.
    for (const part of run.split(/(\(|\))/)) {
      if (!part) continue;
      if (part === '(') depth += 1;
      const italic = flavor || depth > 0;
      if (part === ')') depth = Math.max(0, depth - 1);
      const last = tokens.at(-1);
      if (last?.type === 'text' && last.italic === italic) last.text += part;
      else tokens.push({ type: 'text', text: part, italic });
    }
  };

  // Symbols first, then P/T modifiers inside the text between them.
  let index = 0;
  for (const match of text.matchAll(SYMBOL)) {
    pushRuns(text.slice(index, match.index));
    tokens.push({ type: 'symbol', symbol: match[1] });
    index = match.index + match[0].length;
  }
  pushRuns(text.slice(index));
  return tokens;

  function pushRuns(run) {
    if (flavor) return run && pushText(run);
    let at = 0;
    for (const match of run.matchAll(PT)) {
      const after = run.slice(match.index + match[0].length);
      if (COUNTER_AFTER.test(after)) continue;
      if (match.index > at) pushText(run.slice(at, match.index));
      tokens.push({ type: 'pt', power: match[1], toughness: match[2] });
      at = match.index + match[0].length;
    }
    if (at < run.length) pushText(run.slice(at));
  }
}

/**
 * Tokenizes a card model's rules and flavour text.
 * @param {import('../model/card-model.js').CardModel} model
 * @returns {Paragraph[]} Rules paragraphs (one per Oracle line), then flavour text.
 */
export function tokenizeCard(model) {
  const planeswalker = model.types.includes('Planeswalker');
  const paragraphs = [];
  for (const line of model.oracleText ? model.oracleText.split('\n') : []) {
    const cost = planeswalker ? LOYALTY_COST.exec(line) : null;
    paragraphs.push({
      kind: 'rules',
      cost: cost ? cost[1].replace('-', '−') : null,
      tokens: tokenizeLine(cost ? line.slice(cost[0].length) : line),
    });
  }
  if (model.flavorText) {
    paragraphs.push({
      kind: 'flavor',
      cost: null,
      tokens: tokenizeLine(model.flavorText, { flavor: true }),
    });
  }
  return paragraphs;
}
