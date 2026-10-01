import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Hand-written card models (T-A2). See cards/README.md for what each one covers. */
export const CARD_FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cards');

/** The ten cards in the reference mockups, used for visual regression (T-S4). */
export const MOCKUP_FIXTURES = [
  'niv-mizzet-the-firemind',
  'damnation',
  'sword-of-fire-and-ice',
  'jace-the-mind-sculptor',
  'feral-invocation',
  'lightning-strike',
  'fiendslayer-paladin',
  'wurmcoil-engine',
  'forest',
  'wasteland',
];

/** File name for a card face: lower case, punctuation dropped, words joined by '-'. */
export function fixtureSlug(name) {
  return name
    .toLowerCase()
    .replace(/[',]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function loadCardFixture(slug) {
  return JSON.parse(readFileSync(path.join(CARD_FIXTURE_DIR, `${slug}.json`), 'utf8'));
}

/** @returns {Map<string, import('../../src/model/card-model.js').CardModel>} keyed by slug */
export function loadCardFixtures() {
  const slugs = readdirSync(CARD_FIXTURE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort();
  return new Map(slugs.map((slug) => [slug, loadCardFixture(slug)]));
}
