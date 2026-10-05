import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { createCanvas } from 'canvas';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { findScryfallUrls, scanBuild } from '../../scripts/check-web-build.js';
import { CardDatabase } from '../../src/data/card-database.js';
import { pdfSheets } from '../../src/output/index.js';
import { zipImages } from '../../src/output/sheets.js';
import { renderDeck } from '../../src/render/deck.js';
import { renderCardPng } from '../../src/render/node.js';
import { buildApp } from '../../src/server/app.js';
import { loadConfig } from '../../src/server/config.js';
import { createDeck, previewLine } from '../../web/src/api.js';
import { loadArt, loadSetSymbol } from '../../web/src/browser-render.js';

/**
 * Frontend-render mode (T-S14): the browser's batch path (POST /api/decks →
 * renderDeck → zip/PDF) gives the same files as a server job for the fixture
 * printings, and the frontend only ever asks this server for anything.
 */

const PRINTINGS = JSON.parse(
  readFileSync(new URL('../fixtures/scryfall/printings.json', import.meta.url), 'utf8'),
);
/** A stored (slim) printing as Scryfall sends it, so the database keeps its art crops. */
const withImages = ({ art_crop, ...card }) => ({
  ...card,
  ...(art_crop && { image_uris: { art_crop } }),
  ...(card.card_faces && { card_faces: card.card_faces.map(withImages) }),
});
const db = await CardDatabase.build(PRINTINGS.map((p) => ({ object: 'card', ...withImages(p) })));
const DECKLIST = [
  ...PRINTINGS.map(
    (p, i) => `${(i % 3) + 1} ${p.name} (${p.set.toUpperCase()}) ${p.collector_number}`,
  ),
  'Lightnig Bolt',
].join('\n');

/**
 * A small JPEG per artwork, so art goes through /api/art/ and shows in the
 * images. Keyed by the URL's path: the server drops Scryfall's ?timestamp.
 */
function fakeArt(url) {
  url = url.split('?')[0];
  const canvas = createCanvas(64, 48);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `hsl(${[...url].reduce((h, c) => h + c.charCodeAt(0), 0) % 360}, 60%, 50%)`;
  ctx.fillRect(0, 0, 64, 48);
  return canvas.toBuffer('image/jpeg');
}
const SET_SYMBOL = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>',
);

async function app(env) {
  return buildApp({
    config: loadConfig({
      RATE_LIMIT_JOBS_PER_HOUR: '0',
      RATE_LIMIT_PREVIEW_PER_MINUTE: '0',
      RATE_LIMIT_ASSETS_PER_MINUTE: '0',
      ...env,
    }),
    services: () => ({
      db,
      loaded: async () => db,
      fetchArt: async (url) => (url ? fakeArt(url) : null),
      fetchSetSymbol: async () => SET_SYMBOL,
    }),
    webDir: '/nonexistent',
  });
}

/** A server job's report and file. */
async function serverJob(a, format) {
  const { id } = (
    await a.inject({ method: 'POST', url: '/api/jobs', payload: { decklist: DECKLIST, format } })
  ).json();
  for (;;) {
    const job = (await a.inject({ method: 'GET', url: `/api/jobs/${id}` })).json();
    if (job.status === 'done') {
      const file = (await a.inject({ method: 'GET', url: job.downloadUrl })).rawPayload;
      return { job, file };
    }
    assert.notEqual(job.status, 'failed', job.error);
    await sleep(20);
  }
}

/**
 * The browser's batch path, with node-canvas in place of the browser's
 * canvas: everything else (the request, renderDeck, the bundles) is the code
 * the browser runs. Returns the images, the report and every URL requested.
 */
async function browserBatch(a) {
  const requested = [];
  const get = async (url) => {
    requested.push(url);
    const res = await a.inject({ method: 'GET', url });
    return res.statusCode === 200 ? res.rawPayload : null;
  };
  const res = await a.inject({
    method: 'POST',
    url: '/api/decks',
    payload: { decklist: DECKLIST },
  });
  requested.push('/api/decks');
  assert.equal(res.statusCode, 200);
  const { lines, ...report } = res.json();
  const { images, skipped, renderWarnings } = await renderDeck(lines, {
    fetchArt: async (url) => url && get(url),
    fetchSetSymbol: get,
    renderFace: async (model, options) => ({ png: await renderCardPng(model, options) }),
  });
  report.skipped.push(...skipped);
  return { images, report: { ...report, renderWarnings }, requested, body: res.body };
}

