/**
 * Builds the icons the config needs that weren't traced from magarena (T-B14).
 * `npm run symbols:build`
 *
 * 1. Icons from the Mana font (power: two of its swords, crossed) by Andrew Gioia (SIL OFL 1.1, see
 *    res/symbols/mana-font/OFL.txt): downloaded as SVG and normalised to our
 *    format (100×100 viewBox, white on transparent).
 * 2. Icons drawn for this project (types, supertypes, subtypes, split second,
 *    defense badge): simple shapes in the same format, defined below.
 * 3. Mana symbols missing from the sheet (Y, Z, Phyrexian hybrid, colourless
 *    hybrid), composed from sheet symbols and Mana glyphs as 400×400 PNGs in
 *    the sheet's style.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from 'canvas';
import { SYMBOL_DIR } from '../src/paths.js';
import { extractSymbolSvg } from '../src/render/symbol-sheet.js';

const MANA_SVG = 'https://raw.githubusercontent.com/andrewgioia/mana/master/svg';
const HEADERS = { 'User-Agent': 'MTGFannableCards/0.1' };

/** Our path → Mana SVG name. */
const FROM_MANA = {
  'text/chaos': 'chaos',
  'text/planeswalker': 'planeswalker',
  // The planeswalker spark, as in the mockup (T-S4, C6).
  'types/planeswalker': 'planeswalker',
  'text/ticket': 'ticket',
  'badges/loyalty-up': 'loyalty-up',
  'badges/loyalty-down': 'loyalty-down',
  'badges/loyalty-zero': 'loyalty-zero',
  'badges/loyalty-start': 'loyalty-start',
  'footer/artist-brush': 'artist-brush',
};

const W = 'fill="#FFFFFF"';
/** Our path → SVG body drawn for this project, white on a 100×100 canvas. */
const DRAWN = {
  // Battle (D14): a siege tower.
  'types/battle': `<path ${W} fill-rule="evenodd" d="M24 18H34V27H44V18H56V27H66V18H76V42H70V92H30V42H24Z M42 92V74A8 8 0 0 1 58 74V92Z M46 48H54V60H46Z"/>`,
  // Kindred (D14): three figures, a tribe.
  'types/kindred': `<g ${W} stroke="#000" stroke-width="3"><circle cx="24" cy="42" r="10"/><path d="M8 86Q8 58 24 58Q40 58 40 86Z"/><circle cx="76" cy="42" r="10"/><path d="M60 86Q60 58 76 58Q92 58 92 86Z"/><circle cx="50" cy="30" r="13"/><path d="M28 90Q28 50 50 50Q72 50 72 90Z"/></g>`,
  // Split second (D12): a bolt inside a stopwatch.
  'zones/split-second': `<g ${W}><rect x="43" y="4" width="14" height="9" rx="2"/><path d="M50 14A42 42 0 1 1 49.9 14Z M50 22A34 34 0 1 0 50.1 22Z" fill-rule="evenodd"/><path d="M56 30L36 60H49L43 84L66 50H53Z"/></g>`,
  // Legendary is traced from Examples/Commander-2014.png (scripts/trace-symbol.js).
  // Basic (D15, T-S4 C4): a pentagon, as in the mockup.
  'supertypes/basic': `<path ${W} d="M50 6L94 38L77 91H23L6 38Z"/>`,
  // Non-basic lands (T-S4, C9): the pentagon with a pine tree cut out, as in the mockup.
  'supertypes/nonbasic': `<path ${W} fill-rule="evenodd" d="M50 6L94 38L77 91H23L6 38Z M50 20L59 35H54L63 48H57L66 62L54 58L50 74L46 58L34 62L43 48H37L46 35H41Z"/>`,
  // World (D15): a globe.
  'supertypes/world': `<g fill="none" stroke="#FFFFFF" stroke-width="5"><circle cx="50" cy="50" r="40"/><ellipse cx="50" cy="50" rx="17" ry="40"/><path d="M10 50H90M17 30H83M17 70H83"/></g>`,
  // Aura (D16, T-S4 C3): a ring crowned with flame-like prongs, as in the mockup.
  'subtypes/aura': `<g ${W}><path fill-rule="evenodd" d="M50 44A23 23 0 1 1 49.9 44Z M50 55A12 12 0 1 0 50.1 55Z"/><path d="M44 47Q46 24 50 4Q54 24 56 47Z M38 50Q32 32 30 12Q42 28 47 45Z M62 50Q68 32 70 12Q58 28 53 45Z M33 57Q16 48 6 24Q22 38 39 49Z M67 57Q84 48 94 24Q78 38 61 49Z"/></g>`,
  // Equipment (D16, T-S4 C2): a sword across a shield, as in the mockup.
  'subtypes/equipment': `<path ${W} d="M30 10H90V46Q90 76 60 92Q30 76 30 46Z"/><g ${W} stroke="#000" stroke-width="4" stroke-linejoin="round" transform="rotate(-45 50 50) translate(50 50) scale(0.86) translate(-50 -50)"><path d="M50 -2L60 12V60H40V12Z"/><rect x="30" y="60" width="40" height="10" rx="2"/><rect x="45" y="70" width="10" height="16"/><circle cx="50" cy="92" r="7"/></g>`,
  // Fortification (D16): a battlemented wall with a gate.
  'subtypes/fortification': `<path ${W} fill-rule="evenodd" d="M6 90V44H18V30H30V44H42V30H58V44H70V30H82V44H94V90Z M40 90V70A10 10 0 0 1 60 70V90Z"/>`,
  // Defense badge (D18): a shield, tinted and numbered by the renderer.
  'badges/defense': `<path ${W} d="M12 8H88V50Q88 80 50 96Q12 80 12 50Z"/>`,
};

