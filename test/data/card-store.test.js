import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCardStore } from '../../src/data/card-store.js';
import { downloadBulkData } from '../../src/data/scryfall-bulk.js';
import { fakeScryfall, jsonlGz, quietLog, scryfallCard } from './helpers.js';

const bolt = scryfallCard({ name: 'Lightning Bolt' });
const shock = scryfallCard({ name: 'Shock' });
const files = (cards) => ({ default_cards: jsonlGz(cards), unique_artwork: jsonlGz(cards) });

async function tempDir(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'fannable-data-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('downloads each bulk file once and skips it while it is up to date', async (t) => {
  const dir = await tempDir(t);
  const versions = { default_cards: 'v1', unique_artwork: 'v1' };
  const scryfall = fakeScryfall({ versions, files: files([bolt]) });

  assert.deepEqual((await downloadBulkData({ dir, fetch: scryfall.fetch })).updated, [
    'default_cards',
    'unique_artwork',
  ]);
  assert.deepEqual((await downloadBulkData({ dir, fetch: scryfall.fetch })).updated, []);
  assert.equal(scryfall.calls.length, 4); // index, two files, index again
  const meta = JSON.parse(await readFile(path.join(dir, 'bulk-meta.json'), 'utf8'));
  assert.deepEqual(meta, versions);
});

test('a failed download leaves no partial file behind', async (t) => {
  const dir = await tempDir(t);
  const scryfall = fakeScryfall({
    versions: { default_cards: 'v1', unique_artwork: 'v1' },
    files: { default_cards: jsonlGz([bolt]) },
  });
  await assert.rejects(downloadBulkData({ dir, fetch: scryfall.fetch }), /unique_artwork/);
  assert.deepEqual((await readdir(dir)).sort(), ['bulk-meta.json', 'default-cards.jsonl.gz']);
});

test('refresh swaps in newer data without a restart (D30)', async (t) => {
  const dir = await tempDir(t);
  const versions = { default_cards: 'v1', unique_artwork: 'v1' };
  const data = files([bolt]);
  const scryfall = fakeScryfall({ versions, files: data });
  const store = createCardStore({ dir, fetch: scryfall.fetch, refreshHours: 0, log: quietLog });
  await store.ready;
  const first = store.db;
  assert.equal(first.lookup('Shock'), null);

  Object.assign(versions, { default_cards: 'v2' });
  Object.assign(data, files([bolt, shock]));
  assert.deepEqual((await store.refresh()).updated, ['default_cards']);
  assert.notEqual(store.db, first);
  assert.equal(store.db.lookup('Shock')?.name, 'Shock');
  assert.equal(first.lookup('Shock'), null, 'the old database is left untouched');
});

test('uses the files on disk when Scryfall cannot be reached', async (t) => {
  const dir = await tempDir(t);
  const versions = { default_cards: 'v1', unique_artwork: 'v1' };
  await downloadBulkData({ dir, fetch: fakeScryfall({ versions, files: files([bolt]) }).fetch });

  const offline = fakeScryfall({ versions, files: {}, fail: true });
  const store = createCardStore({ dir, fetch: offline.fetch, refreshHours: 0, log: quietLog });
  await store.ready;
  assert.equal(store.db.lookup('Lightning Bolt')?.name, 'Lightning Bolt');
});

test('fails when there is no data on disk and Scryfall cannot be reached', async (t) => {
  const dir = await tempDir(t);
  const offline = fakeScryfall({ versions: {}, files: {}, fail: true });
  const store = createCardStore({ dir, fetch: offline.fetch, refreshHours: 0, log: quietLog });
  await assert.rejects(store.ready, /network down/);
});
