# Card-model fixtures (T-A2)

Hand-written card models, one JSON file per card face, following the S1 schema documented in `src/model/card-model.js`. They let the renderer (Dev B) be built and tested before the Scryfall mapper (T-A6) exists, and they become the expected output when the mapper is tested.

Load them with `loadCardFixtures()` / `loadCardFixture(slug)` from `test/fixtures/cards.js`. `test/fixtures.test.js` checks every file against the schema.

`test/fixtures/scryfall/printings.json` holds the real Scryfall printing of each fixture card, as the card database stores it (T-A3). `test/model/from-scryfall.test.js` maps those printings (T-A6) and checks the result matches these files, so the fixtures double as the mapper's expected output.

## Conventions

- **File name:** the face name in lower case, punctuation dropped, words joined by `-` (`Smuggler's Copter` → `smugglers-copter.json`).
- **Printing:** a fixed printing per card (set and collector number in the file), so footer and art are stable. Niv-Mizzet (GPT 123) and Damnation (PLC 85) match the mockup footers. The others use a common printing of the card (e.g. Feral Invocation, JMP 396).
- **Text:** `oracleText` and `flavorText` are copied from Scryfall unchanged, so they use current Oracle wording ("this creature", "any target"), not the mockup text.
- **Mana cost order (D11):** coloured, hybrid and Phyrexian symbols in printed order, then snow, colourless, X, Y, Z, and generic last. Every group carries a count, X included; `{0}` is `generic` with count 0.
- **Zone symbols (D12):** `zoneSymbols` holds the expected output of zone/timing detection (T-A8), worked out by hand from the D12 rules in Requirements 5.4.
- **Copyright:** no field. The renderer builds the line from the year the image is generated (D20, 6.5.2).
- **Double-faced cards:** one file per face, sharing `layout`, `setCode` and `collectorNumber`, with `faceIndex` 0 (front) and 1 (back).

## Mockup cards

These are the ten cards in the reference mockups (`MOCKUP_FIXTURES`), used for visual regression in T-S4.

| Fixture                   | Covers                                                                        |
| ------------------------- | ----------------------------------------------------------------------------- |
| `niv-mizzet-the-firemind` | Legendary creature, two-colour gold frame, grouped `{2}{U}{U}{R}{R}`, `{T}` in text, Izzet watermark |
| `damnation`               | Sorcery, NON-PERMANENT label, black frame                                     |
| `sword-of-fire-and-ice`   | Colourless artifact, Equipment subtype, `Equip {2}` in text                   |
| `jace-the-mind-sculptor`  | Planeswalker: four loyalty abilities (+2, 0, −1, −12), starting loyalty 3     |
| `feral-invocation`        | Flash enchantment, Aura subtype, `+2/+2` in text, flavour text                |
| `lightning-strike`        | Instant (gets the FLASH symbol, D12), NON-PERMANENT label, flavour text |
| `fiendslayer-paladin`     | Creature with reminder text in parentheses                                    |
| `wurmcoil-engine`         | Multi-type (Artifact Creature), colourless, Phyrexian watermark              |
| `forest`                  | Basic land: Basic supertype, Forest subtype as a {G} icon (D16), no mana cost, large mana symbol in text box |
| `wasteland`               | Non-basic colourless land, no mana cost, `{C}` in text                        |

## Edge cases

| Fixture                                        | Covers                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ancestral-vision`                             | No mana cost on a non-land, colour indicator, suspend (Hand symbol, D12) |
| `dryad-arbor`                                  | Land Creature, colour indicator, P/T with no mana cost                              |
| `delver-of-secrets`, `insectile-aberration`    | Transform DFC; back face has a colour indicator and no mana cost                    |
| `agadeems-awakening`, `agadeem-the-undercrypt` | Modal DFC (sorcery // land), `{X}{B}{B}{B}`                                          |
| `invasion-of-zendikar`, `awakened-skyclave`    | Battle with a defense badge (D18); transformed back face is a creature with a colour indicator |
| `emrakul-the-aeons-torn`                       | Two-digit generic `{15}` and two-digit P/T, long text                               |
| `reaper-king`                                  | Five mono-hybrid symbols (`{2/W}`…), five colours, Legendary Artifact Creature     |
| `kitchen-finks`                                | Hybrid `{G/W}{G/W}` grouped as one symbol with count 2                              |
| `dismember`                                    | Phyrexian `{B/P}{B/P}`, `-5/-5` in text                                             |
| `ajani-sleeper-agent`                          | Phyrexian hybrid `{G/W/P}`, planeswalker with a static ability before loyalty ones  |
| `icehide-golem`                                | Snow supertype, snow mana `{S}` in the cost, multi-type                             |
| `dark-depths`                                  | Two supertypes, Legendary Snow (D15): one icon each, type-line order                 |
| `snow-covered-forest`                          | Basic Snow land (D15): BASIC then SNOW, large mana symbol in the text box            |
| `concordant-crossroads`                        | World supertype (D15)                                                                |
| `breeding-pool`                                | Two basic land types (D16): {G} above {U} centred beside the text box, no labels     |
| `curse-of-deaths-hold`                         | Aura Curse (D16): only the Aura subtype gets an icon                                 |
| `nicol-bolas-the-ravager`, `nicol-bolas-the-arisen` | Transform DFC; back face has a three-colour indicator (D17: one circle, three wedges) |
| `thought-knot-seer`                            | Colourless mana `{C}` in the cost, distinct from generic                            |
| `ornithopter`                                  | `{0}` cost (must differ from no cost), 0 power                                      |
| `gelatinous-genesis`                           | `{X}{X}{G}` (X count 2), `X/X` in text                                              |
| `tarmogoyf`                                    | Special P/T `*` / `1+*`, drawn as printed and shrunk to fit (D18)                   |
| `atraxa-grand-unifier`                         | Four-colour cost (tall mana block), legendary, long text for text fitting           |
| `complete-disregard`                           | Devoid: black mana cost but `colors` is empty                                       |
| `bitterblossom`                                | Kindred Enchantment (Kindred type icon, creature subtype that gets no icon)         |
| `smugglers-copter`                             | Vehicle: P/T on a non-creature, drawn hollow (D18)                                   |
| `wurmwall-sweeper`                             | Spacecraft: hollow P/T like a vehicle, station thresholds not in the bar (D18)       |
| `city-of-brass`                                | Land that taps for any colour: tan frame with a gold tint (D21)                     |
| `deep-analysis`                                | Flashback (graveyard zone) with a non-mana cost                                     |
| `street-wraith`                                | Cycling (hand zone) with a non-mana cost                                            |
| `gravecrawler`                                 | Cast from graveyard without a keyword (5.4.3)                                       |
| `bloodghast` | Graveyard symbol from a triggered ability with no keyword (5.4.4) |
| `terminus` | Miracle: top-of-library symbol |
| `krosan-grip` | Instant with split second: FLASH and SPLIT SECOND together |
| `ugin-the-spirit-dragon`                       | Planeswalker with a −X ability, colourless                                          |
| `teferi-time-raveler`                          | Planeswalker with a static ability (band with no cost)                              |
