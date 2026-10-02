/**
 * Synthetic stat-bar stress cases for the overflow rules (D19, 4.4 / 5.6.3).
 * No real fixture collides, so these take a real card and pile on supertypes,
 * zone symbols and mana rows. Preview only: they are not card-model fixtures,
 * and each name says it is a stress case.
 */
const STRESS = {
  // Five mana rows + five labelled middle icons: spills below the type line.
  'stress-spill': [
    'atraxa-grand-unifier',
    {
      supertypes: ['Legendary', 'Snow'],
      zoneSymbols: ['flash', 'hand', 'graveyard'],
    },
  ],
  // Planeswalker: can't spill (loyalty costs use the bar below the type line),
  // so the labels are dropped.
  'stress-drop-labels': [
    'ajani-sleeper-agent',
    {
      supertypes: ['Legendary', 'Snow'],
      zoneSymbols: ['flash', 'hand', 'graveyard'],
      manaCost: [
        { symbol: 'W', count: 1 },
        { symbol: 'U', count: 1 },
        { symbol: 'B', count: 1 },
        { symbol: 'R', count: 1 },
        { symbol: 'G', count: 1 },
      ],
    },
  ],
  // Planeswalker with even more: labels dropped and icons shrunk.
  'stress-shrink': [
    'ajani-sleeper-agent',
    {
      supertypes: ['Legendary', 'Snow', 'World'],
      zoneSymbols: ['flash', 'split-second', 'hand', 'library', 'graveyard'],
      manaCost: [
        { symbol: 'W', count: 1 },
        { symbol: 'U', count: 1 },
        { symbol: 'B', count: 1 },
        { symbol: 'R', count: 1 },
        { symbol: 'G', count: 1 },
        { symbol: 'generic', count: 2 },
      ],
    },
  ],
};

/** @param {Map<string, object>} fixtures */
export function stressModels(fixtures) {
  return Object.entries(STRESS).map(([slug, [base, changes]]) => {
    const model = { ...fixtures.get(base), ...changes };
    return [slug, { ...model, name: `${model.name} (D19 stress)` }];
  });
}
