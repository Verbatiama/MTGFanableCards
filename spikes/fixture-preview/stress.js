/**
 * Synthetic stress cases for the overflow rules: stat bar (D19, 4.4 / 5.6.3)
 * and text box (D20, 6.4.8). No real fixture overflows, so these take a real
 * card and pile on supertypes, zone symbols, mana rows or text. Preview only: they are not card-model fixtures,
 * and each name says it is a stress case.
 */
const STRESS = {
  // Five mana rows + five labelled middle icons on a card with nothing at the
  // bottom of the bar: a long stack hanging from the type line still fits
  // beside the text box with its labels (D19, 5.6.2).
  'stress-long-stack': [
    'concordant-crossroads',
    {
      manaCost: ['W', 'U', 'B', 'R', 'G'].map((symbol) => ({ symbol, count: 1 })),
      supertypes: ['Legendary', 'Snow'],
      zoneSymbols: ['flash', 'hand', 'graveyard'],
    },
  ],
  // Eight mana rows: too many to fit above the type line even with the pills
  // touching, so they close up fully, run past it, and push the LEGENDARY
  // icon down below them (5.3.11, 4.4). Reported as a warning.
  'stress-mana-rows': [
    'niv-mizzet-the-firemind',
    {
      manaCost: ['W', 'U', 'B', 'R', 'G', 'W/U', 'S', 'generic'].map((symbol) => ({
        symbol,
        count: 1,
      })),
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
  // Nine abilities, several long, and ±X costs: the bands shrink to the
  // minimum size, then the text box grows up into the art (D22, 7.2.6).
  'stress-many-abilities': [
    'jace-the-mind-sculptor',
    {
      oracleText: [
        'Spells your opponents cast that target Jace cost {2} more to cast.',
        "+2: Look at the top card of target player's library. You may put that card on the bottom of that player's library.",
        "+X: Draw X cards, then discard X cards. X can't be greater than the number of cards in your hand.",
        '0: Draw three cards, then put two cards from your hand on top of your library in any order. If you control another planeswalker, draw an additional card, then put it on the bottom of your library.',
        "−X: Return each creature with mana value X or less to its owner's hand. Each player who controls one or more of those creatures loses 2 life.",
        '+1: Up to one target creature gets -2/-0 until your next turn. Whenever a creature an opponent controls attacks you or a planeswalker you control this turn, tap it.',
        '−2: Target player reveals the top five cards of their library. You may exile any number of them face down. Then that player puts the rest into their graveyard in any order.',
        '−7: You get an emblem with "Whenever you cast a spell, copy it. You may choose new targets for the copy. Instants and sorceries you cast this way cost {1} less."',
        '−12: Exile all cards from target player\'s library, then that player shuffles their hand into their library. You get an emblem with "At the beginning of your upkeep, each opponent mills ten cards."',
      ].join('\n'),
    },
  ],
  // Creature land with a basic land type and the non-basic icon: too tall for
  // the little room above its large stats
  // (T-S4, C1) even without labels, so the icons shrink, and the stack pushes
  // the land mana symbol down (D16 revised, D19).
  'stress-land-push': [
    'dryad-arbor',
    {
      supertypes: [],
      zoneSymbols: [],
      manaCost: [
        { symbol: 'W', count: 1 },
        { symbol: 'U', count: 1 },
        { symbol: 'B', count: 1 },
        { symbol: 'R', count: 1 },
        { symbol: 'G', count: 1 },
      ],
    },
  ],
  // Planeswalker: the stack stays beside the type line (loyalty costs use the
  // bar beside the text box), which fits one icon but not its label, so the
  // FLASH label drops.
  'stress-drop-labels': ['ajani-sleeper-agent', { supertypes: [], zoneSymbols: ['flash'] }],
  // Planeswalker with the crown and FLASH: two icons only fit beside the type
  // line once they shrink.
  'stress-shrink': ['ajani-sleeper-agent', { zoneSymbols: ['flash'] }],
};

/** @param {Map<string, object>} fixtures */
export function stressModels(fixtures) {
  return Object.entries(STRESS).map(([slug, [base, changes]]) => {
    const model = { ...fixtures.get(base), ...changes };
    return [slug, { ...model, name: `${model.name} (stress)` }];
  });
}