const REPORT_KEYS = ['errors', 'unmatched', 'fallbacks', 'skipped', 'renderWarnings'];
const reportOf = (r) => Object.fromEntries(REPORT_KEYS.map((k) => [k, r[k]]));

test('the browser path gives the same zip, PDF and report as a server job (T-S14)', async () => {
  const server = await app({});
  const browser = await app({ FRONTEND_RENDER: 'true' });
  try {
    const zipJob = await serverJob(server, 'zip');
    const pdfJob = await serverJob(server, 'pdf');
    const { images, report, requested, body } = await browserBatch(browser);

    assert.equal(images.length, zipJob.job.total);
    // The same files, in the same order, with the same bytes (only the zip's timestamps differ).
    const [ours, theirs] = [zipImages(images), zipJob.file].map((zip) =>
      Object.entries(unzipSync(zip)).map(([name, bytes]) => [name, Buffer.from(bytes)]),
    );
    assert.deepEqual(ours, theirs);
    assert.deepEqual(report, reportOf(zipJob.job));
    assert.equal(report.unmatched.length, 1);

    const [ourPdf, theirPdf] = await Promise.all(
      [await pdfSheets(images), pdfJob.file].map((bytes) => PDFDocument.load(bytes)),
    );
    assert.equal(ourPdf.getPageCount(), theirPdf.getPageCount());
    assert.equal(ourPdf.getPageCount(), Math.ceil(images.length / 9));

    // Only this server, and art only by id (acceptance criterion 2).
    assert.deepEqual(findScryfallUrls(body), []);
    assert.doesNotMatch(body, /scryfall/i);
    for (const url of requested) assert.match(url, /^\/api\/(decks$|art\/|set-symbols\/)/, url);
    assert.ok(requested.some((url) => /^\/api\/art\/front-[0-9a-f-]{36}\.jpg$/.test(url)));
  } finally {
    await Promise.all([server.close(), browser.close()]);
  }
});

test('previews and batches in the browser fetch only this server (T-S14)', async (t) => {
  const a = await app({ FRONTEND_RENDER: 'true' });
  const requested = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    requested.push(String(url));
    assert.match(String(url), /^\/(api|assets)\//, 'a path on this server');
    const res = await a.inject({
      method: options.method ?? 'GET',
      url: String(url),
      payload: options.body,
      headers: options.headers,
    });
    return new Response(res.statusCode === 204 ? null : res.rawPayload, {
      status: res.statusCode,
      headers: { 'content-type': res.headers['content-type'] ?? '' },
    });
  });
  try {
    const preview = await previewLine(PRINTINGS[0].name);
    assert.equal(preview.status, 'ok');
    const deck = await createDeck(DECKLIST);
    for (const face of [...preview.faces, ...deck.lines.flatMap((l) => l.faces)].slice(0, 6)) {
      assert.equal(face.model.artUrl, null, 'models carry no Scryfall URL');
      // Image decoding needs a real browser; the requests are what matter here.
      await loadArt(face.art).catch(() => {});
      await loadSetSymbol(face.setSymbol).catch(() => {});
    }
    assert.ok(requested.some((u) => u.startsWith('/api/art/')));
    assert.ok(requested.some((u) => u.startsWith('/api/set-symbols/')));
  } finally {
    await a.close();
  }
});

test('the build check finds Scryfall addresses but allows the home page link (T-S14)', () => {
  assert.deepEqual(findScryfallUrls('<a href="https://scryfall.com">Scryfall</a>'), []);
  assert.deepEqual(findScryfallUrls('fetch("https://api.scryfall.com/cards/named")'), [
    'api.scryfall.com',
  ]);
  assert.deepEqual(findScryfallUrls('"https://cards.scryfall.io/art_crop/front/x.jpg"'), [
    'cards.scryfall.io',
  ]);
  assert.deepEqual(findScryfallUrls('"//scryfall.com/search?q=bolt"'), [
    'scryfall.com/search?q=bolt',
  ]);
  assert.deepEqual(findScryfallUrls('host + "data.scryfall.io"'), ['data.scryfall.io']);
});

test('the built frontend holds no Scryfall addresses (T-S14)', (t) => {
  const dist = new URL('../../web/dist', import.meta.url).pathname;
  if (!existsSync(dist)) return t.skip('no build: npm run web:build');
  assert.deepEqual(scanBuild(dist), []);
});
