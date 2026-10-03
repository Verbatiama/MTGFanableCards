import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { OUT_DIR } from '../src/paths.js';
import {
  comparePngs,
  MAX_DIFFERENT,
  MOCKUP_FIXTURES,
  renderReference,
  VISUAL_DIR,
} from './fixtures/visual.js';

/**
 * Visual regression against the ten mockup cards (T-S4). A failure writes the
 * render and a diff to out/visual/; if the change was intended, run
 * `npm run visual:update` and commit the new references.
 */
for (const slug of MOCKUP_FIXTURES) {
  test(`${slug} looks like its approved reference (T-S4)`, async () => {
    const actual = await renderReference(slug);
    const expected = await readFile(path.join(VISUAL_DIR, `${slug}.png`));
    const { share, diff } = await comparePngs(actual, expected);
    if (share > MAX_DIFFERENT) {
      const dir = path.join(OUT_DIR, 'visual');
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${slug}-actual.png`), actual);
      await writeFile(path.join(dir, `${slug}-diff.png`), diff);
    }
    assert.ok(
      share <= MAX_DIFFERENT,
      `${(share * 100).toFixed(2)}% of pixels differ; see out/visual/${slug}-diff.png`,
    );
  });
}
