import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CardDatabase } from '../../src/data/card-database.js';
import { createCardStore } from '../../src/data/card-store.js';
import { downloadBulkData } from '../../src/data/scryfall-bulk.js';
import { fakeScryfall, jsonlGz, quietLog, scryfallCard } from './helpers.js';

const bolt = scryfallCard({ name: 'Lightning Bolt' });
const shock = scryfallCard({ name: 'Shock' });
const files = (cards) => ({ default_cards: jsonlGz(cards), unique_artwork: jsonlGz(cards) });

/** Waits until `condition` holds. */
async function until(condition) {
  while (!condition()) await new Promise((resolve) => setTimeout(resolve, 1));
}

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

test('low-memory mode uses only Default Cards and drops the old data during a refresh (T-S13)', async (t) => {
  const dir = await tempDir(t);
  const versions = { default_cards: 'v1', unique_artwork: 'v1' };
  const data = files([bolt]);
  const scryfall = fakeScryfall({ versions, files: data });
  const store = createCardStore({
    dir,
    fetch: scryfall.fetch,
    refreshHours: 0,
    lowMemory: true,
    log: quietLog,
  });
  await store.ready;
  assert.deepEqual(await readdir(dir), ['bulk-meta.json', 'default-cards.jsonl.gz']);
  assert.equal(await store.loaded(), store.db);

  // Hold the new load open, so the gap with no database can be checked.
  const fromFiles = CardDatabase.fromFiles;
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const load = t.mock.method(CardDatabase, 'fromFiles', async (...args) => {
    await gate;
    return fromFiles(...args);
  });

  Object.assign(versions, { default_cards: 'v2' });
  Object.assign(data, files([bolt, shock]));
  const refreshing = store.refresh();
  await until(() => load.mock.callCount() === 1);
  assert.equal(store.db, null, 'the old database is dropped before the new one loads');
  const loaded = store.loaded();
  release();
  await refreshing;
  assert.equal((await loaded).lookup('Shock')?.name, 'Shock');
  assert.equal(await loaded, store.db);
});
