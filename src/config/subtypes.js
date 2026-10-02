/**
 * Subtypes (D16, Requirements 5.5.5–5.5.10).
 *
 * Only cards that attach to another card get a subtype icon in the middle
 * stack, with no label. Basic land types show the mana symbol they tap for, in
 * their own group beside the text box. Every other subtype, creature types
 * included, shows only in the type line.
 */
export const SUBTYPE_ICONS = {
  Aura: { icon: 'subtypes/aura', placeholder: 'AUR' },
  Equipment: { icon: 'subtypes/equipment', placeholder: 'EQP' },
  Fortification: { icon: 'subtypes/fortification', placeholder: 'FRT' },
};

/** Basic land type → the mana symbol it taps for (5.5.8). */
export const LAND_TYPE_MANA = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
  Wastes: 'C',
};

/** Subtypes whose names contain a space, so the type-line parser keeps them whole. */
export const MULTI_WORD_SUBTYPES = ['Time Lord'];