/** Mana symbols missing from the sheet, composed in its style. */
const PHYREXIAN_HYBRID = ['W/U', 'W/B', 'U/B', 'U/R', 'B/R', 'B/G', 'R/G', 'R/W', 'G/W', 'G/U'];
const COLOURLESS_HYBRID = ['C/W', 'C/U', 'C/B', 'C/R', 'C/G'];

function svg(body, comment) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${comment} -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">\n  ${body}\n</svg>\n`;
}

/** Fits a Mana glyph into 100×100, centred, 90% of the box, white. */
function normaliseMana(source) {
  const [w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(source).slice(1).map(Number);
  const paths = [...source.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  const scale = 90 / Math.max(w, h);
  const tx = (100 - w * scale) / 2;
  const ty = (100 - h * scale) / 2;
  const body = paths.map((d) => `<path d="${d}"/>`).join('');
  return `<g ${W} transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})">${body}</g>`;
}

async function fetchMana(name) {
  const response = await fetch(`${MANA_SVG}/${name}.svg`, { headers: HEADERS });
  if (!response.ok) throw new Error(`Mana ${name}: HTTP ${response.status}`);
  return response.text();
}

async function write(target, contents) {
  const file = path.join(SYMBOL_DIR, target);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents);
  console.log(`  ${target}`);
}

const SIZE = 400;
// Circle colours sampled from the sheet; X's grey differs slightly from {C}'s.
const BACKGROUND = {
  W: '#f8f6d8',
  U: '#c1d7e9',
  B: '#bab1ab',
  R: '#e49977',
  G: '#a3c095',
  C: '#ccc2c0',
};
const X_GREY = '#cac5c0';

async function composeManaSymbols() {
  const sheet = await readFile(path.join(SYMBOL_DIR, 'symbols.svg'), 'utf8');
  const sheetSymbol = async (code) => loadImage(Buffer.from(extractSymbolSvg(sheet, code, SIZE)));
  const manaGlyph = async (name) =>
    loadImage(Buffer.from((await fetchMana(name)).replace(/fill="#444"/g, 'fill="#0d0f0f"')));

  // Y and Z: the grey circle of X with Mana's letter.
  for (const letter of ['y', 'z']) {
    const canvas = createCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = X_GREY;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(await manaGlyph(letter), SIZE * 0.2, SIZE * 0.2, SIZE * 0.6, SIZE * 0.6);
    await write(`mana/${letter}.png`, canvas.toBuffer('image/png'));
  }

  // Hybrids: split diagonally like the sheet's (first colour top-left), each
  // half carrying a small symbol whose background matches the half.
  const hybrid = async (code, [first, second]) => {
    const canvas = createCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = first.background;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = second.background;
    ctx.beginPath();
    ctx.moveTo(SIZE, 0);
    ctx.lineTo(SIZE, SIZE);
    ctx.lineTo(0, SIZE);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const small = SIZE * 0.42;
    ctx.drawImage(first.image, SIZE * 0.1, SIZE * 0.1, small, small);
    ctx.drawImage(second.image, SIZE * 0.48, SIZE * 0.48, small, small);
    await write(`mana/${code}.png`, canvas.toBuffer('image/png'));
  };

  for (const pair of PHYREXIAN_HYBRID) {
    const halves = await Promise.all(
      pair.split('/').map(async (c) => ({
        background: BACKGROUND[c],
        image: await sheetSymbol(`p${c.toLowerCase()}`),
      })),
    );
    await hybrid(`${pair.replace('/', '-').toLowerCase()}-p`, halves);
  }
  for (const pair of COLOURLESS_HYBRID) {
    const halves = await Promise.all(
      pair.split('/').map(async (c) => ({
        background: BACKGROUND[c],
        image: await sheetSymbol(c.toLowerCase()),
      })),
    );
    await hybrid(pair.replace('/', '-').toLowerCase(), halves);
  }
}

console.log('From the Mana font:');
for (const [target, name] of Object.entries(FROM_MANA)) {
  const url = `${MANA_SVG}/${name}.svg`;
  await write(
    `${target}.svg`,
    svg(
      normaliseMana(await fetchMana(name)),
      `From the Mana font by Andrew Gioia (SIL OFL 1.1): ${url}`,
    ),
  );
}
// Power (5.7.1): crossed swords, blades up: two copies of Mana's sword at ±35°.
{
  const sword = normaliseMana(await fetchMana('power'));
  const crossed = [145, 215].map((a) => `<g transform="rotate(${a} 50 50)">${sword}</g>`).join('');
  await write(
    'stats/power.svg',
    svg(
      crossed,
      `Crossed swords from the Mana font by Andrew Gioia (SIL OFL 1.1): ${MANA_SVG}/power.svg`,
    ),
  );
}
console.log('Drawn for this project:');
for (const [target, body] of Object.entries(DRAWN)) {
  await write(
    `${target}.svg`,
    svg(body, 'Drawn for MTGFannableCards by scripts/build-icons.js (GPL-3.0)'),
  );
}
console.log('Composed mana symbols:');
await composeManaSymbols();
