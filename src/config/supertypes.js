/**
 * Supertypes (D15, Requirements 5.5.1–5.5.4).
 *
 * `SUPERTYPES` is every supertype the type-line parser recognises.
 * `SUPERTYPE_ICONS` are the ones drawn in the middle stack, in type-line
 * order, as icons without labels. Snow uses the {S} mana symbol rather than its own icon.
 * Token, Ongoing, Elite and Host get no icon; planeswalkers show Legendary
 * like any card (5.5.3).
 */
export const SUPERTYPES = ['Basic', 'Legendary', 'Snow', 'World', 'Ongoing', 'Elite', 'Host'];

export const SUPERTYPE_ICONS = {
  Legendary: { icon: 'supertypes/legendary' },
  Basic: { icon: 'supertypes/basic' },
  // Not a supertype: every land that isn't basic shows it (T-S4, C9).
  Nonbasic: { icon: 'supertypes/nonbasic' },
  Snow: { manaSymbol: 'S' },
  World: { icon: 'supertypes/world' },
};
