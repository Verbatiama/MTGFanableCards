import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { FONT_DIR, SYMBOL_DIR } from '../src/index.js';

test('bundled fonts are where the renderer expects them', () => {
  assert.ok(existsSync(path.join(FONT_DIR, 'Beleren2016-Bold.ttf')));
});

test('mana symbol sheet is where the renderer expects it', () => {
  assert.ok(existsSync(path.join(SYMBOL_DIR, 'symbols.svg')));
});
