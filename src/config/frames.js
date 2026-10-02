/**
 * Frame colours (D21, Requirements 6.6), matching real cards in the current
 * frame: a textured border, coloured pinlines around each panel, pale
 * name/type bars and a pale text box. Sampled from Scryfall scans: Pacifism
 * (DVD), Divination (M15), Murder (EMN), Shock (DDN), Giant Growth (EVG),
 * Lightning Helix (DDN), Mind Stone (C14), Thought-Knot Seer (OGW), Kitchen
 * Finks (UMA) and Complete Disregard (BFZ); the three-colour gold pinline from
 * Mantis Rider (KTK) and Bant Charm (2X2).
 */
export const FRAME = {
  W: { border: '#cdbe9c', pin: '#e9ebe0', bar: '#ebe9df', text: '#f2f0e5' },
  U: { border: '#669ecb', pin: '#1a78b6', bar: '#b6d0d8', text: '#d5e3e7' },
  B: { border: '#232728', pin: '#333331', bar: '#c8c6c8', text: '#eff4f6' },
  R: { border: '#c03c2b', pin: '#e4321e', bar: '#efbba3', text: '#efd3c6' },
  G: { border: '#557054', pin: '#256a40', bar: '#b0bbae', text: '#cddcce' },
  gold: { border: '#d0b056', pin: '#e9d875', bar: '#d2b16e', text: '#f5f3e7' },
  artifact: { border: '#95a3ae', pin: '#dfe0e2', bar: '#cfcfd3', text: '#d2d5d8' },
  colourless: { border: '#89807a', pin: '#e2dfe6', bar: '#b2a8a7', text: '#d8d2c6' },
  // Hybrid cards: grey bars, and a text box paler than either colour's.
  hybridBar: '#d8d3d1',
  hybridText: '#f4f4f2',
  // Devoid: the art shows through a translucent border and text box.
  devoid: { pin: '#e2e1c3', bar: '#a69c97', text: 'rgba(211, 209, 197, 0.88)' },
};

/**
 * Land frames: every land has the same stone border; the colour is in the
 * pinlines, bars and text box. Sampled from the M19 basics, Wasteland (EMA),
 * Command Tower (CMR) and Breeding Pool (RNA).
 */
export const LAND_FRAME = {
  stone: '#b49679',
  colourless: { pin: '#9e8a7e', bar: '#d6ced2', text: '#d5cfd4' },
  W: { pin: '#ebeae4', bar: '#f8f8f5', text: '#ebdbac' },
  U: { pin: '#085f94', bar: '#b9d0e4', text: '#aac0e1' },
  B: { pin: '#2a3a3a', bar: '#b8b1b2', text: '#a09b9b' },
  R: { pin: '#c8310f', bar: '#eabeaa', text: '#e19774' },
  G: { pin: '#05683a', bar: '#b7c9c3', text: '#aecdb6' },
  gold: { pin: '#e8dc90', bar: '#e0ce8b', text: '#f8f3e6' },
  // Two-colour lands keep grey bars; only pinlines and text box are split.
  splitBar: '#d2cfd2',
};

/** Colour indicator wedge colours (D17, 5.2.3). */
export const INDICATOR = { W: '#f8f3dc', U: '#4a8fd0', B: '#3b3633', R: '#d9583b', G: '#3f9a54' };
