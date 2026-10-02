import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createSetSymbolFetcher } from '../../src/art/set-symbols.js';

const quiet = { warn() {} };

async function tempDir(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'fannable-sets-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

function fakeScryfall(sets) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    if (url === 'https://api.scryfall.com/sets') {
      return Response.json({
        data: Object.entries(sets).map(([code, icon]) => ({
          code,
          icon_svg_uri: `https://svgs.example.test/sets/${icon}.svg?123`,
        })),
      });
    }
    return new Response(`<svg>${path.basename(new URL(url).pathname)}</svg>`);
  };
  return { fetch, calls };
}

test('set symbols are looked up by code, downloaded once and cached', async (t) => {
  const dir = await tempDir(t);
  const scryfall = fakeScryfall({ m10: 'm10', pm10: 'm10' });
  const fetcher = createSetSymbolFetcher({ dir, fetch: scryfall.fetch, log: quiet });
  assert.equal(String(await fetcher.fetchSetSymbol('M10')), '<svg>m10.svg</svg>');
  assert.equal(
    String(await fetcher.fetchSetSymbol('pm10')),
    '<svg>m10.svg</svg>',
    'promo shares its icon',
  );
  assert.equal(scryfall.calls.length, 2, 'set list once, icon once');

  // A new fetcher reads the cached list and icon from disk.
  const again = createSetSymbolFetcher({ dir, fetch: scryfall.fetch, log: quiet });
  await again.fetchSetSymbol('m10');
  assert.equal(scryfall.calls.length, 2);
});

test('an unknown code refreshes the set list at most once a day', async (t) => {
  const dir = await tempDir(t);
  let clock = 0;
  const scryfall = fakeScryfall({ m10: 'm10' });
  const fetcher = createSetSymbolFetcher({
    dir,
    fetch: scryfall.fetch,
    now: () => clock,
    log: quiet,
  });
  await fetcher.fetchSetSymbol('m10');
  assert.equal(await fetcher.fetchSetSymbol('new'), null);
  assert.equal(scryfall.calls.length, 2, 'no refresh within the day');
  clock += 86_400_001;
  assert.equal(await fetcher.fetchSetSymbol('new'), null);
  assert.equal(scryfall.calls.length, 3, 'refreshed after a day');
});

test('failures return null so the renderer shows the set code', async (t) => {
  const dir = await tempDir(t);
  const fetch = async () => {
    throw new Error('offline');
  };
  const fetcher = createSetSymbolFetcher({ dir, fetch, log: quiet });
  assert.equal(await fetcher.fetchSetSymbol('m10'), null);
});
