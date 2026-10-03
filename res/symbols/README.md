# Symbols

Every symbol the requirements and tasks call for, what exists, and where it came from. All SVGs use a 100×100 viewBox. Stat-bar icons are white on transparent, because the bar is black (4.1); the renderer tints them where it needs another colour.

Traced SVGs are rebuilt with `npm run symbols:trace` (`scripts/trace-symbol.js`), which downloads its magarena sources into `cache/magarena/`. The other icons (T-B14) are rebuilt with `npm run symbols:build` (`scripts/build-icons.js`): it downloads icons from the Mana font, writes the icons drawn for this project, and composes the missing mana symbols. Which icon each card element uses is set in `src/config/` (T-A9).

## Inventory

| Area (requirement)                 | Symbol                                                               | File                                                                      | Source                                     | Status                               |
| ---------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------ |
| Mana (5.3, D11)                    | W U B R G, 0–20, X, hybrids, mono-hybrids, Phyrexian, S, C, T, Q, E, ∞, ½ | `symbols.svg` (sheet)                                                     | original sheet                             | ✓                                    |
| Mana (5.3.6, D11)                  | Generic (stat bar only)                                              | `generic.svg`                                                             | traced from `Examples/K3uIZAk.jpeg`        | ✓                                    |
| Mana (5.3.6, D11) | Y, Z, Phyrexian hybrid ({G/U/P} …), colourless hybrid ({C/W} …) | `mana/y.png`, `mana/z.png`, `mana/<a>-<b>-p.png`, `mana/c-<colour>.png` | composed from sheet symbols and Mana glyphs | ✓ composed (400px PNG) |
| Card type (5.1, D14)               | Artifact, Creature, Enchantment, Instant, Land, Planeswalker, Sorcery | `types/<type>.svg`                                                        | magarena `cardbuilder/images/<type>Symbol.png`; Planeswalker is the Mana font's `planeswalker` spark (T-S4) | ✓ traced                             |
| Card type (5.1.4, D14) | Battle, Kindred | `types/battle.svg`, `types/kindred.svg` | drawn for this project (siege tower; three figures) | ✓ drawn |
| Zone/timing (5.4, D12)             | Flash (bolt)                                                         | `zones/flash.svg`                                                         | magarena `instantSymbol.png` (same bolt as Instant) | ✓ traced                     |
| Zone/timing (5.4, D12)             | Hand, Top of library, Graveyard                                      | `zones/hand.svg`, `zones/library.svg`, `zones/graveyard.svg`              | magarena `icons/b_*_zone.png` (30–32px)    | ✓ traced (graveyard "RIP" blurs below ~40px) |
| Zone/timing (5.4.2, D12) | Split second | `zones/split-second.svg` | drawn for this project (bolt in a stopwatch) | ✓ drawn |
| Supertype (5.5, D15, T-S4) | Legendary, Basic, Non-basic (every land that isn't basic), Snow (snowflake, reuse {S} art), World (globe); none for Token | `supertypes/legendary.svg`, `basic.svg`, `nonbasic.svg`, `world.svg`; Snow uses the sheet's {S} | Legendary traced from `Examples/Commander-2014.png`; drawn for this project as in the mockups (pentagon; pentagon with a pine tree; globe) | ✓ |
| Subtype (5.5.8, D16) | Aura, Equipment, Fortification (basic land types reuse the mana symbols; no other subtypes get icons) | `subtypes/aura.svg`, `equipment.svg`, `fortification.svg` | drawn for this project (Aura and Equipment as in the mockups: flame-crowned ring; sword across a shield; battlemented wall) | ✓ drawn |
| Stats (5.7.1, 6.4.5)               | Toughness (shield)                                                   | `stats/toughness.svg`                                                     | magarena `icons/round-shield.png`          | ✓ traced (round shield, not the mockup's plain shield) |
| Stats (5.7.1, 6.4.5) | Power (crossed swords) | `stats/power.svg` | Mana `power` sword, two copies crossed | ✓ |
| Planeswalker (7.2.3) | Loyalty badge | `badges/loyalty-up.svg`, `-down`, `-zero`, `-start` | Mana `loyalty-*` | ✓ |
| Battle (5.7.7, D18) | Defense badge | `badges/defense.svg` | drawn for this project (shield) | ✓ drawn |
| Text box (6.4.7, D20) | Chaos, {TK}, planeswalker symbol, loyalty costs in text | `text/chaos.svg`, `text/ticket.svg`, `text/planeswalker.svg`; loyalty costs in text use the badges | Mana `chaos`, `ticket`, `planeswalker` | ✓ |
| Footer (6.5, D20) | Artist paintbrush (no holo stamp) | `footer/artist-brush.svg` | Mana `artist-brush` | ✓ |
| Type line (6.3, D7)                | Set symbols                                                          | –                                                                         | Scryfall SVGs at runtime                   | out of scope here                    |
| Special layouts (8, post-v1)       | Flip markers (Day/Night, Spark, …)                                   | –                                                                         | –                                          | post-v1                              |

## magarena files considered and not used

From [magarena/magarena](https://github.com/magarena/magarena) (GPL-3.0):

- `cardbuilder/frames/watermark/watermark_*.png`: these are mana-colour combinations (e.g. sun with water drop), not the guild crests Scryfall's watermark names refer to (Niv-Mizzet's `izzet` is the Izzet crest). The single-colour ones are the mana symbols, which `symbols.svg` already has.
- `icons/strike.png`: a single sword in 16px pixel art, not crossed swords; too small to trace.
- `icons/loyalty-counter.png`: a gold crown in 16px pixel art, not a loyalty badge; too small to trace (a possible Legendary reference only).
- `icons/shield-counter.png`: a 16px teal shield with a staff; too small, and `round-shield.png` covers toughness.

## Licences

- `symbols.svg`: the project's own symbol sheet (D7).
- Traced from magarena: GPL-3.0, the same licence as this project. Each traced SVG names its source URL in a comment.
- From the [Mana font](https://github.com/andrewgioia/mana) by Andrew Gioia: SIL Open Font License 1.1, included as `mana-font/OFL.txt`. Each SVG names its source in a comment. The mana, tap and card type symbols themselves are © Wizards of the Coast, used under the Fan Content Policy (Requirements 10.2).
- Drawn for this project (`scripts/build-icons.js`): GPL-3.0.
- Composed mana symbols (`mana/*.png`): built from the project's symbol sheet and Mana glyphs.
