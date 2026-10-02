import { MANA_SYMBOL_IMAGES, TEXT_SYMBOLS } from '../config/text-symbols.js';
import { extractSymbolSvg, listSymbolCodes } from './symbol-sheet.js';

/**
 * Asset loader for the renderer (T-B3, D7, Requirements 9.1). Loads and caches
 * the symbol sheet, icons and composed mana symbols, wherever the renderer
 * runs: the environment says how to fetch a file.
 *
 * @typedef {object} AssetEnv
 * @property {(width: number, height: number) => any} createCanvas
 * @property {(path: string) => Promise<any>} loadAsset Image from res/symbols/<path>.
 * @property {(path: string) => Promise<string>} readAsset Text of res/symbols/<path>.
 * @property {(svg: string) => Promise<any>} loadSvg Image from SVG source.
 */

/** Size the sheet's symbols are rasterised at; drawn smaller, they stay sharp. */
const SYMBOL_SIZE = 160;

/** @param {AssetEnv} env */
export function createAssets(env) {
  const cache = new Map();
  let sheet = null;

  /** Loads once per key; failures are cached as null so they aren't retried. */
  function once(key, load) {
    if (!cache.has(key))
      cache.set(
        key,
        load().catch(() => null),
      );
    return cache.get(key);
  }

  function loadSheet() {
    sheet ??= env.readAsset('symbols.svg').then((text) => ({
      text,
      codes: new Set(listSymbolCodes(text)),
    }));
    return sheet;
  }

  /**
   * The sheet's label for a Scryfall symbol code: 'S' → 'snow', Phyrexian
   * 'B/P' → 'pb', hybrids 'W/U' → 'wu', mono-hybrids '2/W' → '2w'. Null when
   * the sheet doesn't have it.
   */
  async function sheetLabel(code) {
    const { codes } = await loadSheet();
    const c = code.toLowerCase();
    if (c === 's') return 'snow';
    const phyrexian = /^([wubrg])\/p$/.exec(c);
    const label = phyrexian ? `p${phyrexian[1]}` : c.replace('/', '');
    return codes.has(label) ? label : null;
  }

  return {
    /**
     * A mana or text symbol by Scryfall code ('U', '2', 'G/W/P', 'T', 'CHAOS'),
     * or 'generic' for the stat bar's generic symbol. Null when there is no
     * image, so the caller can fall back to the code as text (6.4.7).
     * Text-box symbols (chaos, ticket, planeswalker) come back white; tint
     * them for the text box.
     */
    symbol(code) {
      const upper = code.toUpperCase();
      return once(`symbol:${upper}`, async () => {
        if (code === 'generic') return env.loadAsset('generic.svg');
        const label = await sheetLabel(code);
        if (label)
          return env.loadSvg(extractSymbolSvg((await loadSheet()).text, label, SYMBOL_SIZE));
        if (MANA_SYMBOL_IMAGES[upper]) return env.loadAsset(MANA_SYMBOL_IMAGES[upper]);
        if (TEXT_SYMBOLS[upper]) return env.loadAsset(`${TEXT_SYMBOLS[upper].icon}.svg`);
        return null;
      });
    },

    /** An icon by its config path ('types/creature'), or null if it can't be loaded. */
    icon(path) {
      return once(`icon:${path}`, () => env.loadAsset(`${path}.svg`));
    },

    /**
     * An icon, or a placeholder box with short text when it can't be loaded
     * (T-B3), so a missing icon is visible rather than silently absent.
     */
    async iconOrPlaceholder(path, text, size = 100) {
      return (await this.icon(path)) ?? placeholder(env, text, size);
    },

    /** A white icon recoloured, as a `size`-pixel square canvas. Cached. */
    tinted(image, colour, size = 200) {
      const key = `tint:${colour}:${size}`;
      const byImage = cache.get(key) ?? cache.set(key, new WeakMap()).get(key);
      if (!byImage.has(image)) byImage.set(image, tint(env, image, colour, size));
      return byImage.get(image);
    },
  };
}

function tint(env, image, colour, size) {
  const canvas = env.createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, size, size);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** White outlined box with `text`, standing in for a missing icon. */
function placeholder(env, text, size) {
  const canvas = env.createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = size / 25;
  ctx.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(size / 3.5)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);
  return canvas;
}
