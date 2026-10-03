import { createReadStream, existsSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import { cacheFileName } from '../art/art-cache.js';
import { resolveDecklist } from '../data/resolve.js';
import { generateCards } from '../generate.js';
import { mapCard, UnsupportedLayoutError } from '../model/from-scryfall.js';
import { pdfSheets, zipImages } from '../output/index.js';
import { parseDecklist } from '../parse/decklist.js';
import { RES_DIR, ROOT_DIR } from '../paths.js';
import { loadConfig } from './config.js';
import { createJobQueue } from './jobs.js';

/**
 * The backend API (T-C1, D26, D27, D30; Requirements 3.6.1, 3.6.5).
 *
 * JSON under /api: background jobs that render a decklist into cards.zip or
 * cards.pdf, polled for progress; preview data (card models, art and set
 * symbols) for the browser's live previews; the fonts and symbol files under
 * /assets/; the OpenAPI description at /api/docs. The built frontend (web/dist,
 * T-C2) is served at / when present.
 *
 * @typedef {object} Services
 * @property {import('../data/card-database.js').CardDatabase | null} db Current card data.
 * @property {Promise<unknown>} ready Resolves once the card data is loaded.
 * @property {(url: string | null) => Promise<Uint8Array | null>} fetchArt
 * @property {(code: string) => Promise<Uint8Array | null>} fetchSetSymbol
 * @property {() => Promise<void> | void} [close]
 *
 * @param {object} options
 * @param {(log: import('fastify').FastifyBaseLogger) => Services} options.services
 *   Called with the app's logger.
 * @param {ReturnType<typeof loadConfig>} [options.config]
 * @param {boolean | object} [options.logger] Fastify's logger: JSON lines to stdout.
 * @param {string} [options.webDir] Built frontend.
 */
export async function buildApp({
  services: createServices,
  config = loadConfig(),
  logger = false,
  webDir = path.join(ROOT_DIR, 'web', 'dist'),
}) {
  const app = Fastify({ logger, bodyLimit: config.maxBodyBytes, trustProxy: config.trustProxy });
  const services = createServices(app.log);
  const jobs = createJobQueue({
    dir: await mkdtemp(path.join(tmpdir(), 'fannable-jobs-')),
    maxRunning: config.maxRunningJobs,
    ttlMs: config.jobTtlMs,
    log: app.log,
    run: (job, onProgress) => runJob(services, job, onProgress),
  });
  app.addHook('onClose', async () => {
    await jobs.shutdown();
    await services.close?.();
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'MTG Fannable Cards API',
        description: 'Generate Magic: The Gathering cards in a fannable style.',
        version: '0.1.0',
      },
    },
  });
  await app.register(rateLimit, { global: false });
  // Limits per client IP (3.6.5); 0 turns a limit off.
  const limit = (max, timeWindow) => (max > 0 ? { rateLimit: { max, timeWindow } } : {});
  const jobLimit = limit(config.rateLimitJobsPerHour, '1 hour');
  const previewLimit = limit(config.rateLimitPreviewPerMinute, '1 minute');

  app.get('/api/health', { schema: { tags: ['status'], response: { 200: HEALTH } } }, async () => ({
    status: 'ok',
    data: services.db ? 'ready' : 'loading',
  }));

  app.post(
    '/api/jobs',
    { config: jobLimit, schema: { tags: ['jobs'], body: JOB_REQUEST, response: { 202: JOB } } },
    async (request, reply) => {
      const { decklist, format } = request.body;
      const { entries } = parseDecklist(decklist);
      const cards = entries.reduce((sum, e) => sum + e.quantity, 0);
      if (!cards) return reply.code(400).send(error(400, 'The decklist has no cards'));
      if (config.maxCardsPerJob && cards > config.maxCardsPerJob) {
        return reply
          .code(400)
          .send(
            error(400, `The decklist has ${cards} cards; the limit is ${config.maxCardsPerJob}`),
          );
      }
      if (!jobs.accepting) {
        return reply.code(503).send(error(503, 'The server is shutting down; try again shortly'));
      }
      const job = jobs.create({ decklist, format });
      return reply.code(202).header('Location', `/api/jobs/${job.id}`).send(jobView(job, jobs));
    },
  );

  app.get(
    '/api/jobs/:id',
    { schema: { tags: ['jobs'], params: JOB_ID, response: { 200: JOB } } },
    async (request, reply) => {
      const job = jobs.get(request.params.id);
      if (!job) return reply.code(404).send(error(404, 'No such job, or it has expired'));
      return jobView(job, jobs);
    },
  );

  app.get(
    '/api/jobs/:id/download',
    {
      schema: {
        tags: ['jobs'],
        params: JOB_ID,
        description: 'The finished cards.zip or cards.pdf.',
        produces: ['application/zip', 'application/pdf'],
      },
    },
    async (request, reply) => {
      const job = jobs.get(request.params.id);
      if (!job) return reply.code(404).send(error(404, 'No such job, or it has expired'));
      if (job.status !== 'done') {
        return reply.code(409).send(error(409, `The job is ${job.status}, not done`));
      }
      return reply
        .type(job.format === 'pdf' ? 'application/pdf' : 'application/zip')
        .header('Content-Disposition', `attachment; filename="cards.${job.format}"`)
        .send(createReadStream(job.file));
    },
  );

  app.get(
    '/api/cards',
    {
      config: previewLimit,
      schema: { tags: ['preview'], querystring: CARD_QUERY, response: { 200: CARD_PREVIEW } },
    },
    async (request, reply) => {
      if (!services.db) return reply.code(503).send(error(503, 'The card data is still loading'));
      return previewLine(services.db, request.query.line);
    },
  );

  app.get(
    '/api/art/:id',
    {
      config: previewLimit,
      schema: { tags: ['preview'], params: ART_ID, produces: ['image/jpeg'] },
    },
    async (request, reply) => {
      const bytes = await services.fetchArt(artUrl(request.params.id));
      if (!bytes) return reply.code(404).send(error(404, 'Art not available'));
      return reply.type('image/jpeg').header('Cache-Control', 'public, max-age=86400').send(bytes);
    },
  );

  app.get(
    '/api/set-symbols/:code',
    {
      config: previewLimit,
      schema: { tags: ['preview'], params: SET_CODE, produces: ['image/svg+xml'] },
    },
    async (request, reply) => {
      const bytes = await services.fetchSetSymbol(request.params.code.toLowerCase());
      if (!bytes) return reply.code(404).send(error(404, 'No symbol for this set'));
      return reply
        .type('image/svg+xml')
        .header('Cache-Control', 'public, max-age=86400')
        .send(Buffer.from(bytes));
    },
  );

  app.get('/api/docs', { schema: { hide: true } }, async () => app.swagger());

  // Fonts and symbol files for rendering in the browser (D27): /assets/fonts/…, /assets/symbols/…
  for (const [folder, decorateReply] of [
    ['fonts', true],
    ['symbols', false],
  ]) {
    await app.register(fastifyStatic, {
      root: path.join(RES_DIR, folder),
      prefix: `/assets/${folder}/`,
      decorateReply,
      schemaHide: true,
    });
  }
  if (existsSync(webDir)) {
    await app.register(fastifyStatic, { root: webDir, decorateReply: false });
  }

  app.setNotFoundHandler((request, reply) => reply.code(404).send(error(404, 'Not found')));
  return app;
}

