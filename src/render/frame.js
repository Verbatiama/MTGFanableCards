import { FRAME, LAND_FRAME } from '../config/frames.js';
import { ART, BOX, FOOTER, FRAME_TOP, NAME, TEXT, TEXT_SIZE, TYPE } from '../config/layout.js';
import { fitFont, textFont } from './fonts.js';

/**
 * Card-box frame (T-B4, D20, D21; Requirements 6.1–6.3, 6.6): border,
 * pinlines, name bar, art box, type line with the set symbol, and the text
 * box background, in the colours of real cards.
 */

/**
 * The frame colours for a card (D21), as plain data: each part is one colour,
 * or two for a left-to-right blend.
 *
 * - Lands: stone border; pinlines, bars and text box from the card's colour,
 *   or else the colours it taps for. Two colours blend with grey bars; three
 *   or more, or "any color", are gold.
 * - One colour: that colour's frame.
 * - Two-colour hybrid (Phyrexian hybrid too): border, pinlines and text box
 *   split by the hybrid symbol's colours, grey bars, paler text box.
 * - Other multicolour: gold, with pinlines in the card's two colours (gold for
 *   three or more).
 * - Colourless: the artifact frame for artifacts, the colourless frame
 *   otherwise. Devoid shows its art through a translucent border tinted by
 *   its mana.
 *
 * @param {import('../model/card-model.js').CardModel} model
 * @returns {{ border: string[], pin: string[], bar: string, text: string[], devoid: boolean }}
 */
export function framePalette(model) {
  const one = (p) => ({
    border: [p.border],
    pin: [p.pin],
    bar: p.bar,
    text: [p.text],
    devoid: false,
  });

  if (model.types.includes('Land')) {
    const colours = model.colors.length ? model.colors : producedColours(model);
    const parts = !colours.length
      ? [LAND_FRAME.colourless]
      : colours.length > 2
        ? [LAND_FRAME.gold]
        : colours.map((c) => LAND_FRAME[c]);
    return {
      border: [LAND_FRAME.stone],
      pin: parts.map((p) => p.pin),
      bar: parts.length === 2 ? LAND_FRAME.splitBar : parts[0].bar,
      text: parts.map((p) => p.text),
      devoid: false,
    };
  }

  const { colors } = model;
  if (colors.length === 1) return one(FRAME[colors[0]]);
  if (colors.length === 2) {
    const hybrid = (model.manaCost ?? []).find((m) => /^[WUBRG]\/[WUBRG](\/P)?$/.test(m.symbol));
    if (hybrid) {
      const sides = hybrid.symbol
        .split('/')
        .slice(0, 2)
        .map((c) => FRAME[c]);
      return {
        border: sides.map((s) => s.border),
        pin: sides.map((s) => s.pin),
        bar: FRAME.hybridBar,
        text: sides.map((s) => mix(s.text, FRAME.hybridText, 0.5)),
        devoid: false,
      };
    }
    const printed = manaColours(model).filter((c) => colors.includes(c));
    const pair = printed.length === 2 ? printed : colors;
    return { ...one(FRAME.gold), pin: pair.map((c) => FRAME[c].pin) };
  }
  if (colors.length > 2) return one(FRAME.gold);

  const tints = manaColours(model);
  if (tints.length) {
    const tint = tints.length > 2 ? FRAME.gold.border : FRAME[tints[0]].border;
    return {
      border: [hexAlpha(mix('#c8c0a8', tint, 0.3), 0.5)],
      pin: [FRAME.devoid.pin],
      bar: FRAME.devoid.bar,
      text: [FRAME.devoid.text],
      devoid: true,
    };
  }
  return one(model.types.includes('Artifact') ? FRAME.artifact : FRAME.colourless);
}

/** Colours in a mana cost, in printed order (a devoid card's tint). */
export function manaColours(model) {
  const found = (model.manaCost ?? []).flatMap((m) => m.symbol.match(/[WUBRG]/g) ?? []);
  return [...new Set(found)];
}

/**
 * Colours a land taps for, from its "Add ..." clauses and basic land types, in
 * the order found. "Any color" counts as all five.
 */
export function producedColours(model) {
  const found = [];
  for (const [clause] of model.oracleText.matchAll(/Add [^.]*/g)) {
    if (/any colou?r/i.test(clause)) return [...'WUBRG'];
    found.push(...[...clause.matchAll(/\{([WUBRG])\}/g)].map((m) => m[1]));
  }
  const landTypes = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };
  found.push(...model.subtypes.map((t) => landTypes[t]).filter(Boolean));
  return [...new Set(found)];
}

/** Blend two '#rrggbb' colours; `amount` 0 = a, 1 = b. */
export function mix(a, b, amount) {
  const [x, y] = [a, b].map((hex) => parseInt(hex.slice(1), 16));
  const channel = (shift) =>
    Math.round(((x >> shift) & 255) * (1 - amount) + ((y >> shift) & 255) * amount);
  return `#${[16, 8, 0].map((sh) => channel(sh).toString(16).padStart(2, '0')).join('')}`;
}

function hexAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** One colour, or a left-to-right blend across the card box. */
function acrossBox(ctx, colours) {
  if (colours.length === 1) return colours[0];
  const gradient = ctx.createLinearGradient(BOX.x, 0, BOX.right, 0);
  gradient.addColorStop(0.3, colours[0]);
  gradient.addColorStop(0.7, colours[1]);
  return gradient;
}

