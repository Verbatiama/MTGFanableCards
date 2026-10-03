/**
 * Text labels drawn on cards. English only for v1; kept here so translations
 * can be added without code changes (D24, Requirements 10.4). Zone/timing
 * labels live with their table (zone-symbols.js); subtype and supertype icons
 * have none. Every other word on a card comes from the card data.
 */
export const LABELS = {
  nonPermanent: 'NON-PERMANENT',
  loyalty: 'LOYALTY',
  defense: 'DEFENSE',
  power: 'PWR',
  toughness: 'TGH',
  /** The footer's copyright line (6.5.2); {year} is the year the image is generated. */
  copyright: '™ & © {year} Wizards of the Coast',
};
