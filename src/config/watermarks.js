/**
 * Scryfall watermark name → icon, drawn faintly behind the rules text (6.4.3,
 * D7, D20). Watermarks without an icon are left out.
 */
const GUILDS = [
  'azorius',
  'boros',
  'dimir',
  'golgari',
  'gruul',
  'izzet',
  'orzhov',
  'rakdos',
  'selesnya',
  'simic',
];
const CLANS = [
  'abzan',
  'jeskai',
  'mardu',
  'sultai',
  'temur',
  'atarka',
  'dromoka',
  'kolaghan',
  'ojutai',
  'silumgar',
];
const SCHOOLS = ['lorehold', 'prismari', 'quandrix', 'silverquill', 'witherbloom'];
const POLEIS = ['akros', 'meletis', 'setessa'];

export const WATERMARKS = Object.fromEntries(
  [...GUILDS, ...CLANS, ...SCHOOLS, ...POLEIS, 'phyrexian', 'mirran'].map((name) => [
    name,
    { icon: `watermarks/${name}` },
  ]),
);