const textures = new WeakMap();
/** Seeded transparent speckles laid over every border, for its texture. */
function texture(ctx, env) {
  if (!textures.has(env)) {
    const canvas = env.createCanvas(240, 240);
    const t = canvas.getContext('2d');
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 900; i++) {
      t.fillStyle = rand() < 0.55 ? 'rgba(70,50,35,0.18)' : 'rgba(245,230,205,0.22)';
      t.beginPath();
      t.ellipse(
        rand() * 240,
        rand() * 240,
        2 + rand() * 9,
        1 + rand() * 4,
        rand() * 3,
        0,
        Math.PI * 2,
      );
      t.fill();
    }
    textures.set(env, canvas);
  }
  return ctx.createPattern(textures.get(env), 'repeat');
}

function panel(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function pinline(ctx, pin, x, y, w, h, r) {
  ctx.strokeStyle = pin;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x - 2, y - 2, w + 4, h + 4, r + 2);
  ctx.stroke();
}

/**
 * Scales the art to cover the box and trims the overflow evenly from both
 * sides (3.4.2).
 */
export function drawCover(ctx, image, box) {
  const scale = Math.max(box.w / image.width, box.h / image.height);
  const sw = box.w / scale;
  const sh = box.h / scale;
  ctx.drawImage(
    image,
    (image.width - sw) / 2,
    (image.height - sh) / 2,
    sw,
    sh,
    box.x,
    box.y,
    box.w,
    box.h,
  );
}

/** Set symbol height on the type line (6.3.2). */
const SET_SYMBOL_HEIGHT = 30;

/**
 * Draws the frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../model/card-model.js').CardModel} model
 * @param {object} options
 * @param {object} options.env Render environment (createCanvas).
 * @param {any} [options.art] Art image, or null for the black placeholder (3.4.1).
 * @param {any} [options.setSymbol] Set symbol image, plain black (D20); the set code when null.
 * @param {{ art: object, type: object, text: object }} [options.layout] Bands; planeswalkers move them (T-B11).
 */
export function drawFrame(ctx, model, { env, art = null, setSymbol = null, layout = {} }) {
  const art_ = layout.art ?? ART;
  const type = layout.type ?? TYPE;
  const text = layout.text ?? TEXT;
  const palette = framePalette(model);
  const fill = {
    border: acrossBox(ctx, palette.border),
    pin: acrossBox(ctx, palette.pin),
    text: acrossBox(ctx, palette.text),
  };
  const width = BOX.right - BOX.x;

  // Border: colour (or the art showing through, for devoid) plus texture.
  const frame = { x: BOX.x - 4, y: FRAME_TOP, w: width + 8, h: FOOTER.y - FRAME_TOP };
  if (palette.devoid && art) drawCover(ctx, art, frame);
  ctx.fillStyle = fill.border;
  ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
  ctx.fillStyle = texture(ctx, env);
  ctx.fillRect(frame.x, frame.y, frame.w, frame.h);

  // Name bar.
  ctx.fillStyle = palette.bar;
  pinline(ctx, fill.pin, BOX.x, NAME.y, width, NAME.h, 10);
  panel(ctx, BOX.x, NAME.y, width, NAME.h, 10);
  ctx.fillStyle = '#111';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fitFont(ctx, model.name, width - 30, TEXT_SIZE.name, textFont);
  ctx.fillText(model.name, BOX.x + 14, NAME.y + NAME.h / 2 + 2);

  // Art box (3.4).
  const artBox = { x: BOX.x + 6, y: art_.y, w: width - 12, h: art_.h };
  pinline(ctx, fill.pin, artBox.x, artBox.y, artBox.w, artBox.h, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(artBox.x, artBox.y, artBox.w, artBox.h);
  if (art) drawCover(ctx, art, artBox);

  // Type line, with the set symbol at its right end (6.3).
  ctx.fillStyle = palette.bar;
  pinline(ctx, fill.pin, BOX.x, type.y, width, type.h, 10);
  panel(ctx, BOX.x, type.y, width, type.h, 10);
  const symbolRight = BOX.right - 14;
  let symbolWidth;
  if (setSymbol) {
    symbolWidth = (SET_SYMBOL_HEIGHT * setSymbol.width) / setSymbol.height;
    const top = type.y + (type.h - SET_SYMBOL_HEIGHT) / 2;
    ctx.drawImage(setSymbol, symbolRight - symbolWidth, top, symbolWidth, SET_SYMBOL_HEIGHT);
  } else {
    // No symbol: the set code stands in for it.
    ctx.fillStyle = '#111';
    ctx.font = textFont(16);
    ctx.textAlign = 'right';
    ctx.fillText(model.setCode, symbolRight, type.y + type.h / 2 + 1);
    symbolWidth = ctx.measureText(model.setCode).width;
    ctx.textAlign = 'left';
  }
  ctx.fillStyle = '#111';
  fitFont(ctx, model.typeLine, width - 28 - symbolWidth - 12, TEXT_SIZE.typeLine, textFont);
  ctx.fillText(model.typeLine, BOX.x + 14, type.y + type.h / 2 + 2);

  // Text box background; its contents are drawn by the text box (T-B5).
  pinline(ctx, fill.pin, BOX.x + 6, text.y, width - 12, text.h, 0);
  ctx.fillStyle = fill.text;
  ctx.fillRect(BOX.x + 6, text.y, width - 12, text.h);
  return { palette };
}
