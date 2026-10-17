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
 *
 * Power/toughness modifiers such as +3/+1 stay as text, in standard Magic
 * formatting (T-S4, C17; they were once drawn with a sword and shield).
 *
 * Planeswalker lines are split into a loyalty cost and the ability (7.2.1);
 * static abilities get a null cost (7.2.4). ±X costs are kept as written (D22).
 *
 * Reminder text can be left out (6.4.9, D37, T-C3): everything in parentheses
 * goes, with the spaces around it tidied, and a line left empty is dropped.
 */

const SYMBOL = /\{([^}]+)\}/g;
const LOYALTY_COST = /^([+−-](?:\d+|X)|0):\s*/;

/**
 * @typedef {{ type: 'text', text: string, italic: boolean }
 *   | { type: 'symbol', symbol: string }} TextToken
 * @typedef {{ kind: 'rules' | 'flavor', cost: string | null, tokens: TextToken[] }} Paragraph
 */

/**
 * @typedef {object} TextOptions Which optional text to show (6.4.9, D37).
 * @property {boolean} [reminder] Reminder text; shown by default.
 */

/**
 * Tokenizes one paragraph.
 * @param {string} text
 * @param {{ flavor?: boolean, reminder?: boolean }} [options] `reminder: false`
 *   leaves out everything in parentheses.
 * @returns {TextToken[]}
 */
export function tokenizeLine(text, { flavor = false, reminder = true } = {}) {
  const tokens = [];
  let depth = 0;
  const hide = () => !reminder && !flavor && depth > 0;

  const pushText = (run) => {
    // Split the run where reminder text opens and closes, so italics are exact.
    for (const part of run.split(/(\(|\))/)) {
      if (!part) continue;
      if (part === '(') depth += 1;
      const italic = flavor || depth > 0;
      const hidden = hide();
      if (part === ')') depth = Math.max(0, depth - 1);
      if (hidden) continue;
      const last = tokens.at(-1);
      if (last?.type === 'text' && last.italic === italic) last.text += part;
      else tokens.push({ type: 'text', text: part, italic });
    }
  };

  let index = 0;
  for (const match of text.matchAll(SYMBOL)) {
    pushText(text.slice(index, match.index));
    if (!hide()) tokens.push({ type: 'symbol', symbol: match[1] });
    index = match.index + match[0].length;
  }
  pushText(text.slice(index));
  return reminder || flavor ? tokens : tidySpaces(tokens);
}

/** Tidies the spaces left where reminder text was: "Flying (…)" is just "Flying". */
function tidySpaces(tokens) {
  return tokens
    .map((t, i) => {
      if (t.type !== 'text') return t;
      let text = t.text.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1');
      if (i === 0) text = text.trimStart();
      if (i === tokens.length - 1) text = text.trimEnd();
      return { ...t, text };
    })
    .filter((t) => t.type === 'symbol' || t.text);
}

/**
 * Tokenizes a card model's rules and flavour text.
 * @param {import('../model/card-model.js').CardModel} model
 * @param {TextOptions} [options]
 * @returns {Paragraph[]} Rules paragraphs (one per Oracle line), then flavour text.
 */
export function tokenizeCard(model, { reminder = true } = {}) {
  const planeswalker = model.types.includes('Planeswalker');
  const paragraphs = [];
  for (const line of model.oracleText ? model.oracleText.split('\n') : []) {
    const cost = planeswalker ? LOYALTY_COST.exec(line) : null;
    const tokens = tokenizeLine(cost ? line.slice(cost[0].length) : line, { reminder });
    // A line that was only reminder text goes; an ability keeps its cost.
    if (!tokens.length && !cost) continue;
    paragraphs.push({ kind: 'rules', cost: cost ? cost[1].replace('-', '−') : null, tokens });
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
