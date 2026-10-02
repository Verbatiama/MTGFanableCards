import { MANA_TAIL } from '../model/card-model.js';

/**
 * Mana cost parser (T-A5, D11, Requirements 5.3).
 *
 * Turns a Scryfall cost string into the grouped form the stat bar draws:
 * each distinct symbol once, with a count. Coloured, hybrid and Phyrexian
 * symbols keep the order they're printed in; then snow, colourless, X, Y, Z;
 * generic last, as the sum of the numeric symbols.
 *
 *   '{2}{U}{U}{R}{R}' → U 2, R 2, generic 2
 *   '{X}{X}{G}'       → G 1, X 2
 *   '{0}'             → generic 0
 *   ''                → null (no mana cost, e.g. lands)
 *
 * Multi-face cards have a combined top-level cost ('{4}{U} // {1}{U}'); each
 * face's own cost is parsed instead.
 *
 * @param {string | null | undefined} cost Scryfall `mana_cost`.
 * @returns {import('../model/card-model.js').ManaGroup[] | null}
 */
export function parseManaCost(cost) {
  if (!cost) return null;
  if (cost.includes('//')) {
    throw new Error(`Combined cost of a multi-face card, parse each face instead: ${cost}`);
  }
  const symbols = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1].toUpperCase());
  if (!symbols.length || symbols.join('').length + symbols.length * 2 !== cost.length) {
    throw new Error(`Not a mana cost: ${cost}`);
  }

  const printed = new Map();
  const tail = new Map();
  let generic = null;
  for (const symbol of symbols) {
    if (/^\d+$/.test(symbol)) {
      generic = (generic ?? 0) + Number(symbol);
    } else {
      const groups = MANA_TAIL.includes(symbol) ? tail : printed;
      groups.set(symbol, (groups.get(symbol) ?? 0) + 1);
    }
  }

  const grouped = [...printed].map(([symbol, count]) => ({ symbol, count }));
  for (const symbol of MANA_TAIL) {
    if (tail.has(symbol)) grouped.push({ symbol, count: tail.get(symbol) });
  }
  if (generic !== null) grouped.push({ symbol: 'generic', count: generic });
  return grouped;
}
