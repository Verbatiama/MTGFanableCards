# Card-model fixtures (T-A2)

Hand-written card models, one JSON file per card face, following the S1 schema documented in `src/model/card-model.js`. They let the renderer (Dev B) be built and tested before the Scryfall mapper (T-A6) exists, and they become the expected output when the mapper is tested.

Load them with `loadCardFixtures()` / `loadCardFixture(slug)` from `test/fixtures/cards.js`. `test/fixtures.test.js` checks every file against the schema.

## Conventions

- **File name:** the face name in lower case, punctuation dropped, words joined by `-` (`Smuggler's Copter` → `smugglers-copter.json`).
- **Printing:** a fixed printing per card (set and collector number in the file), so footer, art and copyright are stable. Niv-Mizzet (GPT 123) and Damnation (PLC 85) match the mockup footers. The others use a common printing of the card (e.g. Feral Invocation, JMP 396).
- **Text:** `oracleText` and `flavorText` are copied from Scryfall unchanged, so they use current Oracle wording ("this creature", "any target"), not the mockup text.
- **Mana cost order:** WUBRG, then hybrid and Phyrexian, snow, colourless, X, generic last (5.3.4). D11 will settle this; update the fixtures when it does.
- **Copyright:** `™ & © <release year> Wizards of the Coast`, from the printing's release year. The mockups all show 2014; see 6.5.2 (D20).
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
| `lightning-strike`        | Instant, NON-PERMANENT label, flavour text                                    |
| `fiendslayer-paladin`     | Creature with reminder text in parentheses                                    |
| `wurmcoil-engine`         | Multi-type (Artifact Creature), colourless, Phyrexian watermark              |
| `forest`                  | Basic land: Basic supertype, no mana cost, large mana symbol in text box      |
| `wasteland`               | Non-basic colourless land, no mana cost, `{C}` in text                        |

## Edge cases

| Fixture                                        | Covers                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ancestral-vision`                             | No mana cost on a non-land, colour indicator, suspend (exile zone)                  |
| `dryad-arbor`                                  | Land Creature, colour indicator, P/T with no mana cost                              |
| `delver-of-secrets`, `insectile-aberration`    | Transform DFC; back face has a colour indicator and no mana cost                    |
| `agadeems-awakening`, `agadeem-the-undercrypt` | Modal DFC (sorcery // land), `{X}{B}{B}{B}`                                          |
| `invasion-of-zendikar`, `awakened-skyclave`    | Battle with defense; transformed back face is a creature with a colour indicator    |
| `emrakul-the-aeons-torn`                       | Two-digit generic `{15}` and two-digit P/T, long text                               |
| `reaper-king`                                  | Five mono-hybrid symbols (`{2/W}`…), five colours, Legendary Artifact Creature     |
| `kitchen-finks`                                | Hybrid `{G/W}{G/W}` grouped as one symbol with count 2                              |
| `dismember`                                    | Phyrexian `{B/P}{B/P}`, `-5/-5` in text                                             |
| `ajani-sleeper-agent`                          | Phyrexian hybrid `{G/W/P}`, planeswalker with a static ability before loyalty ones  |
| `icehide-golem`                                | Snow supertype, snow mana `{S}` in the cost, multi-type                             |
| `thought-knot-seer`                            | Colourless mana `{C}` in the cost, distinct from generic                            |
| `ornithopter`                                  | `{0}` cost (must differ from no cost), 0 power                                      |
| `gelatinous-genesis`                           | `{X}{X}{G}` (X count 2), `X/X` in text                                              |
| `tarmogoyf`                                    | Special P/T `*` / `1+*`                                                             |
| `atraxa-grand-unifier`                         | Four-colour cost (tall mana block), legendary, long text for text fitting           |
| `complete-disregard`                           | Devoid: black mana cost but `colors` is empty                                       |
| `bitterblossom`                                | Kindred Enchantment (Kindred type icon, creature subtype that gets no icon)         |
| `smugglers-copter`                             | Vehicle: P/T on a non-creature                                                       |
| `deep-analysis`                                | Flashback (graveyard zone) with a non-mana cost                                     |
| `street-wraith`                                | Cycling (hand zone) with a non-mana cost                                            |
| `gravecrawler`                                 | Cast from graveyard without a keyword (5.4.3)                                       |
| `ugin-the-spirit-dragon`                       | Planeswalker with a −X ability, colourless                                          |
| `teferi-time-raveler`                          | Planeswalker with a static ability (band with no cost)                              |
