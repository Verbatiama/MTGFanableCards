/**
 * Badge shapes the renderer tints and numbers (T-B14): loyalty costs and
 * starting loyalty (7.2.1, 7.2.3, D22) and battle defense (5.7.7, D18).
 */
export const LOYALTY_BADGES = {
  up: { icon: 'badges/loyalty-up' },
  down: { icon: 'badges/loyalty-down' },
  zero: { icon: 'badges/loyalty-zero' },
  start: { icon: 'badges/loyalty-start' },
};

export const DEFENSE_BADGE = { icon: 'badges/defense' };

/** Badge fill colours; the number and outline are white. */
export const BADGE_COLOURS = { loyalty: '#3a3a3a', defense: '#7a1f1f' };
