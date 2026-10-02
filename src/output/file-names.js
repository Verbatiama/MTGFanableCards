/**
 * Output file names (T-A11, D4, Requirements 3.5.2, 3.5.4).
 *
 * Each image is named after its card face: `Lightning-Bolt.png`. Repeats get a
 * counter (`Lightning-Bolt-2.png`), so `4 Lightning Bolt` gives four files, and
 * each face of a double-faced card gets its own name (`Delver-of-Secrets.png`,
 * `Insectile-Aberration.png`).
 */

/** "Jace, the Mind Sculptor" → "Jace-the-Mind-Sculptor"; accents and punctuation dropped. */
export function baseFileName(name) {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’,.!?"]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'card';
}

/**
 * Gives every image a unique file name, in order.
 * @param {string[]} faceNames Face name of each image, in output order.
 * @param {string} [extension]
 * @returns {string[]}
 */
export function assignFileNames(faceNames, extension = 'png') {
  const used = new Map();
  return faceNames.map((name) => {
    const base = baseFileName(name);
    const count = (used.get(base.toLowerCase()) ?? 0) + 1;
    used.set(base.toLowerCase(), count);
    return `${count === 1 ? base : `${base}-${count}`}.${extension}`;
  });
}