function error(statusCode, message) {
  return { statusCode, error: STATUS_TEXT[statusCode], message };
}
const STATUS_TEXT = {
  400: 'Bad Request',
  404: 'Not Found',
  409: 'Conflict',
  503: 'Service Unavailable',
};

/** Renders a job's decklist and bundles it (3.5.3). */
async function runJob(services, job, onProgress) {
  await services.ready;
  const { images, report } = await generateCards(services.db, job.decklist, {
    fetchArt: services.fetchArt,
    fetchSetSymbol: services.fetchSetSymbol,
    onProgress,
  });
  if (!images.length) return { bytes: null, report, error: 'No cards were generated' };
  const bytes = job.format === 'pdf' ? await pdfSheets(images) : zipImages(images);
  return { bytes, report };
}

/** A job's status as the API returns it (3.6.1). */
function jobView(job, jobs) {
  const report = job.report ?? {
    errors: [],
    unmatched: [],
    fallbacks: [],
    skipped: [],
    renderWarnings: [],
  };
  return {
    id: job.id,
    status: job.status,
    format: job.format,
    total: job.total,
    done: job.done,
    ...(job.status === 'queued' && { queuePosition: jobs.position(job) }),
    ...report,
    error: job.error,
    downloadUrl: job.status === 'done' ? `/api/jobs/${job.id}/download` : null,
    expiresAt: job.expiresAt && new Date(job.expiresAt).toISOString(),
  };
}

