/**
 * Scryfall's set SVGs have only a viewBox; give them a large pixel size so they
 * rasterise sharply (node-canvas would use a tiny default size, and some
 * browsers can't draw an SVG image without one). Works on the SVG source, so
 * it runs in Node and the browser alike.
 * @param {string} svg
 * @param {number} [height]
 * @returns {string}
 */
export function sizeSvg(svg, height = 120) {
  const box = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!box || /<svg[^>]*\swidth=/.test(svg)) return svg;
  const width = Math.round((height * Number(box[1])) / Number(box[2]));
  return svg.replace('<svg ', `<svg width="${width}" height="${height}" `);
}
