import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { isLowMemory } from '../low-memory.js';

/**
 * In-memory index of Scryfall card data (T-A3, Requirements 3.2.4–3.2.5, 3.3).
 *
 * Only English printings are kept (D24), and only the fields later stages
 * need, so the ~100k printings fit comfortably in memory. Names match
 * case-insensitively (T-S2): the full name ("Delver of Secrets // Insectile
 * Aberration") or either face name.
 */

/** Layouts that aren't playable cards; tokens are out of scope for v1 (D15). */
const SKIPPED_LAYOUTS = new Set(['token', 'double_faced_token', 'emblem', 'art_series']);

const CARD_FIELDS = [
  'id',
  'oracle_id',
  'name',
  'lang',
  'released_at',
  'layout',
  'mana_cost',
  'type_line',
  'oracle_text',
  'flavor_text',
  'power',
  'toughness',
  'loyalty',
  'defense',
  'colors',
  'color_indicator',
  'keywords',
  'watermark',
  'artist',
  'illustration_id',
  'collector_number',
  'rarity',
  'set',
  'set_name',
  'set_type',
  'digital',
  'promo',
  'oversized',
  'frame',
  'frame_effects',
  'border_color',
];
const FACE_FIELDS = [
  'name',
  'mana_cost',
  'type_line',
  'oracle_text',
  'flavor_text',
  'power',
  'toughness',
  'loyalty',
  'defense',
  'colors',
  'color_indicator',
  'watermark',
  'artist',
  'illustration_id',
];

/**
 * Normalises a card name for matching (3.2.4): case, curly apostrophes and
 * quotes, repeated spaces, and spacing around "//" are ignored.
 */
