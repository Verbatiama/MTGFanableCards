import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Background job queue (T-C1, D26, D30; Requirements 3.6.1, 3.6.5).
 *
 * Jobs live in this process: in memory, with each finished file in a local
 * temporary directory, so unfinished jobs are lost on restart. At most
 * `maxRunning` jobs run at once; the rest wait in order. A finished (or
 * failed) job is kept for `ttlMs`, then it and its file are deleted.
 *
 * On shutdown the queue stops taking jobs, drops the queued ones and waits for
 * the running ones to finish.
 *
 * @typedef {'queued' | 'running' | 'done' | 'failed'} JobStatus
 * @typedef {object} Job
 * @property {string} id
 * @property {JobStatus} status
 * @property {'zip' | 'pdf'} format
 * @property {string} decklist
 * @property {number} total Card images to generate; 0 until the job starts.
 * @property {number} done Card images generated so far.
 * @property {import('../generate.js').GenerateReport | null} report
 * @property {string | null} error Why a job failed.
 * @property {string | null} file Path of the finished file.
 * @property {number} createdAt
 * @property {number | null} expiresAt
 */

/**
 * @param {object} options
 * @param {(job: Job, onProgress: (p: { done: number, total: number }) => void,
 *   work: { workDir: string }) => Promise<{ bytes?: Uint8Array | null,
 *   write?: (file: string) => Promise<void>, report: object, error?: string }>} options.run
 *   Generates a job's file: as `bytes`, or with `write`, which writes it to the
 *   path it's given (low-memory mode, T-S13). Neither (with `error`) when
 *   nothing was generated. `workDir` is an empty directory for the job's
 *   temporary files, deleted when the job ends.
 * @param {string} options.dir Where finished files are written.
 * @param {number} [options.maxRunning]
 * @param {number} [options.ttlMs]
 * @param {() => number} [options.now]
 * @param {{ info: Function, error: Function }} [options.log]
 */
export function createJobQueue({
  run,
  dir,
  maxRunning = 2,
  ttlMs = 3_600_000,
  now = Date.now,
  log = console,
}) {
  /** @type {Map<string, Job>} */
  const jobs = new Map();
  const waiting = [];
  const running = new Set();
  const timers = new Set();
  let accepting = true;

  function create({ decklist, format = 'zip' }) {
    if (!accepting) throw new Error('The server is shutting down');
    const job = {
      id: randomUUID(),
      status: 'queued',
      format,
      decklist,
      total: 0,
      done: 0,
      report: null,
      error: null,
      file: null,
      createdAt: now(),
      expiresAt: null,
    };
    jobs.set(job.id, job);
    waiting.push(job);
    pump();
    return job;
  }

  function pump() {
    while (accepting && running.size < maxRunning && waiting.length) {
      const job = waiting.shift();
      const task = start(job).finally(() => {
        running.delete(task);
        pump();
      });
      running.add(task);
    }
  }

  async function start(job) {
    job.status = 'running';
    const started = now();
    const workDir = path.join(dir, `${job.id}.work`);
    // Settled only after the work directory is removed, so a finished
    // status means the job has fully ended.
    let failure = null;
    try {
      // Synchronous, so the job starts running before create() returns.
      mkdirSync(workDir, { recursive: true });
      const onProgress = ({ done, total }) => {
        job.done = done;
        job.total = total;
      };
      const { bytes, write, report, error } = await run(job, onProgress, { workDir });
      job.report = report;
      if (bytes || write) {
        job.file = path.join(dir, `${job.id}.${job.format}`);
        await (write ? write(job.file) : writeFile(job.file, bytes));
      } else {
        failure = error ?? 'No cards were generated';
      }
    } catch (error) {
      log.error(error);
      failure = `Generation failed: ${error.message}`;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
    if (failure) fail(job, failure);
    else job.status = 'done';
    const seconds = ((now() - started) / 1000).toFixed(1);
    log.info(`job ${job.id} ${job.status}: ${job.done} cards in ${seconds} s`);
    expireLater(job);
  }

  function fail(job, error) {
    job.status = 'failed';
    job.error = error;
  }

  function expireLater(job) {
    job.expiresAt = now() + ttlMs;
    const timer = setTimeout(() => {
      timers.delete(timer);
      remove(job);
    }, ttlMs);
    timer.unref();
    timers.add(timer);
  }

  function remove(job) {
    jobs.delete(job.id);
    if (job.file) rm(job.file, { force: true }).catch(() => {});
  }

  return {
    create,
    /** @returns {Job | undefined} */
    get: (id) => jobs.get(id),
    /** Number of jobs ahead of a queued job (0 when it's next). */
    position: (job) => waiting.indexOf(job),
    get accepting() {
      return accepting;
    },
    /** Stops taking jobs, drops queued ones and waits for running ones (3.6.5). */
    async shutdown() {
      accepting = false;
      for (const job of waiting.splice(0)) {
        fail(job, 'The server shut down before the job started');
      }
      await Promise.allSettled(running);
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