/** Scryfall art URL for an art id: `front-<uuid>.jpg` (the art cache's file name, T-A10). */
function artUrl(id) {
  const [, face, uuid] = /^(front|back)-([0-9a-f-]{36})\.jpg$/.exec(id);
  return `https://cards.scryfall.io/art_crop/${face}/${uuid[0]}/${uuid[1]}/${uuid}.jpg`;
}

/** The preview URL for a card model's art, or null without Scryfall art. */
function artPath(url) {
  try {
    return url ? `/api/art/${cacheFileName(url)}` : null;
  } catch {
    return null;
  }
}

/** Preview data for one decklist line (D27). */
function previewLine(db, line) {
  const { cards, unmatched, errors } = resolveDecklist(db, line);
  if (errors.length) return { status: 'error', message: errors[0].error };
  if (unmatched.length) {
    return { status: 'unmatched', name: unmatched[0].name, suggestions: unmatched[0].suggestions };
  }
  if (!cards.length) return { status: 'error', message: 'No card on this line' };
  const [card] = cards;
  const base = { name: card.name, quantity: card.quantity, warning: card.warning };
  let models;
  try {
    models = mapCard(card.printing);
  } catch (e) {
    if (!(e instanceof UnsupportedLayoutError)) throw e;
    return { status: 'unsupported', ...base, message: e.message };
  }
  return {
    status: 'ok',
    ...base,
    faces: models.map((model) => ({
      model,
      art: artPath(model.artUrl),
      setSymbol: `/api/set-symbols/${model.setCode.toLowerCase()}`,
    })),
  };
}

// JSON schemas: request validation, response serialisation and the OpenAPI description.

const HEALTH = {
  type: 'object',
  properties: { status: { const: 'ok' }, data: { enum: ['ready', 'loading'] } },
};

const JOB_REQUEST = {
  type: 'object',
  required: ['decklist'],
  additionalProperties: false,
  properties: {
    decklist: {
      type: 'string',
      minLength: 1,
      description: 'One card per line: "4 Lightning Bolt"',
    },
    format: { enum: ['zip', 'pdf'], default: 'zip' },
  },
};

const JOB_ID = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
};

const LINE = {
  lineNumber: { type: 'integer' },
  line: { type: 'string' },
};

const JOB = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: { enum: ['queued', 'running', 'done', 'failed'] },
    format: { enum: ['zip', 'pdf'] },
    total: { type: 'integer', description: 'Card images to generate; 0 until the job starts' },
    done: { type: 'integer' },
    queuePosition: { type: 'integer', description: 'Jobs ahead of this one, while queued' },
    errors: {
      type: 'array',
      items: { type: 'object', properties: { ...LINE, error: { type: 'string' } } },
    },
    unmatched: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ...LINE,
          name: { type: 'string' },
          suggestions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    fallbacks: {
      type: 'array',
      items: { type: 'object', properties: { ...LINE, warning: { type: 'string' } } },
    },
    skipped: {
      type: 'array',
      items: {
        type: 'object',
        properties: { ...LINE, name: { type: 'string' }, reason: { type: 'string' } },
      },
    },
    renderWarnings: {
      type: 'array',
      items: {
        type: 'object',
        properties: { fileName: { type: 'string' }, warning: { type: 'string' } },
      },
    },
    error: { type: ['string', 'null'] },
    downloadUrl: { type: ['string', 'null'] },
    expiresAt: { type: ['string', 'null'], format: 'date-time' },
  },
};

const CARD_QUERY = {
  type: 'object',
  required: ['line'],
  properties: { line: { type: 'string', minLength: 1, maxLength: 300 } },
};

const CARD_PREVIEW = {
  type: 'object',
  properties: {
    status: { enum: ['ok', 'unmatched', 'unsupported', 'error'] },
    name: { type: 'string' },
    quantity: { type: 'integer' },
    warning: { type: ['string', 'null'] },
    message: { type: 'string' },
    suggestions: { type: 'array', items: { type: 'string' } },
    faces: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          model: { type: 'object', additionalProperties: true, description: 'Card model (S1)' },
          art: { type: ['string', 'null'] },
          setSymbol: { type: 'string' },
        },
      },
    },
  },
};

const ART_ID = {
  type: 'object',
  properties: { id: { type: 'string', pattern: '^(front|back)-[0-9a-f-]{36}\\.jpg$' } },
};

const SET_CODE = {
  type: 'object',
  properties: { code: { type: 'string', pattern: '^[A-Za-z0-9]{2,6}$' } },
};
