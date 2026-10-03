import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { buildApp } from '../src/server/app.js';
import { loadConfig } from '../src/server/config.js';
import { deckDatabase, offline } from './data/deck.js';

const db = await deckDatabase();

/** An app on the test database; `env` sets config variables, `services` overrides services. */
async function app({ env = {}, services = {} } = {}) {
  const instance = await buildApp({
    config: loadConfig({
      RATE_LIMIT_JOBS_PER_HOUR: '0',
      RATE_LIMIT_PREVIEW_PER_MINUTE: '0',
      ...env,
    }),
    services: () => ({ db, ready: Promise.resolve(), ...offline, ...services }),
    webDir: '/nonexistent',
  });
  return instance;
}

async function withApp(options, fn) {
  const instance = await app(options);
  try {
    return await fn(instance);
  } finally {
    await instance.close();
  }
}

const post = (a, body) => a.inject({ method: 'POST', url: '/api/jobs', payload: body });
const get = (a, url) => a.inject({ method: 'GET', url });

/** Polls a job until it has finished. */
async function finished(a, id) {
  for (;;) {
    const job = (await get(a, `/api/jobs/${id}`)).json();
    if (job.status === 'done' || job.status === 'failed') return job;
    await sleep(10);
  }
}

test('GET /api/health reports ok, and whether the card data has loaded', () =>
  withApp({}, async (a) => {
    const res = await get(a, '/api/health');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { status: 'ok', data: 'ready' });
  }));

test('a job renders the decklist into cards.zip, with progress and the unmatched report (3.6.1)', () =>
  withApp({}, async (a) => {
    const res = await post(a, { decklist: '2 Lightning Bolt\nDelver of Secrets\nLightnig Bolt' });
    assert.equal(res.statusCode, 202);
    const { id, status } = res.json();
    assert.equal(res.headers.location, `/api/jobs/${id}`);
    assert.ok(['queued', 'running'].includes(status));

    const job = await finished(a, id);
    assert.equal(job.status, 'done');
    assert.deepEqual([job.done, job.total], [4, 4]);
    assert.deepEqual(job.unmatched, [
      {
        lineNumber: 3,
        line: 'Lightnig Bolt',
        name: 'Lightnig Bolt',
        suggestions: ['Lightning Bolt'],
      },
    ]);
    assert.equal(job.downloadUrl, `/api/jobs/${id}/download`);
    assert.ok(Date.parse(job.expiresAt) > Date.now());

    const download = await get(a, job.downloadUrl);
    assert.equal(download.statusCode, 200);
    assert.equal(download.headers['content-type'], 'application/zip');
    assert.equal(download.headers['content-disposition'], 'attachment; filename="cards.zip"');
    assert.deepEqual(Object.keys(unzipSync(download.rawPayload)), [
      'Lightning-Bolt.png',
      'Lightning-Bolt-2.png',
      'Delver-of-Secrets.png',
      'Insectile-Aberration.png',
    ]);
  }));

test('format pdf gives cards.pdf (3.5.3)', () =>
  withApp({}, async (a) => {
    const job = await finished(
      a,
      (await post(a, { decklist: '10 Lightning Bolt', format: 'pdf' })).json().id,
    );
    const download = await get(a, job.downloadUrl);
    assert.equal(download.headers['content-type'], 'application/pdf');
    assert.equal((await PDFDocument.load(download.rawPayload)).getPageCount(), 2);
  }));

test('a job with nothing to render fails, with the report', () =>
  withApp({}, async (a) => {
    const job = await finished(
      a,
      (await post(a, { decklist: 'Not A Card\nFire // Ice' })).json().id,
    );
    assert.equal(job.status, 'failed');
    assert.equal(job.error, 'No cards were generated');
    assert.equal(job.unmatched.length, 1);
    assert.equal(job.skipped.length, 1);
    assert.equal(job.downloadUrl, null);
    assert.equal((await get(a, `/api/jobs/${job.id}/download`)).statusCode, 409);
  }));

