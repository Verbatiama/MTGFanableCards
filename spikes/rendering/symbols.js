/**
 * Cuts a single symbol out of the res/symbols/symbols.svg sheet.
 *
 * The sheet is an Inkscape grid of 100×100 cells at a 105px pitch, one group
 * per symbol, labelled with the symbol code (`inkscape:label="r"`). Rather
 * than rewriting the SVG tree, we keep the whole sheet and move the viewBox
 * onto the symbol's cell, so styles and clip paths keep working.
 *
 * Pure string work, so it runs in Node and in the browser.
 *
 * The sheet styles its shapes with CSS classes in a <style> block. librsvg
 * (node-canvas) and browsers honour that, but Skia's SVG module
 * (@napi-rs/canvas) ignores it and draws everything black, so the classes are
 * inlined as presentation attributes first.
 */
const CELL = 100;
const PITCH = 105;

export function extractSymbolSvg(sheet, code, size = 100) {
  const { x, y } = symbolCell(sheet, code);
  return inlineClassStyles(sheet).replace(
    /viewBox="[^"]*"/,
    `viewBox="${x} ${y} ${CELL} ${CELL}" width="${size}" height="${size}"`,
  );
}

/**
 * Finds a symbol's grid cell from the first coordinate inside its group: a
 * circle centre for plain symbols, or a path's start point for hybrids, which
 * are drawn as two half-circles.
 */
export function symbolCell(sheet, code) {
  const label = `inkscape:label="${code}"`;
  const start = sheet.indexOf(label);
  if (start === -1) throw new Error(`Symbol "${code}" not found in sheet`);
  const next = sheet.indexOf('inkscape:label="', start + label.length);
  const group = sheet.slice(start, next === -1 ? undefined : next);

  const point = /cx="([\d.]+)"\s+cy="([\d.]+)"|\sd="M\s*([\d.]+)[,\s]+([\d.]+)/.exec(group);
  if (!point) throw new Error(`Symbol "${code}" has no shapes`);
  const [px, py] = (point[1] ? point.slice(1, 3) : point.slice(3, 5)).map(Number);
  return { x: Math.floor(px / PITCH) * PITCH, y: Math.floor(py / PITCH) * PITCH };
}

export function listSymbolCodes(sheet) {
  return [...sheet.matchAll(/inkscape:label="([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Replaces `class="stN"` with the attributes from the sheet's <style> block.
 * A property the element already sets as an attribute is not added again:
 * a duplicate attribute is invalid XML and librsvg rejects the whole file.
 * In the current sheet this only affects one clipPath whose attribute and
 * class give the same clip-path, so the output is unchanged.
 */
export function inlineClassStyles(svg) {
  const styleBlock = /<style[^>]*>([\s\S]*?)<\/style>/.exec(svg);
  if (!styleBlock) return svg;

  const rules = new Map();
  for (const [, name, body] of styleBlock[1].matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
    const decls = body
      .split(';')
      .map((decl) => decl.split(':').map((part) => part.trim()))
      .filter(([prop, value]) => prop && value);
    rules.set(name, decls);
  }

  return svg.replace(styleBlock[0], '').replace(/<[\w:]+\b[^>]*\sclass="[^"]+"[^>]*>/g, (tag) => {
    const names = /\sclass="([^"]+)"/.exec(tag)[1].split(/\s+/);
    const existing = new Set([...tag.matchAll(/\s([\w:-]+)=/g)].map((m) => m[1]));
    const attrs = names
      .flatMap((n) => rules.get(n) ?? [])
      .filter(([prop]) => !existing.has(prop))
      .map(([prop, value]) => `${prop}="${value}"`)
      .join(' ');
    return tag.replace(/\sclass="[^"]+"/, attrs ? ` ${attrs}` : '');
  });
}
