/**
 * Mechanic → zone/timing symbol table (D12, Requirements 5.4.2). New mechanics
 * are added here. Keywords are Scryfall's names, matched case-insensitively.
 */
export const ZONE_KEYWORDS = {
  flash: ['Flash'],
  'split-second': ['Split second'],
  hand: [
    'Cycling', // and every "-cycling" variant, see isCycling
    'Channel',
    'Ninjutsu',
    'Commander ninjutsu',
    'Transmute',
    'Forecast',
    'Bloodrush',
    'Reinforce',
    'Madness',
    'Suspend',
    'Foretell',
    'Plot',
    'Warp', // cast from hand, exiled, recast later: like plot and foretell (D12)
  ],
  library: ['Miracle'],
  graveyard: [
    'Flashback',
    'Unearth',
    'Escape',
    'Disturb',
    'Embalm',
    'Eternalize',
    'Retrace',
    'Jump-start',
    'Scavenge',
    'Encore',
    'Dredge',
    'Aftermath',
  ],
};

/** Swampcycling, Basic landcycling, Wizardcycling, ... all count as cycling. */
export const isCycling = (keyword) => /cycling$/i.test(keyword);

/**
 * Oracle phrases for abilities without a keyword, where the card refers to
 * itself in a zone (5.4.3–5.4.4). `SELF` is replaced by "this card" or the
 * card's name.
 */
export const ZONE_PHRASES = {
  hand: ['SELF (?:is )?(?:from|in) your hand'],
  // Not "put this card on top of your library": that moves the card, it doesn't
  // work from there.
  library: ['SELF from (?:the )?top of your library', 'SELF is on (?:the )?top of your library'],
  graveyard: ['SELF (?:is )?(?:from|in) your graveyard'],
};
