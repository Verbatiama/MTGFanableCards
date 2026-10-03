import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCanvas } from 'canvas';
import { unzipSync } from 'fflate';
import { PDFDocument, PDFName } from 'pdf-lib';
import {
  assignFileNames,
  baseFileName,
  pdfSheets,
  writeImages,
  zipImages,
  zipImagesToFile,
} from '../../src/output/index.js';

/** A small solid-colour PNG standing in for a rendered card. */
function png(colour) {
  const canvas = createCanvas(75, 105);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, 75, 105);
  return canvas.toBuffer('image/png');
}

test('file names follow the card name (3.5.2)', () => {
  assert.equal(baseFileName('Lightning Bolt'), 'Lightning-Bolt');
  assert.equal(baseFileName('Jace, the Mind Sculptor'), 'Jace-the-Mind-Sculptor');
  assert.equal(baseFileName("Smuggler's Copter"), 'Smugglers-Copter');
  assert.equal(baseFileName('Lim-Dûl the Necromancer'), 'Lim-Dul-the-Necromancer');
  assert.equal(baseFileName('Borrowing 100,000 Arrows'), 'Borrowing-100000-Arrows');
  assert.equal(baseFileName('???'), 'card');
});

test('copies get a counter; each face of a double-faced card gets its own file (3.2.3, 3.5.4)', () => {
  assert.deepEqual(
    assignFileNames([
      'Lightning Bolt',
      'Lightning Bolt',
      'Lightning Bolt',
      'Delver of Secrets',
      'Insectile Aberration',
      'lightning bolt',
    ]),
    [
      'Lightning-Bolt.png',
      'Lightning-Bolt-2.png',
      'Lightning-Bolt-3.png',
      'Delver-of-Secrets.png',
      'Insectile-Aberration.png',
      'lightning-bolt-4.png',
    ],
  );
});

const images = (count) =>
  assignFileNames(Array.from({ length: count }, (_, i) => `Card ${i + 1}`)).map((fileName, i) => ({
    fileName,
    png: png(i % 2 ? '#c03c2b' : '#669ecb'),
  }));

test('the zip holds every image under its file name (3.5.1)', () => {
  const input = images(3);
  const files = unzipSync(zipImages(input));
  assert.deepEqual(Object.keys(files), ['Card-1.png', 'Card-2.png', 'Card-3.png']);
  assert.deepEqual(Buffer.from(files['Card-2.png']), input[1].png);
});

test('the PDF has A4 pages with up to 9 cards each (3.5.3)', async () => {
  const pdf = await PDFDocument.load(await pdfSheets(images(10)));
  assert.equal(pdf.getPageCount(), 2);
  const { width, height } = pdf.getPage(0).getSize();
  assert.equal(Math.round(width), 595); // 210 mm
  assert.equal(Math.round(height), 842); // 297 mm
});

test('PDF cards are embedded as JPEGs, to keep the file small', async () => {
  const bytes = Buffer.from(await pdfSheets(images(2)));
  assert.match(bytes.toString('latin1'), /\/DCTDecode/);
});

test('copies sharing one PNG are embedded in the PDF once (T-S6)', async () => {
  const [first, second] = images(2);
  const copies = [first, { ...first, fileName: 'Card-1b.png' }, second];
  const pdf = await PDFDocument.load(await pdfSheets(copies));
  const jpegs = pdf.context
    .enumerateIndirectObjects()
    .filter(([, object]) => object.dict?.get(PDFName.of('Filter')) === PDFName.of('DCTDecode'));
  assert.equal(jpegs.length, 2);
});

test('images can be written to a folder (scripts and the CLI, 3.5.6)', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fannable-out-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeImages(path.join(dir, 'cards'), images(2));
  assert.deepEqual((await readdir(path.join(dir, 'cards'))).sort(), ['Card-1.png', 'Card-2.png']);
});

/** The images written to `dir` as low-memory jobs keep them: `{ fileName, file }` (T-S13). */
async function onDisk(t, input) {
  const dir = await mkdtemp(path.join(tmpdir(), 'fannable-png-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return Promise.all(
    input.map(async ({ fileName, png }, i) => {
      const file = path.join(dir, `${i}.png`);
      await writeFile(file, png);
      return { fileName, file };
    }),
  );
}

test('zipImagesToFile streams the same zip from images on disk (T-S13)', async (t) => {
  const input = images(3);
  const [stored] = await onDisk(t, [{ fileName: 'x', png: Buffer.alloc(0) }]);
  const target = path.join(path.dirname(stored.file), 'cards.zip');
  await zipImagesToFile(await onDisk(t, input), target);
  assert.deepEqual(unzipSync(await readFile(target)), unzipSync(zipImages(input)));
});

test('the PDF and writeImages take images on disk too, embedding a shared file once (T-S13)', async (t) => {
  const [first, second] = await onDisk(t, images(2));
  const pdf = await PDFDocument.load(await pdfSheets([first, { ...first, fileName: 'b' }, second]));
  assert.equal(pdf.getPageCount(), 1);
  const jpegs = pdf.context
    .enumerateIndirectObjects()
    .filter(([, object]) => object.dict?.get(PDFName.of('Filter')) === PDFName.of('DCTDecode'));
  assert.equal(jpegs.length, 2);

  const dir = await mkdtemp(path.join(tmpdir(), 'fannable-out-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeImages(dir, [first]);
  assert.deepEqual(await readFile(path.join(dir, 'Card-1.png')), await readFile(first.file));
});
