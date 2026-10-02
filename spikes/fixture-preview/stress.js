/**
 * Synthetic stress cases for the overflow rules: stat bar (D19, 4.4 / 5.6.3)
 * and text box (D20, 6.4.8). No real fixture overflows, so these take a real
 * card and pile on supertypes, zone symbols, mana rows or text. Preview only: they are not card-model fixtures,
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
  // Long rules text plus flavour text: the flavour text is dropped first, then
  // the rules text shrinks (D20, 6.4.8).
  'stress-drop-flavour': [
    'atraxa-grand-unifier',
    {
      flavorText:
        'Synthetic flavour text for the D20 stress case. It should never be drawn, because the rules text alone already fills the text box.',
    },
  ],
  // Land with a basic land type whose middle stack spills below the type line
  // far enough to push the land mana symbol down (D16 revised).
  'stress-land-push': [
    'dryad-arbor',
    {
      supertypes: ['Legendary', 'Snow', 'World'],
      zoneSymbols: ['flash', 'split-second', 'hand', 'library', 'graveyard'],
      manaCost: [
        { symbol: 'W', count: 1 },
        { symbol: 'U', count: 1 },
        { symbol: 'B', count: 1 },
        { symbol: 'R', count: 1 },
        { symbol: 'G', count: 1 },
      ],
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
    return [slug, { ...model, name: `${model.name} (stress)` }];
  });
}
