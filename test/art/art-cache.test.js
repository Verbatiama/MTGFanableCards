import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { cacheFileName, createArtFetcher } from '../../src/art/art-cache.js';

const quiet = { warn() {} };
const art = (id, face = 'front') => `https://cards.scryfall.io/art_crop/${face}/a/b/${id}.jpg?123`;

async function tempDir(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'fannable-art-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/** A fake fetch returning `size` bytes per image; records request start times. */
function fakeFetch({ size = 10, fail = new Set() } = {}) {
  const calls = [];
  const fetch = async (url) => {
    calls.push({ url, at: performance.now() });
    if (fail.has(url)) return new Response('nope', { status: 404 });
    return new Response(Buffer.alloc(size, 1));
  };
  return { fetch, calls };
}

test('cache file names keep the face and Scryfall file name', () => {
  assert.equal(cacheFileName(art('abc')), 'front-abc.jpg');
  assert.equal(cacheFileName(art('abc', 'back')), 'back-abc.jpg');
  assert.throws(() => cacheFileName('https://example.test/x.jpg'), /Unexpected Scryfall art URL/);
});

test('art is downloaded once, then served from the cache', async (t) => {
  const dir = await tempDir(t);
  const { fetch, calls } = fakeFetch();
  const fetcher = createArtFetcher({ dir, fetch, spacingMs: 0, log: quiet });
  assert.equal((await fetcher.fetchArt(art('a'))).length, 10);
  assert.equal((await fetcher.fetchArt(art('a'))).length, 10);
  assert.equal(calls.length, 1);
  assert.deepEqual(fetcher.stats, { cached: 1, downloaded: 1, failed: 0, evicted: 0 });
});

test('simultaneous requests for the same art share one download', async (t) => {
  const dir = await tempDir(t);
  const { fetch, calls } = fakeFetch();
  const fetcher = createArtFetcher({ dir, fetch, spacingMs: 0, log: quiet });
  await Promise.all([fetcher.fetchArt(art('a')), fetcher.fetchArt(art('a'))]);
  assert.equal(calls.length, 1);
  await fetcher.flush();
  const index = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8'));
  assert.equal(index['front-a.jpg'].uses, 2);
});

test('network requests start at least 100ms apart (D10)', async (t) => {
  const dir = await tempDir(t);
  const { fetch, calls } = fakeFetch();
  const fetcher = createArtFetcher({ dir, fetch, log: quiet });
  await Promise.all(['a', 'b', 'c'].map((id) => fetcher.fetchArt(art(id))));
  for (let i = 1; i < calls.length; i++) {
    assert.ok(calls[i].at - calls[i - 1].at >= 99, `gap ${calls[i].at - calls[i - 1].at}ms`);
  }
});

test('missing or failed art returns null for the placeholder (3.4.1)', async (t) => {
  const dir = await tempDir(t);
  const { fetch } = fakeFetch({ fail: new Set([art('gone')]) });
  const fetcher = createArtFetcher({ dir, fetch, spacingMs: 0, log: quiet });
  assert.equal(await fetcher.fetchArt(null), null);
  assert.equal(await fetcher.fetchArt(art('gone')), null);
  assert.equal(await fetcher.fetchArt('https://example.test/not-scryfall.jpg'), null);
  assert.equal(fetcher.stats.failed, 2);
});

test('at the cap, the least-used 25% is deleted, least recent first among ties (D29)', async (t) => {
  const dir = await tempDir(t);
  const { fetch } = fakeFetch({ size: 10 });
  let clock = 0;
  const fetcher = createArtFetcher({
    dir,
    fetch,
    spacingMs: 0,
    maxBytes: 80,
    now: () => ++clock,
    log: quiet,
  });
  // Eight images fill the cache exactly; a, b and c are used again.
  for (const id of 'abcdefgh') await fetcher.fetchArt(art(id));
  for (const id of 'abc') await fetcher.fetchArt(art(id));
  // The ninth goes over the cap: 9 × 25% → the 3 least used (d, e, f: used once,
  // oldest) are deleted.
  await fetcher.fetchArt(art('i'));
  const left = 'abcdefghi'.split('').filter((id) => existsSync(path.join(dir, `front-${id}.jpg`)));
  assert.deepEqual(left, ['a', 'b', 'c', 'g', 'h', 'i']);
  assert.equal(fetcher.stats.evicted, 3);
});

test('the usage index survives a restart, and files it never saw are picked up', async (t) => {
  const dir = await tempDir(t);
  const { fetch, calls } = fakeFetch();
  const first = createArtFetcher({ dir, fetch, spacingMs: 0, log: quiet });
  await first.fetchArt(art('a'));
  await first.flush();
  await writeFile(path.join(dir, 'front-old.jpg'), Buffer.alloc(5));

  const second = createArtFetcher({ dir, fetch, spacingMs: 0, log: quiet });
  await second.fetchArt(art('a'));
  await second.fetchArt(art('old'));
  assert.equal(calls.length, 1, 'both served from disk');
  await second.flush();
  const index = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8'));
  assert.equal(index['front-a.jpg'].uses, 2);
  assert.deepEqual(
    { uses: index['front-old.jpg'].uses, size: index['front-old.jpg'].size },
    { uses: 1, size: 5 },
  );
});
