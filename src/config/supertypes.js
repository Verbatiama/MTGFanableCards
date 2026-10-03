/**
 * Supertypes (D15, Requirements 5.5.1–5.5.4).
 *
 * `SUPERTYPES` is every supertype the type-line parser recognises.
 * `SUPERTYPE_ICONS` are the ones drawn in the middle stack, with their label,
 * in type-line order. The Legendary crown has no label. Snow uses the {S} mana symbol rather than its own icon.
 * Token, Ongoing, Elite and Host get no icon; planeswalkers show Legendary
 * like any card (5.5.3).
 */
export const SUPERTYPES = ['Basic', 'Legendary', 'Snow', 'World', 'Ongoing', 'Elite', 'Host'];

export const SUPERTYPE_ICONS = {
  Legendary: { icon: 'supertypes/legendary', label: null },
  Basic: { icon: 'supertypes/basic', label: 'BASIC' },
  Snow: { manaSymbol: 'S', label: 'SNOW' },
  World: { icon: 'supertypes/world', label: 'WORLD' },
};
