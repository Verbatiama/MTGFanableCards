/**
 * Frame colours (T-S4, C18; Requirements 6.6), sampled from the reference
 * mockups (Examples/jauIjDF.jpeg): saturated name and type bars, a coloured
 * pinline around each panel and a pale text box, on black. Sampled from
 * Fiendslayer Paladin (W), Jace (U), Damnation (B), Lightning Strike (R),
 * Feral Invocation (G), Niv-Mizzet (gold, whose pinlines are its two colours)
 * and Sword of Fire and Ice / Wurmcoil Engine (artifact). The colourless,
 * three-colour gold pinline and hybrid values aren't in the mockups and are
 * chosen to match.
 */
export const FRAME = {
  W: { pin: '#f2f1ea', bar: '#f6f5ee', text: '#eaeae2' },
  U: { pin: '#0a55cf', bar: '#86b2e4', text: '#b3c0db' },
  B: { pin: '#2b2729', bar: '#887b84', text: '#a7a4a5' },
  R: { pin: '#b8302a', bar: '#ed8b5e', text: '#dccbbb' },
  G: { pin: '#1f7d3d', bar: '#b0d49f', text: '#bbdab0' },
  gold: { pin: '#c9a640', bar: '#e3cc50', text: '#d6dbb4' },
  artifact: { pin: '#c4c4c4', bar: '#cdcdcd', text: '#e9e9e9' },
  colourless: { pin: '#a8a09c', bar: '#c4bcba', text: '#dedad6' },
  // Hybrid cards: grey bars, and a text box paler than either colour's.
  hybridBar: '#d0cccb',
  hybridText: '#efefec',
  // Devoid: pale pinlines, grey bars, grey-beige text box.
  devoid: { pin: '#e2e1c3', bar: '#a69c97', text: '#d3d1c5' },
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
