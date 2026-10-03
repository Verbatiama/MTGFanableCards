/**
 * Re-renders the visual regression references (T-S4) into
 * test/fixtures/visual/ after an intended change. `npm run visual:update`
 * Review the changed images (listed) before committing them.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MOCKUP_FIXTURES, renderReference, VISUAL_DIR } from '../test/fixtures/visual.js';

const changed = [];
for (const slug of MOCKUP_FIXTURES) {
  const file = path.join(VISUAL_DIR, `${slug}.png`);
  const png = await renderReference(slug);
  const previous = await readFile(file).catch(() => null);
  if (!previous?.equals(png)) changed.push(path.relative(process.cwd(), file));
  await writeFile(file, png);
}
console.log(`Changed: ${changed.length ? changed.join(' ') : 'none'}`);
