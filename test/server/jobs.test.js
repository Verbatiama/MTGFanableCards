import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createJobQueue } from '../../src/server/jobs.js';

const report = { errors: [], unmatched: [], fallbacks: [], skipped: [], renderWarnings: [] };
const quiet = { info() {}, error() {} };

/** A run function whose jobs finish when the test says so. */
function controlledRun() {
  const pending = new Map();
  return {
    run: (job, onProgress) =>
      new Promise((resolve) => {
        onProgress({ done: 0, total: 1 });
        pending.set(job.id, () => resolve({ bytes: Buffer.from(job.decklist), report }));
      }),
    finish: (job) => pending.get(job.id)(),
    started: (job) => pending.has(job.id),
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

/** Waits until `condition` holds (files are written in between). */
async function until(condition) {
  while (!condition()) await new Promise((resolve) => setTimeout(resolve, 2));
}

test('runs at most maxRunning jobs, in order, and writes each file (3.6.1)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'jobs-'));
  const control = controlledRun();
  const queue = createJobQueue({ run: control.run, dir, maxRunning: 1, log: quiet });
  const a = queue.create({ decklist: 'a' });
  const b = queue.create({ decklist: 'b', format: 'pdf' });
  assert.deepEqual([a.status, b.status], ['running', 'queued']);
  assert.equal(a.total, 1);
  assert.equal(queue.position(b), 0);

  control.finish(a);
  await until(() => a.status === 'done');
  assert.equal(await readFile(a.file, 'utf8'), 'a');
  await until(() => b.status === 'running');
  control.finish(b);
  await until(() => b.status === 'done');
  assert.ok(b.file.endsWith('.pdf'));
  await queue.shutdown();
});

test('a job that throws, or generates nothing, fails with a reason', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'jobs-'));
  const runs = [
    async () => {
      throw new Error('boom');
    },
    async () => ({ bytes: null, report, error: 'No cards were generated' }),
  ];
  const queue = createJobQueue({ run: () => runs.shift()(), dir, log: quiet });
  const thrown = queue.create({ decklist: 'x' });
  const empty = queue.create({ decklist: 'y' });
  await until(() => thrown.status === 'failed' && empty.status === 'failed');
  assert.deepEqual([thrown.status, thrown.error], ['failed', 'Generation failed: boom']);
  assert.deepEqual(
    [empty.status, empty.error, empty.report],
    ['failed', 'No cards were generated', report],
  );
  await queue.shutdown();
});

test('shutdown drops queued jobs, waits for running ones and removes the files (3.6.5)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'jobs-'));
  const control = controlledRun();
  const queue = createJobQueue({ run: control.run, dir, maxRunning: 1, log: quiet });
  const running = queue.create({ decklist: 'a' });
  const queued = queue.create({ decklist: 'b' });

  let closed = false;
  const closing = queue.shutdown().then(() => (closed = true));
  assert.equal(queue.accepting, false);
  assert.throws(() => queue.create({ decklist: 'c' }), /shutting down/);
  assert.equal(queued.status, 'failed');
  await tick();
  assert.equal(closed, false, 'waits for the running job');

  control.finish(running);
  await closing;
  assert.equal(running.status, 'done');
  assert.equal(control.started(queued), false);
  await assert.rejects(access(dir));
});

test('each job gets a work directory, deleted when it ends; run can write the file itself (T-S13)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'jobs-'));
  let workDir;
  const run = async (job, onProgress, work) => {
    workDir = work.workDir;
    assert.ok((await stat(workDir)).isDirectory());
    await writeFile(path.join(workDir, '0.png'), 'png');
    return { write: (file) => writeFile(file, `written ${job.decklist}`), report };
  };
  const queue = createJobQueue({ run, dir, log: quiet });
  const job = queue.create({ decklist: 'a' });
  await until(() => job.status === 'done');
  assert.equal(await readFile(job.file, 'utf8'), 'written a');
  await assert.rejects(access(workDir));
  await queue.shutdown();
});