export function normalizeName(name) {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s*\/\/\s*/g, ' // ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(source, fields) {
  const out = {};
  for (const key of fields) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

/** The fields kept for one printing, with only the art crop of each image. */
export function slimCard(card) {
  const slim = pick(card, CARD_FIELDS);
  if (card.image_uris?.art_crop) slim.art_crop = card.image_uris.art_crop;
  if (card.card_faces) {
    slim.card_faces = card.card_faces.map((face) => {
      const f = pick(face, FACE_FIELDS);
      if (face.image_uris?.art_crop) f.art_crop = face.image_uris.art_crop;
      return f;
    });
  }
  return slim;
}

// Different on (almost) every printing, so not worth sharing.
const UNSHARED_FIELDS = new Set(['id', 'art_crop', 'illustration_id']);

/**
 * Low-memory mode (T-S13): returns a function that makes a slim card share
 * one copy of each repeated string and array (rules text, type lines, set
 * names, artists, colours, keywords) with every card it saw before. JSON.parse
 * gives every printing its own copies. Shared arrays are frozen.
 */
function createSharer() {
  const strings = new Map();
  const arrays = new Map();
  const value = (v) => {
    if (typeof v === 'string') {
      const shared = strings.get(v);
      if (shared !== undefined) return shared;
      strings.set(v, v);
      return v;
    }
    if (Array.isArray(v)) {
      const key = JSON.stringify(v);
      let shared = arrays.get(key);
      if (!shared) arrays.set(key, (shared = Object.freeze(v.map(value))));
      return shared;
    }
    return v;
  };
  const share = (object) => {
    for (const [key, v] of Object.entries(object)) {
      if (key === 'card_faces') v.forEach(share);
      else if (!UNSHARED_FIELDS.has(key)) object[key] = value(v);
    }
    return object;
  };
  return share;
}

function keep(card) {
  return card.object === 'card' && card.lang === 'en' && !SKIPPED_LAYOUTS.has(card.layout);
}

/** Yields each card object in a gzipped JSON Lines file. */
async function* readJsonLines(file) {
  const lines = createInterface({
    input: createReadStream(file).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (line.trim()) yield JSON.parse(line);
  }
}

// Collector numbers compare numerically ("9" before "10"), letters after ("10a").
const byRelease = (a, b) =>
  a.released_at.localeCompare(b.released_at) ||
  a.collector_number.localeCompare(b.collector_number, 'en', { numeric: true });

export class CardDatabase {
  /** @type {Map<string, { name: string, printings: object[] }>} full name → card */
  #cards = new Map();
  /** @type {Map<string, string>} face name → full-name key */
  #faces = new Map();
  /** @type {Map<string, object[]>} oracle id → one printing per distinct artwork */
  #artworks = new Map();

  /**
   * @param {Iterable<object> | AsyncIterable<object>} defaultCards Scryfall card objects.
   * @param {Iterable<object> | AsyncIterable<object>} [uniqueArtwork]
   * @param {{ share?: boolean }} [options] `share`: share repeated strings and
   *   arrays between cards (low-memory mode, T-S13); on with LOW_MEMORY.
   */
  static async build(defaultCards, uniqueArtwork = [], { share = isLowMemory() } = {}) {
    const db = new CardDatabase();
    const shareFields = share ? createSharer() : (card) => card;
    const slim = (card) => shareFields(slimCard(card));
    for await (const card of defaultCards) if (keep(card)) db.#add(slim(card));
    for await (const card of uniqueArtwork) {
      if (!keep(card)) continue;
      const list = db.#artworks.get(card.oracle_id) ?? [];
      list.push(slim(card));
      db.#artworks.set(card.oracle_id, list);
    }
    for (const entry of db.#cards.values()) entry.printings.sort(byRelease);
    for (const list of db.#artworks.values()) list.sort(byRelease);
    return db;
  }

  /**
   * Loads the bulk files written by `downloadBulkData`. Without
   * `uniqueArtwork` (low-memory mode), `artworks()` finds nothing.
   * @param {{ defaultCards: string, uniqueArtwork?: string }} files
   * @param {{ share?: boolean }} [options] As for `build`.
   */
  static async fromFiles({ defaultCards, uniqueArtwork }, options) {
    return CardDatabase.build(
      readJsonLines(defaultCards),
      uniqueArtwork ? readJsonLines(uniqueArtwork) : [],
      options,
    );
  }

  #add(card) {
    const key = normalizeName(card.name);
    let entry = this.#cards.get(key);
    if (!entry) {
      entry = { name: card.name, printings: [] };
      this.#cards.set(key, entry);
    }
    entry.printings.push(card);
    for (const face of card.card_faces ?? []) {
      const faceKey = normalizeName(face.name);
      if (faceKey !== key && !this.#faces.has(faceKey)) this.#faces.set(faceKey, key);
    }
  }

  /** Number of distinct card names. */
  get size() {
    return this.#cards.size;
  }

  /**
   * Finds a card by full name or face name (3.2.4–3.2.5). A card whose full
   * name matches wins over another card's face of the same name.
   * @returns {{ name: string, printings: object[] } | null} Printings oldest first.
   */
  lookup(name) {
    const key = normalizeName(name);
    return this.#cards.get(key) ?? this.#cards.get(this.#faces.get(key)) ?? null;
  }

  /** One printing per distinct artwork of a card, oldest first (D2). */
  artworks(name) {
    const card = this.lookup(name);
    return card ? (this.#artworks.get(card.printings[0].oracle_id) ?? []) : [];
  }

  /**
   * Up to `limit` close card names for an unmatched name (3.2.4), closest
   * first. Only names within a small edit distance are suggested.
   */
  suggest(name, limit = 3) {
    const query = normalizeName(name);
    const maxDistance = Math.max(2, Math.floor(query.length / 4));
    const found = [];
    for (const [key, entry] of this.#cards) {
      if (Math.abs(key.length - query.length) > maxDistance) continue;
      const distance = editDistance(query, key, maxDistance);
      if (distance <= maxDistance) found.push({ name: entry.name, distance });
    }
    return found
      .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((s) => s.name);
  }
}

/** Levenshtein distance, giving up (returning max + 1) once it exceeds `max`. */
function editDistance(a, b, max) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}