test('requests are validated and limited (3.6.1)', () =>
  withApp({ env: { MAX_CARDS_PER_JOB: '5', MAX_BODY_KB: '1' } }, async (a) => {
    assert.equal((await post(a, {})).statusCode, 400);
    assert.equal((await post(a, { decklist: 'Lightning Bolt', format: 'png' })).statusCode, 400);
    assert.equal(
      (await post(a, { decklist: '// only a comment' })).json().message,
      'The decklist has no cards',
    );
    const tooMany = await post(a, { decklist: '4 Lightning Bolt\n2 Delver of Secrets' });
    assert.equal(tooMany.statusCode, 400);
    assert.match(tooMany.json().message, /6 cards; the limit is 5/);
    assert.equal((await post(a, { decklist: 'x'.repeat(2000) })).statusCode, 413);
    assert.equal((await get(a, '/api/jobs/not-a-uuid')).statusCode, 400);
    assert.equal((await get(a, `/api/jobs/${crypto.randomUUID()}`)).statusCode, 404);
    assert.equal((await get(a, '/nope')).statusCode, 404);
  }));

test('jobs beyond MAX_RUNNING_JOBS wait in a queue', async () => {
  let release;
  const ready = new Promise((resolve) => (release = resolve));
  await withApp({ env: { MAX_RUNNING_JOBS: '1' }, services: { ready } }, async (a) => {
    const first = (await post(a, { decklist: 'Lightning Bolt' })).json();
    const second = (await post(a, { decklist: 'Lightning Bolt' })).json();
    assert.equal(first.status, 'running');
    assert.equal(second.status, 'queued');
    assert.equal(second.queuePosition, 0);
    release();
    assert.equal((await finished(a, second.id)).status, 'done');
  });
});

test('finished jobs expire after JOB_TTL_MINUTES', () =>
  withApp({ env: { JOB_TTL_MINUTES: '0.001' } }, async (a) => {
    const { id } = (await post(a, { decklist: 'Lightning Bolt' })).json();
    await finished(a, id);
    await sleep(120);
    assert.equal((await get(a, `/api/jobs/${id}`)).statusCode, 404);
    assert.equal((await get(a, `/api/jobs/${id}/download`)).statusCode, 404);
  }));

test('GET /api/cards previews one decklist line (D27)', () =>
  withApp({}, async (a) => {
    const delver = (await get(a, '/api/cards?line=2%20Delver%20of%20Secrets')).json();
    assert.equal(delver.status, 'ok');
    assert.equal(delver.quantity, 2);
    assert.deepEqual(
      delver.faces.map((f) => [f.model.name, f.art, f.setSymbol]),
      [
        [
          'Delver of Secrets',
          '/api/art/front-11bf83bb-c95b-4b4f-9a56-ce7a1816307a.jpg',
          '/api/set-symbols/tst',
        ],
        [
          'Insectile Aberration',
          '/api/art/back-11bf83bb-c95b-4b4f-9a56-ce7a1816307a.jpg',
          '/api/set-symbols/tst',
        ],
      ],
    );
    assert.equal(delver.faces[1].model.power, '3');

    const fallback = (await get(a, '/api/cards?line=Lightning%20Bolt%20(XXX)')).json();
    assert.match(fallback.warning, /no printing in set XXX/);
    assert.deepEqual((await get(a, '/api/cards?line=Lightnig%20Bolt')).json(), {
      status: 'unmatched',
      name: 'Lightnig Bolt',
      suggestions: ['Lightning Bolt'],
    });
    assert.equal((await get(a, '/api/cards?line=Fire%20//%20Ice')).json().status, 'unsupported');
    assert.equal((await get(a, '/api/cards?line=0%20Lightning%20Bolt')).json().status, 'error');
    assert.equal((await get(a, '/api/cards')).statusCode, 400);
  }));

test('previews wait for the card data with 503; jobs wait for it', () =>
  withApp({ services: { db: null, ready: new Promise(() => {}) } }, async (a) => {
    assert.equal((await get(a, '/api/cards?line=Lightning%20Bolt')).statusCode, 503);
    assert.equal((await get(a, '/api/health')).json().data, 'loading');
  }));

