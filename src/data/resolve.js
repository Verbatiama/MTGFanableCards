import { parseDecklist } from '../parse/decklist.js';

/**
 * Turns a decklist into card printings (T-A4, Requirements 3.2.4–3.2.6, 3.3.3).
 *
 * Every line is matched by name (case-insensitive, either face of a
 * double-faced card). Lines that don't match are reported with suggestions and
 * don't stop the batch (3.2.6).
 */

/**
 * Printings that count for the default: paper printings that aren't promos,
 * oversized cards or gold-bordered memorabilia, so a card's default isn't a
 * prerelease promo or a digital-only version.
 */
function isRegularPrinting(p) {
  return !p.digital && !p.promo && !p.oversized && p.set_type !== 'memorabilia';
}

/**
 * Picks a printing (3.3.3): the one named by set code and collector number,
 * the first in the set if only a set is given, otherwise the card's first
 * regular printing. An unknown set or number falls back to the default with a
 * warning.
 *
 * @param {{ name: string, printings: object[] }} card Printings oldest first.
 * @param {{ set?: string | null, number?: string | null }} [wanted]
 * @returns {{ printing: object, warning: string | null }}
 */
export function selectPrinting(card, { set = null, number = null } = {}) {
  const fallback = card.printings.find(isRegularPrinting) ?? card.printings[0];
  if (!set) return { printing: fallback, warning: null };

  const inSet = card.printings.filter((p) => p.set === set);
  if (!inSet.length) {
    return {
      printing: fallback,
      warning: `${card.name} has no printing in set ${set.toUpperCase()}; using ${describe(fallback)}`,
    };
  }
  if (!number) return { printing: inSet[0], warning: null };

  const exact = inSet.find((p) => p.collector_number.toLowerCase() === number.toLowerCase());
  if (exact) return { printing: exact, warning: null };
  return {
    printing: inSet[0],
    warning: `${card.name} has no collector number ${number} in ${set.toUpperCase()}; using ${describe(inSet[0])}`,
  };
}

function describe(p) {
  return `${p.set.toUpperCase()} ${p.collector_number}`;
}

/**
 * @param {import('./card-database.js').CardDatabase} db
 * @param {string} text Decklist.
 * @returns {{
 *   cards: { lineNumber: number, line: string, quantity: number, section: string | null,
 *            name: string, printing: object, warning: string | null }[],
 *   unmatched: { lineNumber: number, line: string, name: string, suggestions: string[] }[],
 *   errors: { lineNumber: number, line: string, error: string }[],
 * }}
 */
export function resolveDecklist(db, text) {
  const { entries, errors } = parseDecklist(text);
  const cards = [];
  const unmatched = [];
  for (const entry of entries) {
    const card = db.lookup(entry.name);
    if (!card) {
      unmatched.push({
        lineNumber: entry.lineNumber,
        line: entry.line,
        name: entry.name,
        suggestions: db.suggest(entry.name),
      });
      continue;
    }
    const { printing, warning } = selectPrinting(card, entry);
    cards.push({
      lineNumber: entry.lineNumber,
      line: entry.line,
      quantity: entry.quantity,
      section: entry.section,
      name: card.name,
      printing,
      warning,
    });
  }
  return { cards, unmatched, errors };
}
