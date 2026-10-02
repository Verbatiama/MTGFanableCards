/**
 * Decklist parser (T-A4, Requirements 3.2.2–3.2.3, 3.3.3).
 *
 * Accepts the common export formats (Arena, MTGO, Moxfield and similar):
 *
 *   4 Lightning Bolt
 *   4x Lightning Bolt
 *   Lightning Bolt                  (quantity 1)
 *   4 Lightning Bolt (M10) 146      (set code and collector number)
 *   4 Lightning Bolt (M10)          (set code only)
 *   4 Lightning Bolt [M10]
 *   1 Sol Ring (C21) 263 *F*        (foil and etched markers are ignored)
 *
 * Blank lines, comments (`//` or `#`) and section headers (Deck, Sideboard,
 * Commander, ...) are skipped. Cards in every section are kept; the section is
 * recorded on each entry.
 */

const SECTIONS = new Set([
  'deck',
  'main',
  'mainboard',
  'main deck',
  'sideboard',
  'side',
  'commander',
  'companion',
  'maybeboard',
  'considering',
  'about',
]);

const QUANTITY = /^(\d+)\s*x?\s+(.+)$/i;
const MARKERS = /(\s+\*[a-z]+\*)+$/i;
const PRINTING = /^(.*?)\s+[([]([a-z0-9]{2,6})[)\]](?:\s+(\S+))?$/i;

/**
 * @typedef {object} DecklistEntry
 * @property {number} lineNumber 1-based line in the input.
 * @property {string} line The line as written (trimmed).
 * @property {number} quantity
 * @property {string} name Card name as written.
 * @property {string | null} set Set code, lower case, if given.
 * @property {string | null} number Collector number, if given.
 * @property {string | null} section The last section header seen, lower case.
 */

/**
 * @param {string} text
 * @returns {{ entries: DecklistEntry[], errors: { lineNumber: number, line: string, error: string }[] }}
 */
export function parseDecklist(text) {
  const entries = [];
  const errors = [];
  let section = null;

  text.split(/\r?\n/).forEach((raw, index) => {
    const lineNumber = index + 1;
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) return;

    const header = line.replace(/:$/, '').toLowerCase();
    if (SECTIONS.has(header)) {
      section = header;
      return;
    }

    let rest = line.replace(MARKERS, '');
    let quantity = 1;
    const q = QUANTITY.exec(rest);
    if (q) {
      quantity = Number(q[1]);
      rest = q[2];
    }
    if (quantity < 1) {
      errors.push({ lineNumber, line, error: 'Quantity must be at least 1' });
      return;
    }

    let set = null;
    let number = null;
    const p = PRINTING.exec(rest);
    if (p) {
      [, rest, set, number = null] = p;
      set = set.toLowerCase();
    }
    const name = rest.trim();
    if (!name) {
      errors.push({ lineNumber, line, error: 'No card name' });
      return;
    }
    entries.push({ lineNumber, line, quantity, name, set, number, section });
  });

  return { entries, errors };
}
