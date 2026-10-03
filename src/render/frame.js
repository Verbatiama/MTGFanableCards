import { FRAME, LAND_FRAME } from '../config/frames.js';
import {
  ART,
  ART_FADE,
  BOX,
  FULL_ART_BASIC,
  NAME,
  TEXT,
  TEXT_SIZE,
  TYPE,
} from '../config/layout.js';
import { fitFont, textFont } from './fonts.js';

/**
 * Card-box frame (T-B4, D20, D21, T-S4; Requirements 6.1–6.3, 6.6): name
 * bar, art box, type line with the set symbol, and the text box background,
 * each with a coloured pinline, on black, in the mockups' colours (C18).
 * Basic lands are full-art (C21).
 */

/**
 * The frame colours for a card (D21), as plain data: each part is one colour,
 * or two for a left-to-right blend.
 *
 * - Lands: pink-tan bars; pinlines and text box from the card's colour, or
 *   else the colours it taps for. Two colours blend; three or more, or "any
 *   color", are gold; none, brown pinlines and a grey-beige text box.
 * - One colour: that colour's frame.
 * - Two-colour hybrid (Phyrexian hybrid too): border, pinlines and text box
 *   split by the hybrid symbol's colours, grey bars, paler text box.
 * - Other multicolour: gold, with pinlines in the card's two colours (gold for
 *   three or more).
 * - Colourless: the artifact frame for artifacts, the colourless frame
 *   otherwise. Devoid (no colour, but coloured mana in its cost) has its
 *   own pale pinlines, grey bars and grey-beige text box.
 *
 * @param {import('../model/card-model.js').CardModel} model
 * @returns {{ pin: string[], bar: string, text: string[] }}
 */
export function framePalette(model) {
  const one = (p) => ({ pin: [p.pin], bar: p.bar, text: [p.text] });

  if (model.types.includes('Land')) {
    const colours = model.colors.length ? model.colors : producedColours(model);
    const parts = !colours.length
      ? [LAND_FRAME]
      : (colours.length > 2 ? [FRAME.gold] : colours.map((c) => FRAME[c])).map((p) => ({
          pin: p.pin,
          text: mix(LAND_FRAME.text, p.text, 0.5),
        }));
    return {
      pin: parts.map((p) => p.pin),
      bar: LAND_FRAME.bar,
      text: parts.map((p) => p.text),
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
        pin: sides.map((s) => s.pin),
        bar: FRAME.hybridBar,
        text: sides.map((s) => mix(s.text, FRAME.hybridText, 0.5)),
      };
    }
    const printed = manaColours(model).filter((c) => colors.includes(c));
    const pair = printed.length === 2 ? printed : colors;
    return { ...one(FRAME.gold), pin: pair.map((c) => FRAME[c].pin) };
  }
  if (colors.length > 2) return one(FRAME.gold);

  if (manaColours(model).length) return one(FRAME.devoid);
  return one(model.types.includes('Artifact') ? FRAME.artifact : FRAME.colourless);
}

/** Colours in a mana cost, in printed order. */
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

/** Width of a pinline, outside the panel it surrounds. */
const PIN = 6;
/** Corner radius of the name and type bars. */
const BAR_RADIUS = 16;

/** A panel: its fill, a light texture, and a dark edge inside its pinline. */
function panel(ctx, env, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = texture(ctx, env);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function pinline(ctx, pin, x, y, w, h, r) {
  ctx.strokeStyle = pin;
  ctx.lineWidth = PIN;
  ctx.beginPath();
  ctx.roundRect(x - PIN / 2, y - PIN / 2, w + PIN, h + PIN, r + PIN / 2);
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

/**
 * The art box on its own canvas, fading in from transparent at ART_FADE.from
 * to opaque at ART_FADE.to, over black. The fade eases in and out
 * (smoothstep), so neither end shows as a line. Like the mockups, the art has
 * no pinline. A full-art basic land darkens towards the bottom, from `shade`,
 * so the white type line reads (C21).
 */
function fadedArt(env, art, box, shade = null) {
  const layer = env.createCanvas(box.w + PIN * 2, box.h + PIN * 2);
  const ctx = layer.getContext('2d');
  // Card coordinates, so the fade lines up with the card.
  ctx.translate(PIN - box.x, PIN - box.y);
  ctx.fillStyle = '#000';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  if (art) drawCover(ctx, art, box);
  if (shade !== null) {
    const dark = ctx.createLinearGradient(0, shade, 0, box.y + box.h);
    dark.addColorStop(0, 'rgba(0,0,0,0)');
    dark.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = dark;
    ctx.fillRect(box.x, shade, box.w, box.y + box.h - shade);
  }
  const fade = ctx.createLinearGradient(ART_FADE.from, 0, ART_FADE.to, 0);
  const steps = 32;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fade.addColorStop(t, `rgba(0,0,0,${t * t * (3 - 2 * t)})`);
  }
  const all = [box.x - PIN, box.y - PIN, box.w + PIN * 2, box.h + PIN * 2];
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = fade;
  ctx.fillRect(...all);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(ART_FADE.from - PIN, all[1], ART_FADE.to - ART_FADE.from + PIN, all[3]);
  return layer;
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
    pin: acrossBox(ctx, palette.pin),
    text: acrossBox(ctx, palette.text),
  };
  const width = BOX.right - BOX.x;
  const fullArt = isFullArt(model);

  // Art box (3.4), fading in from the left (ART_FADE). A full-art basic land's
  // art runs down to the bottom of the text box (C21).
  const artBottom = fullArt ? text.y + text.h : art_.y + art_.h;
  const artBox = { x: ART.x, y: art_.y, w: ART.w, h: artBottom - art_.y };
  // A planeswalker's text box can grow over all of it (T-B11): nothing to draw.
  if (art_.h > 0) {
    const shade = fullArt ? FULL_ART_BASIC.shade : null;
    const layer = fadedArt(env, art, artBox, shade);
    ctx.drawImage(layer, artBox.x - PIN, artBox.y - PIN);
    layer.width = 0; // free its pixels now (T-S6)
  }

  // Name bar.
  ctx.fillStyle = palette.bar;
  pinline(ctx, fill.pin, BOX.x, NAME.y, width, NAME.h, BAR_RADIUS);
  panel(ctx, env, BOX.x, NAME.y, width, NAME.h, BAR_RADIUS);
  ctx.fillStyle = '#111';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fitFont(ctx, model.name, width - 30, TEXT_SIZE.name, textFont);
  ctx.fillText(model.name, BOX.x + 14, NAME.y + NAME.h / 2 + 2);

  if (fullArt) {
    // The type line's text alone, white over the art (C21).
    const { typeY, typeSize } = FULL_ART_BASIC;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    fitFont(ctx, model.typeLine, width - 40, typeSize, textFont);
    ctx.fillText(model.typeLine, BOX.x + width / 2, typeY);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    return { palette };
  }

  // Type line, with the set symbol at its right end (6.3).
  ctx.fillStyle = palette.bar;
  pinline(ctx, fill.pin, BOX.x, type.y, width, type.h, BAR_RADIUS);
  panel(ctx, env, BOX.x, type.y, width, type.h, BAR_RADIUS);
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
  const box = [BOX.x + 6, text.y, width - 12, text.h];
  pinline(ctx, fill.pin, ...box, 0);
  ctx.fillStyle = fill.text;
  panel(ctx, env, ...box, 0);
  return { palette };
}

/** Basic lands are drawn full-art, like the mockup's Forest (6.4.4, C21). */
export const isFullArt = (model) => model.supertypes.includes('Basic');
