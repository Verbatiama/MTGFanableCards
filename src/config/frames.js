/**
 * Frame colours (T-S4, C18; Requirements 6.6), sampled from the reference
 * mockups (Examples/jauIjDF.jpeg): saturated name and type bars, a coloured
 * pinline around each panel and a pale text box, on black. Sampled from
 * Fiendslayer Paladin (W), Jace (U), Damnation (B), Lightning Strike (R),
 * Feral Invocation (G), Niv-Mizzet (gold, whose pinlines are its two colours)
 * and Sword of Fire and Ice / Wurmcoil Engine (artifact). The colourless,
 * three-colour gold pinline and hybrid values aren't in the mockups and are
 * chosen to match. `border` only tints devoid cards' translucent border.
 */
export const FRAME = {
  W: { border: '#e8e4d4', pin: '#f2f1ea', bar: '#f6f5ee', text: '#eaeae2' },
  U: { border: '#3a78d8', pin: '#0a55cf', bar: '#86b2e4', text: '#b3c0db' },
  B: { border: '#5a5257', pin: '#2b2729', bar: '#887b84', text: '#a7a4a5' },
  R: { border: '#c0402f', pin: '#b8302a', bar: '#ed8b5e', text: '#dccbbb' },
  G: { border: '#3c8a50', pin: '#1f7d3d', bar: '#b0d49f', text: '#bbdab0' },
  gold: { border: '#c9a640', pin: '#c9a640', bar: '#e3cc50', text: '#d6dbb4' },
  artifact: { border: '#a8a8a8', pin: '#c4c4c4', bar: '#cdcdcd', text: '#e9e9e9' },
  colourless: { border: '#9a908a', pin: '#a8a09c', bar: '#c4bcba', text: '#dedad6' },
  // Hybrid cards: grey bars, and a text box paler than either colour's.
  hybridBar: '#d0cccb',
  hybridText: '#efefec',
  // Devoid: the art shows through a translucent border and text box.
  devoid: { pin: '#e2e1c3', bar: '#a69c97', text: 'rgba(211, 209, 197, 0.88)' },
};

/**
 * Land frames, from the mockup's Wasteland and Forest: every land has the
 * same pink-tan bars. A colourless land has brown pinlines and a grey-beige
 * text box; a land with colours (its own, or those it taps for) takes their
 * pinlines, and its text box is tinted halfway towards theirs.
 */
export const LAND_FRAME = { bar: '#d2af97', pin: '#8f5e57', text: '#d7d2cc' };

/** Colour indicator wedge colours (D17, 5.2.3). */
export const INDICATOR = { W: '#f8f3dc', U: '#4a8fd0', B: '#3b3633', R: '#d9583b', G: '#3f9a54' };
