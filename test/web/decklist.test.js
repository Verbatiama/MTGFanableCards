import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPreviewable,
  lineAt,
  lineStart,
  replaceInLine,
  reportProblems,
} from '../../web/src/decklist.js';

const deck = '4 Lightning Bolt\n\n2 Delver of Secrets';

test('lineAt finds the line under the caret', () => {
  assert.deepEqual(lineAt(deck, 0), { index: 0, start: 0, text: '4 Lightning Bolt' });
  assert.deepEqual(lineAt(deck, 16), { index: 0, start: 0, text: '4 Lightning Bolt' });
  assert.deepEqual(lineAt(deck, 17), { index: 1, start: 17, text: '' });
  assert.deepEqual(lineAt(deck, deck.length), { index: 2, start: 18, text: '2 Delver of Secrets' });
});

test('lineStart gives the offset of a 1-based line', () => {
  assert.equal(lineStart(deck, 1), 0);
  assert.equal(lineStart(deck, 3), 18);
  assert.equal(lineStart(deck, 9), deck.length);
});

test('blank lines and comments are not previewed', () => {
  assert.equal(isPreviewable('  '), false);
  assert.equal(isPreviewable('// Sideboard'), false);
  assert.equal(isPreviewable('# note'), false);
  assert.equal(isPreviewable('Lightning Bolt'), true);
});

test('a suggestion replaces the name on its line only', () => {
  const text = 'Lightnig Bolt\n2 Lightnig Bolt (M10)';
  assert.equal(
    replaceInLine(text, 1, 'Lightnig Bolt', 'Lightning Bolt'),
    'Lightnig Bolt\n2 Lightning Bolt (M10)',
  );
});

test('job problems are listed by line, render warnings last (3.2.6)', () => {
  const problems = reportProblems({
    errors: [{ lineNumber: 4, line: '0 Bolt', error: 'Quantity must be at least 1' }],
    unmatched: [
      {
        lineNumber: 2,
        line: 'Lightnig Bolt',
        name: 'Lightnig Bolt',
        suggestions: ['Lightning Bolt'],
      },
    ],
    fallbacks: [],
    skipped: [
      { lineNumber: 3, line: 'Fire // Ice', name: 'Fire // Ice', reason: 'Fire // Ice: split' },
    ],
    renderWarnings: [{ fileName: 'X.png', warning: 'text box: too long' }],
  });
  assert.deepEqual(
    problems.map((p) => [p.lineNumber, p.message]),
    [
      [2, 'No card named "Lightnig Bolt"'],
      [3, 'Fire // Ice: split; skipped'],
      [4, 'Quantity must be at least 1: 0 Bolt'],
      [null, 'X.png: text box: too long'],
    ],
  );
  assert.deepEqual(problems[0].suggestions, ['Lightning Bolt']);
});
