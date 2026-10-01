import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCardModel } from '../src/model/card-model.js';
import { MOCKUP_FIXTURES, fixtureSlug, loadCardFixtures } from './fixtures/cards.js';

const fixtures = loadCardFixtures();

test('every card fixture is a valid card model', () => {
  for (const [slug, model] of fixtures) {
    assert.deepEqual(validateCardModel(model), [], slug);
  }
});

test('card fixture files are named after the face', () => {
  for (const [slug, model] of fixtures) {
    assert.equal(fixtureSlug(model.name), slug);
  }
});

test('all ten mockup cards have a fixture', () => {
  for (const slug of MOCKUP_FIXTURES) assert.ok(fixtures.has(slug), slug);
});

test('double-faced fixtures include both faces of the same printing', () => {
  const faces = [...fixtures.values()].filter((m) => ['transform', 'modal_dfc'].includes(m.layout));
  assert.ok(faces.length > 0);
  for (const face of faces) {
    const other = faces.find(
      (m) =>
        m !== face &&
        m.setCode === face.setCode &&
        m.collectorNumber === face.collectorNumber &&
        m.faceIndex === 1 - face.faceIndex,
    );
    assert.ok(other, `${face.name} has no matching face`);
  }
});
