/**
 * Card type → icon (D14, Requirements 5.1). Icons are paths under res/symbols/
 * without the extension; `placeholder` is drawn until the icon exists (T-B14).
 * Types not listed here (Dungeon, Plane, Phenomenon, Scheme, Conspiracy,
 * Vanguard) are out of scope for v1 and get no icon (5.1.4). Several types
 * show in type-line order (5.1.3).
 *
 * `permanent` decides the NON-PERMANENT label (5.7.3): a card is a permanent
 * if any of its types is.
 */
export const CARD_TYPES = {
  Artifact: { icon: 'types/artifact', placeholder: 'ART', permanent: true },
  Battle: { icon: 'types/battle', placeholder: 'BTL', permanent: true },
  Creature: { icon: 'types/creature', placeholder: 'CRE', permanent: true },
  Enchantment: { icon: 'types/enchantment', placeholder: 'ENC', permanent: true },
  Instant: { icon: 'types/instant', placeholder: 'INS', permanent: false },
  Kindred: { icon: 'types/kindred', placeholder: 'KIN', permanent: false },
  Land: { icon: 'types/land', placeholder: 'LND', permanent: true },
  Planeswalker: { icon: 'types/planeswalker', placeholder: 'PW', permanent: true },
  Sorcery: { icon: 'types/sorcery', placeholder: 'SOR', permanent: false },
};

/** Whether a card with these types is a permanent (5.7.3). */
export const isPermanent = (types) => types.some((t) => CARD_TYPES[t]?.permanent);
