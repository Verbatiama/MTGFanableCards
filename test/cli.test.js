import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { runCli } from '../src/cli.js';
import { generateCards, hasProblems } from '../src/generate.js';
import { deckDatabase, offline } from './data/deck.js';

const db = await deckDatabase();

test('copies and faces become images in decklist order, rendered once each (3.2.3, 3.5.4)', async () => {
  let progress;
  const { images, report } = await generateCards(db, '2 Lightning Bolt\n2 Delver of Secrets', {
    ...offline,
    onProgress: (p) => (progress = p),
  });
  assert.deepEqual(
    images.map((i) => i.fileName),
    [
      'Lightning-Bolt.png',
      'Lightning-Bolt-2.png',
      'Delver-of-Secrets.png',
      'Insectile-Aberration.png',
      'Delver-of-Secrets-2.png',
      'Insectile-Aberration-2.png',
    ],
  );
  assert.equal(images[0].png, images[1].png, 'copies share one render');
  assert.notEqual(images[2].png, images[3].png);
  assert.deepEqual(progress, { done: 6, total: 6 });
  assert.equal(hasProblems(report), false);
});

test('problems are reported and never stop the batch (3.2.6, 3.3.3, D1)', async () => {
  const { images, report } = await generateCards(
    db,
    '0 Lightning Bolt\nLightnig Bolt\n1 Lightning Bolt (XXX)\n1 Fire // Ice',
    offline,
  );
  assert.equal(images.length, 1);
  assert.deepEqual(
    report.errors.map((e) => e.lineNumber),
    [1],
  );
  assert.deepEqual(
    report.unmatched.map((u) => [u.lineNumber, u.suggestions]),
    [[2, ['Lightning Bolt']]],
  );
  assert.deepEqual(
    report.fallbacks.map((f) => f.lineNumber),
    [3],
  );
  assert.deepEqual(
    report.skipped.map((s) => [s.lineNumber, s.name]),
    [[4, 'Fire // Ice']],
  );
  assert.equal(hasProblems(report), true);
});

/** Runs the CLI against the test database, capturing its output. */
async function cli(argv, { stdin = '' } = {}) {
  const out = { stdout: '', stderr: '' };
  const code = await runCli(argv, {
    stdout: { write: (t) => (out.stdout += t) },
    stderr: { write: (t) => (out.stderr += t) },
    readStdin: async () => stdin,
    open: async () => ({ db, ...offline }),
  });
  return { code, ...out };
}

async function withDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'cli-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('the CLI writes cards.zip to the output folder by default (3.5.3, 3.5.6)', () =>
  withDir(async (dir) => {
    const deck = path.join(dir, 'deck.txt');
    await writeFile(deck, '4 Lightning Bolt\n');
    const { code, stdout } = await cli([deck, '--out', dir]);
    assert.equal(code, 0);
    assert.match(stdout, /Generated 4 card images/);
    assert.deepEqual((await readdir(dir)).sort(), ['cards.zip', 'deck.txt']);
    const zip = unzipSync(await readFile(path.join(dir, 'cards.zip')));
    assert.equal(Object.keys(zip).length, 4);
  }));

test('--pdf and --png replace the zip; --png clears the previous images', () =>
  withDir(async (dir) => {
    await mkdir(path.join(dir, 'cards'));
    await writeFile(path.join(dir, 'cards', 'Old-Card.png'), '');
    const { code } = await cli(['-', '--out', dir, '--pdf', '--png'], {
      stdin: 'Delver of Secrets',
    });
    assert.equal(code, 0);
    assert.deepEqual((await readdir(dir)).sort(), ['cards', 'cards.pdf']);
    assert.deepEqual((await readdir(path.join(dir, 'cards'))).sort(), [
      'Delver-of-Secrets.png',
      'Insectile-Aberration.png',
    ]);
    const pdf = await PDFDocument.load(await readFile(path.join(dir, 'cards.pdf')));
    assert.equal(pdf.getPageCount(), 1);
  }));

test('problems go to stderr by line; exit 0 unless --strict (3.2.6)', () =>
  withDir(async (dir) => {
    const deck = path.join(dir, 'deck.txt');
    await writeFile(deck, 'Lightning Bolt\nLightnig Bolt\nFire // Ice\n');
    const relaxed = await cli([deck, '--out', dir]);
    assert.equal(relaxed.code, 0);
    assert.match(
      relaxed.stderr,
      /Line 2: No card named "Lightnig Bolt"\. Did you mean: Lightning Bolt\?/,
    );
    assert.match(
      relaxed.stderr,
      /Line 3: Fire \/\/ Ice: the split layout is not supported in v1; skipped/,
    );
    const strict = await cli([deck, '--out', dir, '--strict']);
    assert.equal(strict.code, 1);
    assert.match(strict.stderr, /--strict/);
  }));

test('nothing generated, unreadable files and bad arguments fail', () =>
  withDir(async (dir) => {
    const none = await cli(['-', '--out', dir], { stdin: 'Not A Card' });
    assert.equal(none.code, 1);
    assert.match(none.stderr, /No cards were generated/);
    assert.deepEqual(await readdir(dir), []);

    assert.equal((await cli([path.join(dir, 'missing.txt')])).code, 1);
    assert.equal((await cli([])).code, 2);
    assert.equal((await cli(['a.txt', '--bogus'])).code, 2);
    const help = await cli(['--help']);
    assert.equal(help.code, 0);
    assert.match(help.stdout, /Usage: npm run cli/);
  }));
