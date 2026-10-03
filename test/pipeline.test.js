import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { CardDatabase } from '../src/data/card-database.js';
import { generateCards } from '../src/generate.js';
import { mapCard } from '../src/model/from-scryfall.js';
import { zipImages } from '../src/output/index.js';
import { renderCardPng } from '../src/render/node.js';
import { fixtureSlug, loadCardFixtures } from './fixtures/cards.js';
import { offline } from './data/deck.js';

/**
 * The whole pipeline, end to end (T-S3): real Scryfall printings → card
 * database → decklist → printing selection → card models → renderer → zip.
 * Every image must be identical to rendering the hand-written fixture of that
 * face, so the pipeline adds nothing and loses nothing between the stages.
 */

const PRINTINGS = JSON.parse(
  readFileSync(new URL('fixtures/scryfall/printings.json', import.meta.url), 'utf8'),
);

test('a decklist of every fixture printing renders exactly like the fixtures (T-S3)', async () => {
  const fixtures = loadCardFixtures();
  // Stored printings are already slim; mark them as cards so the database keeps them.
  const db = await CardDatabase.build(PRINTINGS.map((p) => ({ object: 'card', ...p })));
  const decklist = PRINTINGS.map(
    (p) => `1 ${p.name} (${p.set.toUpperCase()}) ${p.collector_number}`,
  ).join('\n');

  const { images, report } = await generateCards(db, decklist, offline);
  assert.deepEqual(
    [report.errors, report.unmatched, report.fallbacks, report.skipped],
    [[], [], [], []],
  );

  const faces = PRINTINGS.flatMap((p) => mapCard(p).map((m) => m.name));
  assert.equal(images.length, faces.length);
  let compared = 0;
  for (const [i, name] of faces.entries()) {
    const fixture = fixtures.get(fixtureSlug(name));
    if (!fixture) continue;
    assert.ok(
      images[i].png.equals(await renderCardPng(fixture)),
      `${name} differs from its fixture`,
    );
    compared += 1;
  }
  assert.equal(compared, fixtures.size, 'every fixture comes out of the pipeline');

  const zip = unzipSync(zipImages(images));
  assert.deepEqual(
    Object.keys(zip),
    images.map((i) => i.fileName),
  );
});
