import { gzipSync } from 'node:zlib';

/** A minimal Scryfall card object; `fields` override the defaults. */
export function scryfallCard(fields) {
  return {
    object: 'card',
    id: `${fields.name}-${fields.set ?? 'tst'}-${fields.collector_number ?? '1'}`,
    oracle_id: `oracle-${fields.name}`,
    lang: 'en',
    layout: 'normal',
    released_at: '2020-01-01',
    set: 'tst',
    collector_number: '1',
    rarity: 'common',
    type_line: 'Instant',
    oracle_text: '',
    colors: [],
    image_uris: {
      normal: 'https://example.test/normal.jpg',
      art_crop: 'https://example.test/art.jpg',
    },
    ...fields,
  };
}

/** Cards as a gzipped JSON Lines buffer, the format Scryfall publishes. */
export function jsonlGz(cards) {
  return gzipSync(cards.map((c) => JSON.stringify(c)).join('\n') + '\n');
}

/**
 * A fake `fetch` serving a Scryfall bulk index and its files. `versions` maps
 * each bulk type to its `updated_at`; every request is recorded in `calls`.
 */
export function fakeScryfall({ versions, files, fail = false }) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    if (fail) throw new Error('network down');
    if (url === 'https://api.scryfall.com/bulk-data') {
      const data = Object.entries(versions).map(([type, updated_at]) => ({
        type,
        updated_at,
        jsonl_download_uri: `https://data.example.test/${type}.jsonl.gz`,
      }));
      return Response.json({ data });
    }
    const type = url.match(/\/(\w+)\.jsonl\.gz$/)?.[1];
    if (files[type]) return new Response(files[type]);
    return new Response('missing', { status: 404 });
  };
  return { fetch, calls };
}

export const quietLog = { info() {}, warn() {}, error() {} };