test('art and set symbols are served from the caches (3.4, 6.3)', async () => {
  const requested = [];
  const services = {
    fetchArt: async (url) => (
      requested.push(url),
      url.includes('/back/') ? null : Buffer.from('jpeg')
    ),
    fetchSetSymbol: async (code) => (code === 'm10' ? Buffer.from('<svg/>') : null),
  };
  await withApp({ services }, async (a) => {
    const art = await get(a, '/api/art/front-11bf83bb-c95b-4b4f-9a56-ce7a1816307a.jpg');
    assert.equal(art.statusCode, 200);
    assert.equal(art.headers['content-type'], 'image/jpeg');
    assert.equal(art.body, 'jpeg');
    assert.deepEqual(requested, [
      'https://cards.scryfall.io/art_crop/front/1/1/11bf83bb-c95b-4b4f-9a56-ce7a1816307a.jpg',
    ]);
    assert.equal(
      (await get(a, '/api/art/back-11bf83bb-c95b-4b4f-9a56-ce7a1816307a.jpg')).statusCode,
      404,
    );
    assert.equal((await get(a, '/api/art/..%2F..%2Fetc%2Fpasswd')).statusCode, 400);

    const symbol = await get(a, '/api/set-symbols/M10');
    assert.equal(symbol.headers['content-type'], 'image/svg+xml');
    assert.equal(symbol.body, '<svg/>');
    assert.equal((await get(a, '/api/set-symbols/zzz')).statusCode, 404);
  });
});

test('fonts and symbol files are served under /assets/ (D27)', () =>
  withApp({}, async (a) => {
    assert.equal((await get(a, '/assets/fonts/Beleren2016-Bold.ttf')).statusCode, 200);
    const symbol = await get(a, '/assets/symbols/generic.svg');
    assert.equal(symbol.statusCode, 200);
    assert.match(symbol.headers['content-type'], /image\/svg\+xml/);
    assert.equal((await get(a, '/assets/symbols/../../package.json')).statusCode, 404);
  }));

test('GET /api/docs is the OpenAPI description', () =>
  withApp({}, async (a) => {
    const docs = (await get(a, '/api/docs')).json();
    assert.match(docs.openapi, /^3\./);
    for (const route of ['/api/jobs', '/api/jobs/{id}', '/api/jobs/{id}/download', '/api/cards']) {
      assert.ok(docs.paths[route], route);
    }
  }));

test('per-IP rate limits return 429; 0 turns them off (3.6.5)', async () => {
  const env = { RATE_LIMIT_JOBS_PER_HOUR: '2', RATE_LIMIT_PREVIEW_PER_MINUTE: '3' };
  await withApp({ env }, async (a) => {
    const codes = [];
    for (let i = 0; i < 3; i++)
      codes.push((await post(a, { decklist: 'Lightning Bolt' })).statusCode);
    assert.deepEqual(codes, [202, 202, 429]);
    const other = await a.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: { decklist: 'Lightning Bolt' },
      remoteAddress: '10.0.0.2',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    assert.equal(other.statusCode, 202, 'a client behind the proxy has its own limit');

    const previews = [];
    for (let i = 0; i < 4; i++)
      previews.push((await get(a, '/api/cards?line=Lightning%20Bolt')).statusCode);
    assert.deepEqual(previews, [200, 200, 200, 429]);
    assert.equal((await get(a, '/api/health')).statusCode, 200, 'health checks are never limited');
  });
});

test('configuration comes from environment variables with the documented defaults (3.6.4)', () => {
  const config = loadConfig({});
  assert.equal(config.port, 3000);
  assert.equal(config.maxBodyBytes, 64 * 1024);
  assert.equal(config.maxCardsPerJob, 250);
  assert.equal(config.maxRunningJobs, 2);
  assert.equal(config.jobTtlMs, 3_600_000);
  assert.equal(config.rateLimitJobsPerHour, 10);
  assert.equal(config.rateLimitPreviewPerMinute, 120);
  assert.equal(loadConfig({ MAX_BODY_KB: '0' }).maxBodyBytes, Number.MAX_SAFE_INTEGER);
  assert.equal(loadConfig({ TRUST_PROXY: 'false' }).trustProxy, false);
  assert.throws(() => loadConfig({ MAX_RUNNING_JOBS: 'two' }), /MAX_RUNNING_JOBS/);
});
