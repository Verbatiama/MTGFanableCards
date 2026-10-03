import { readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createArtFetcher } from './art/art-cache.js';
import { createSetSymbolFetcher } from './art/set-symbols.js';
import { createCardStore } from './data/card-store.js';
import { generateCards, hasProblems } from './generate.js';
import { pdfSheets, writeImages, zipImages } from './output/index.js';
import { OUT_DIR } from './paths.js';

/**
 * Command-line entry point (T-A12, D29, Requirements 3.2.6, 3.5).
 * `npm run cli -- decklist.txt [--pdf] [--png] [--out dir] [--strict]`
 *
 * Writes `cards.zip` to out/ by default; `--pdf` writes `cards.pdf` and
 * `--png` the loose images in out/cards/ instead (any combination; `--zip`
 * adds the zip back). Problems with the decklist are reported on stderr and
 * don't stop the batch. Exit codes: 0 done, 1 nothing generated (or problems
 * with `--strict`), 2 usage error.
 */

export const USAGE = `Usage: npm run cli -- <decklist.txt | -> [options]

Generates fannable cards for a decklist ("4 Lightning Bolt" per line; - reads stdin).

Options:
  --zip         Write cards.zip (the default when no format is given)
  --pdf         Write cards.pdf: A4 sheets with 9 cards each
  --png         Write each card as a PNG in <out>/cards/
  --out <dir>   Output folder (default: out/)
  --strict      Exit with code 1 if any line was unreadable, unmatched,
                fell back to another printing or was skipped
  -h, --help    Show this help
`;

const OPTIONS = {
  zip: { type: 'boolean', default: false },
  pdf: { type: 'boolean', default: false },
  png: { type: 'boolean', default: false },
  out: { type: 'string', default: OUT_DIR },
  strict: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

/** Everything the CLI reads and writes outside its arguments; replaced in tests. */
function defaultDeps() {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    readStdin: async () => {
      let text = '';
      for await (const chunk of process.stdin) text += chunk;
      return text;
    },
    async open(log) {
      const store = createCardStore({ refreshHours: 0, log });
      const artFetcher = createArtFetcher({ log });
      const setSymbols = createSetSymbolFetcher({ log });
      await store.ready;
      return {
        db: store.db,
        fetchArt: artFetcher.fetchArt,
        fetchSetSymbol: setSymbols.fetchSetSymbol,
        artStats: artFetcher.stats,
        async close() {
          store.stop();
          await artFetcher.flush();
        },
      };
    },
  };
}

/**
 * @param {string[]} argv Arguments after `node src/cli.js`.
 * @param {Partial<ReturnType<typeof defaultDeps>>} [deps]
 * @returns {Promise<number>} The exit code.
 */
export async function runCli(argv, deps = {}) {
  const { stdout, stderr, readStdin, open } = { ...defaultDeps(), ...deps };
  const say = (text) => stdout.write(`${text}\n`);
  const warn = (text) => stderr.write(`${text}\n`);

  let args;
  try {
    args = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  } catch (error) {
    warn(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = args;
  if (values.help) {
    say(USAGE);
    return 0;
  }
  if (positionals.length !== 1) {
    warn(`Give exactly one decklist file.\n\n${USAGE}`);
    return 2;
  }

  const [source] = positionals;
  let decklist;
  try {
    decklist = source === '-' ? await readStdin() : await readFile(source, 'utf8');
  } catch (error) {
    warn(`Can't read the decklist ${source}: ${error.message}`);
    return 1;
  }

  const started = Date.now();
  const log = { info: warn, warn, error: (e) => warn(String(e?.message ?? e)) };
  let session;
  try {
    session = await open(log);
  } catch (error) {
    warn(`Can't load the Scryfall card data: ${error.message}`);
    return 1;
  }

  try {
    const { images, report } = await generateCards(session.db, decklist, session);
    printReport(report, warn);

    if (!images.length) {
      warn('No cards were generated.');
      return 1;
    }
    const written = await writeOutputs(images, values);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const art = session.artStats;
    const artSummary = art
      ? ` (art: ${art.downloaded} downloaded, ${art.cached} cached, ${art.failed} failed)`
      : '';
    say(
      `Generated ${images.length} card image${images.length === 1 ? '' : 's'} in ${seconds} s${artSummary}`,
    );
    for (const file of written) say(`Wrote ${display(file)}`);

    if (values.strict && hasProblems(report)) {
      warn('--strict: the decklist had problems (see above).');
      return 1;
    }
    return 0;
  } finally {
    await session.close?.();
  }
}

/** A path relative to the working directory when it's inside it, otherwise absolute. */
function display(file) {
  const relative = path.relative(process.cwd(), file);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : file;
}

/** Writes the chosen outputs (3.5.3, 3.5.6); returns the paths written. */
async function writeOutputs(images, { zip, pdf, png, out }) {
  await mkdir(out, { recursive: true });
  const written = [];
  if (zip || !(pdf || png)) {
    const file = path.join(out, 'cards.zip');
    await writeFile(file, zipImages(images));
    written.push(file);
  }
  if (pdf) {
    const file = path.join(out, 'cards.pdf');
    await writeFile(file, await pdfSheets(images));
    written.push(file);
  }
  if (png) {
    const dir = path.join(out, 'cards');
    // Clear the previous run's images, so the folder holds just this deck.
    const old = await readdir(dir).catch(() => []);
    await Promise.all(
      old.filter((f) => f.endsWith('.png')).map((f) => rm(path.join(dir, f), { force: true })),
    );
    await writeImages(dir, images);
    written.push(dir);
  }
  return written;
}

/** One line per problem, by decklist line (3.2.6). */
export function printReport(report, warn) {
  const lines = [
    ...report.errors.map((e) => [e.lineNumber, `${e.error}: ${e.line}`]),
    ...report.unmatched.map((u) => [
      u.lineNumber,
      `No card named "${u.name}"` +
        (u.suggestions.length ? `. Did you mean: ${u.suggestions.join(', ')}?` : ''),
    ]),
    ...report.fallbacks.map((f) => [f.lineNumber, f.warning]),
    ...report.skipped.map((s) => [s.lineNumber, `${s.reason}; skipped`]),
  ].sort((a, b) => a[0] - b[0]);
  for (const [lineNumber, message] of lines) warn(`Line ${lineNumber}: ${message}`);
  for (const { fileName, warning } of report.renderWarnings) warn(`${fileName}: ${warning}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
