import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAssets } from '../../src/render/assets.js';
import { nodeEnv } from '../../src/render/node.js';

const assets = createAssets(nodeEnv);

test('mana symbols come from the sheet, with Scryfall codes mapped to its labels', async () => {
  for (const code of ['U', '2', '15', 'X', 'C', 'S', 'T', 'Q', 'E', 'W/U', '2/W', 'B/P']) {
    const image = await assets.symbol(code);
    assert.ok(image?.width > 0, code);
  }
});

test('the generic symbol and the composed mana symbols load (D11, T-B14)', async () => {
  for (const code of ['generic', 'Y', 'Z', 'G/W/P', 'C/W']) {
    assert.ok((await assets.symbol(code))?.width > 0, code);
  }
});

test('text-box symbols load as icons; unknown codes give null for the text fallback', async () => {
  assert.ok((await assets.symbol('CHAOS'))?.width > 0);
  assert.equal(await assets.symbol('NOT-A-SYMBOL'), null);
});

test('symbols and icons are cached', async () => {
  assert.equal(await assets.symbol('U'), await assets.symbol('u'));
  assert.equal(await assets.icon('types/creature'), await assets.icon('types/creature'));
});

test('a missing icon is null, or a placeholder box when asked', async () => {
  assert.equal(await assets.icon('types/does-not-exist'), null);
  const placeholder = await assets.iconOrPlaceholder('types/does-not-exist', 'XYZ', 80);
  assert.equal(placeholder.width, 80);
  const real = await assets.iconOrPlaceholder('types/creature', 'CRE');
  assert.equal(real, await assets.icon('types/creature'));
});

test('tinting recolours a white icon, and is cached', async () => {
  const icon = await assets.icon('zones/flash');
  const red = assets.tinted(icon, '#ff0000', 100);
  const data = red.getContext('2d').getImageData(0, 0, 100, 100).data;
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 255) {
      opaque += 1;
      assert.deepEqual([data[i], data[i + 1], data[i + 2]], [255, 0, 0]);
    }
  }
  assert.ok(opaque > 100, 'the icon has solid pixels');
  assert.equal(assets.tinted(icon, '#ff0000', 100), red);
});
