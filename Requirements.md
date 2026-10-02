# MTG Fannable Cards — Requirements

This document consolidates the project goals from `README.md` and `Components of a card.md`, the reference mockups (Niv-Mizzet, the Firemind; Damnation; Sword of Fire and Ice; Jace, the Mind Sculptor; Feral Invocation; and the ten-card composite), and decisions made by the project owner. It is arranged in the order an implementer needs it: what the app is, how data flows through it, how a card is laid out, the rules for each card kind, the reference data the renderer depends on, and finally the questions that still need answers.

Each requirement is tagged:

- **[Confirmed]**: stated by the owner or unambiguous in the mockups.
- **[Inferred]**: observed in the mockups but not explicitly confirmed; verify before relying on it.
- **[Open]**: not yet decided; see section 11 for the consolidated question list.

---

## 1. Purpose and concept

1.1 **[Confirmed]** The application generates Magic: The Gathering cards in a new "fannable" layout.

1.2 **[Inferred]** "Fannable" means the card is readable when held fanned in hand. A black **stat bar** runs the full height of the card's left edge, and it carries the information a player needs while only that strip is visible: card type, mana cost, colour indicator, timing/zone symbols, supertype, subtype, permanence, and stats or loyalty.

1.3 **[Open]** Whether a mirrored (right-edge bar) variant is needed for players who fan the other way.

1.4 **[Confirmed]** The composite mockup carries an "OSPREYDAWN" watermark: Osprey Dawn made that mockup, and the project uses it only as a reference example. The project does not reuse their work, so no permission or attribution is needed (D23).

---

## 2. Scope and priorities

2.1 The README lists these goals. It does not say whether the numbering is a priority order, a milestone plan, or just a list **[Open]**:

1. Generate a normal card with a black bar on the left
2. Mana symbols on the left
3. Card types top left
4. Power/toughness
5. Symbols in text
6. Loyalty abilities
7. Colour indicator
8. Flash symbol
9. Subtype symbols (not including creatures or tokens)
10. Special symbols (colour indicator, flip)
11. Keyword symbols (ones that exist in Arena)
12. Active in grave
13. Keyword symbols (other)

2.2 **[Confirmed]** Goals 8, 11, 12 and 13 are superseded by a single concept: **zone and timing symbols** (section 5.4). Keyword symbols in general are _not_ required. Only effects that change where a card can be cast or activated from, or when it can be cast, get a symbol.

2.3 **[Confirmed]** Goal 7 and the colour indicator in goal 10 are the same feature (section 5.2).

2.4 **[Confirmed]** Acceptance criteria will be determined as each phase is completed, not pre-defined.

2.5 **[Confirmed]** V1 scope:

- **Included:** All card types (creatures, instants, sorceries, artifacts, enchantments, planeswalkers, lands, battles, etc.) rendered as single faces
- **Multi-face handling:** Double-faced cards (transform, modal/MDFC) render as two separate images
- **Excluded from v1:** Special layouts (split, adventure, saga, flip, meld, leveler, class, case, etc.) move to Phase 4 (post-v1)

---

## 3. Application architecture

### 3.1 Runtime

3.1.1 **[Confirmed]** The application runs on Node.js and is written in JavaScript.

3.1.2 **[Confirmed]** Interface: **Backend API for programmatic access + frontend UI for decklist input**. Users can input a decklist with quantities via the UI, and developers can call the API directly.

3.1.3 **[Confirmed]** Rendering approach: **node-canvas with Canvas 2D API**. Same drawing code works in both backend (Node.js via node-canvas) and frontend (native browser CanvasRenderingContext2D). Direct pixel control for precise card layout. Server-side rendering runs on Linux (WSL for development on Windows): node-canvas cannot load the bundled Beleren fonts on native Windows (see `spikes/rendering/README.md`, T-B1).

### 3.2 Input

3.2.1 **[Confirmed]** The user supplies card names. Each name is looked up in a JSON file of Magic cards.

3.2.2 **[Confirmed]** Input format: **Decklist format with quantities** (e.g., `4 Lightning Bolt`, `1 Counterspell`). Quantities are respected; `4 Lightning Bolt` produces four card images.

3.2.3 **[Confirmed]** Quantities: `4 Lightning Bolt` produces **four separate images** (one per copy).

3.2.4 **[Open]** Name matching: exact, case-insensitive, or fuzzy.

3.2.5 **[Confirmed]** Double-faced card names: accept **both** the full name with `//` (e.g., `Delver of Secrets // Insectile Aberration`) **and** either face name alone (e.g., `Delver of Secrets` or `Insectile Aberration`).

3.2.6 **[Confirmed]** Unmatched names (typos, card doesn't exist): **Frontend displays a warning; API returns a success/failure report** along with the generated files. Cards that match are processed; unmatched cards are reported but do not block the batch.

3.2.7 **[Open]** Non-English card names and non-English output (see 10.4).

### 3.3 Card data source

3.3.1 **[Confirmed]** Card data source: **Scryfall bulk data**. Use Default Cards JSON (one unique card per printing) plus Unique Artwork files (all artwork variants per card). This provides complete card details and all artwork options.

3.3.2 **[Confirmed]** Files are downloaded daily. The app fetches updated data on startup (or on demand) and caches locally.

3.3.3 **[Open]** Printing selection. One card name matches many printings, and art, set symbol, collector number, rarity, artist and release year all vary by printing. The app needs:

- a way for the user to specify a printing, e.g. `Lightning Bolt (M10) 146`
- a defined default when none is given (e.g. latest printing, or first printing)

  3.3.4 **[Confirmed]** The type line shows the card's real type line from the JSON. Subtypes invented in the mockups ("Sorcery - Wrath", "Artifact - Sword", "Enchantment - Beast", "Planeswalker - Jace Beleren") are to be ignored.

  3.3.5 **[Inferred]** Rules text comes from Oracle text in the JSON. The mockup text contains typos ("it's owner's", "hhis") and is not authoritative.

  3.3.6 **[Confirmed]** Card-model schema for v1: each card is represented as a single object containing identity fields (`name`, `types`, `supertypes`, `subtypes`, `layout`), mana info (`manaCost` with grouped symbol counts), power/toughness or loyalty fields, colour indicator information, oracle text kept in the same formatting as Scryfall, and footer metadata (`collectorNumber`, `rarity`, `setCode`, `artist`). There is no `copyright` field: the renderer builds the copyright line itself (6.5.2, D20). This structure is sufficient for rendering, and additional fields can be added later only if a concrete need appears.

### 3.4 Card art

3.4.1 **[Confirmed]** Card art sourcing:

- **Source:** Scryfall image URLs (via the Unique Artwork files for artwork variants)
- **Timing:** Downloaded at runtime during card generation
- **Caching:** Downloaded images are cached locally to avoid re-downloading
- **Rate limiting:** Requests are spaced 100ms apart to respect Scryfall API limits
- **Fallback behavior:** If art is unavailable (failed request, network error, or no image URL in data), render a **solid black placeholder** in the art box. The card still generates successfully.

  3.4.2 **[Open]** How art is cropped and scaled to fit the art box, which is narrower than a standard card because of the stat bar.

### 3.5 Output

3.5.1 **[Confirmed]** Output format: **PNG, 750×1050 pixels (300 DPI for printing)**. Cards include a black border around the edges. All images bundled into a zip file named `cards`.

3.5.2 **[Confirmed]** File naming: `card-name.png` (e.g., `Lightning-Bolt.png`, `Counterspell.png`). Duplicate card names are handled by appending a counter if needed (e.g., `Counterspell-2.png`).

3.5.3 **[Confirmed]** Output options:

- **Default:** Zip file with individual PNG images
- **Optional:** PDF (A4 size) with 9 cards tiled per sheet for printing convenience

  3.5.4 **[Confirmed]** Double-faced cards: **Two separate images** (front and back). Each face gets its own PNG file (e.g., `Delver-of-Secrets.png` and `Insectile-Aberration.png`, or with face labels if needed).

  3.5.6 **[Open]** Zip file name and output location.

---

## 4. Card anatomy overview

The card has two regions: the **stat bar** on the left and the **card box** on the right.

```
┌────┬──────────────────────────────┐
│TYPE│ Name bar                     │
│ CI │──────────────────────────────│
│MANA│                              │
│MANA│           Art                │
│    │                              │
│    │──────────────────────────────│
│ZONE│ Type line          [set sym] │
│SUPR│──────────────────────────────│
│SUB │                              │
│ P  │        Text box              │
│ E  │      (watermark)             │
│ R  │                              │
│ M  │                              │
│STAT│──────────────────────────────│
│    │ Footer: № / rarity / set /   │
│    │ lang / artist / © / holo     │
└────┴──────────────────────────────┘
```

4.1 **[Confirmed]** The stat bar is black on every card, regardless of card colour.

4.2 **[Inferred]** The stat bar has three sections:

- **Top**, anchored to the top: card type icon, colour indicator, mana cost.
- **Middle**, anchored at the type line: attaching subtypes, supertypes, zone/timing symbols (5.6.1). Below it, beside the text box, the land mana symbols (5.5.8).
- **Bottom**, anchored to the bottom: stats, loyalty, defense, or the NON-PERMANENT label (5.7.3).

  4.3 **[Confirmed]** Layout dimensions are derived from the example mockups and stored in a configuration file for easy adjustment. Initial v1 estimates (750×1050px card):
  - **Stat bar width:** ~90 pixels
  - **Icon sizes:** ~50 pixels (square)
  - **Card name font:** ~26pt
  - **Type line font:** ~14pt
  - **Rules text font:** ~11pt
  - **Footer font:** ~8pt
  - **Spacing:** 5-8px between elements
  - All dimensions are configurable and can be fine-tuned during development.
  - **Mirrored bar:** Not required for v1; single left-edge stat bar only.

    4.4 **[Confirmed]** Collision and overflow rules (D19): the top section (type icons, colour indicator, mana) and the bottom section never move or shrink. Only the middle stack gives way, as set out in 5.6.3.

---

## 5. Stat bar

### 5.1 Card type icon (top)

5.1.1 **[Confirmed]** The card type icon is the first item at the top of the bar. Mockup icons:

| Card type    | Icon (as seen in mockups) |
| ------------ | ------------------------- |
| Creature     | Claw marks                |
| Sorcery      | Swirl                     |
| Instant      | Bolt                      |
| Artifact     | Chalice                   |
| Enchantment  | Sunburst                  |
| Planeswalker | Planeswalker symbol       |
| Land         | Land icon                 |
| Battle       | New icon (D14)            |
| Kindred      | New icon (D14)            |

5.1.2 **[Confirmed]** Multi-type cards show one icon per type, side by side in a single row (Wurmcoil Engine shows artifact + creature). Kindred counts as a type and gets its own icon, so Bitterblossom shows Kindred + Enchantment (D14).

5.1.3 **[Confirmed]** Icons appear in type-line order, which Wizards already standardises (Kindred, then Artifact/Enchantment/Land, then Creature): Wurmcoil Engine = Artifact, Creature; Dryad Arbor = Land, Creature (D14). Icons shrink so the row always fits the bar width: one icon at full size, two at about 40px, three at about 28px. The top of the bar keeps a fixed height, so the mana block does not move down. As of this decision no real (non-Un) card face has more than two card types, so the three-icon case is future-proofing.

5.1.4 **[Confirmed]** Battle and Kindred (formerly Tribal) get new icons (D14). Dungeon, Plane, Phenomenon, Scheme, Conspiracy and Vanguard are out of scope for v1: if one is requested it renders with no type icon, and its type still appears in the type line.

### 5.2 Colour indicator (top)

5.2.1 **[Confirmed]** For cards that have a colour indicator, it is placed directly under the card type icon.

5.2.2 **[Inferred]** Cards that need it are mainly back faces of double-faced cards, plus cards such as Ancestral Vision and Dryad Arbor. It should be driven by the JSON colour indicator field.

5.2.3 **[Confirmed]** Appearance (D17): a single circle, as on printed cards. A one-colour indicator is a solid circle; a multi-colour indicator is the same circle split into equal wedges, one per colour, in WUBRG order clockwise from the top (Nicol Bolas, the Arisen: blue, black, red). It is never more than one circle, however many colours.

5.2.4 **[Confirmed]** Reflow (D17): the indicator takes its own row under the type icons only when the card has one, and the mana block starts below it. Cards without an indicator keep the space.

5.2.5 **[Confirmed]** Accessibility (D17): thin divider lines separate the wedges, so the number of colours can be counted without seeing colour. Which colour each wedge is still relies on colour; this is accepted for the indicator (10.3).

### 5.3 Mana cost (top)

5.3.1 **[Confirmed]** Mana cost is grouped by symbol: each distinct symbol appears once, on the left, with the required amount next to it. E.g. {2}{U}{U}{R}{R} is drawn as blue 2, red 2, generic 2.

5.3.2 **[Confirmed]** Every mana symbol type follows this same pattern.

5.3.3 **[Confirmed]** X is counted like any other symbol (D11): {X} is drawn as X 1 and {X}{X} as X 2. This replaces the earlier rule of showing X without a number.

5.3.4 **[Confirmed]** Coloured symbols come first and generic comes last (D11). See 5.3.7 for the full order.

5.3.5 **[Confirmed]** Lands with no mana cost show no mana section.

5.3.6 **[Confirmed]** Symbol types (D11). Every symbol is drawn as its symbol plus a count; each distinct symbol is one row:

| Symbol                     | Display                                                                     |
| -------------------------- | --------------------------------------------------------------------------- |
| W, U, B, R, G              | Symbol + count                                                              |
| Generic                    | Generic mana symbol (`res/symbols/generic.svg`) + total generic amount      |
| Colourless {C}             | Diamond symbol + count, distinct in shape from generic                      |
| X (including {X}{X})       | X symbol + count: {X} = X 1, {X}{X} = X 2                                   |
| Y, Z                       | As X: own symbol + count                                                    |
| Hybrid ({W/U})             | One hybrid symbol + count: {W/U}{W/U} = W/U 2                               |
| Mono-hybrid ({2/W})        | One mono-hybrid symbol + count                                              |
| Phyrexian ({W/P})          | One Phyrexian symbol + count: {B/P}{B/P} = B/P 2                            |
| Phyrexian hybrid ({G/U/P}) | One symbol + count                                                          |
| Colourless hybrid ({C/W})  | One symbol + count                                                          |
| Snow {S}                   | Snowflake symbol + count                                                    |

The generic mana symbol is traced from `Examples/K3uIZAk.jpeg` and is used **only** for the grouped generic cost in the stat bar. Rules text keeps the number symbols (6.4.6). The symbol sheet does not yet have Y, Z, Phyrexian hybrid or colourless hybrid symbols; they are needed before those costs render properly (T-B3).

5.3.7 **[Confirmed]** Symbol order (D11): coloured, hybrid and Phyrexian symbols in the order they are printed on the card (the printed order already follows the colour wheel, e.g. {G}{W} for Selesnya), then snow, colourless, X, Y, Z, and generic last. Niv-Mizzet ({2}{U}{U}{R}{R}) is drawn U 2, R 2, generic 2.

5.3.8 **[Confirmed]** A {0} cost is drawn as the generic mana symbol with the count 0 (D11). A card with no mana cost (lands, Ancestral Vision, back faces) has no mana section at all (5.3.5), so the two stay visibly different.

5.3.9 **[Confirmed]** No maximum and no special rule (D19). Real costs have at most about six rows, which always fit, and a two-digit count such as Emrakul's {15} or Draco's {16} is one row with a slightly smaller number. The mana block never shrinks or wraps; when it meets the middle stack, the middle stack gives way (5.6.3).

### 5.4 Zone and timing symbols (middle)

5.4.1 **[Confirmed]** Instead of keyword symbols, symbols are needed for effects that change **where** a card can be used from (cast, activated, or otherwise working there; see 5.4.4), or **when** it can be cast. Confirmed examples:

| Effect    | Symbol                                                           |
| --------- | ---------------------------------------------------------------- |
| Flash     | Lightning bolt, labelled "FLASH" (5.4.5)                         |
| Cycling   | Hand                                                             |
| Flashback | Graveyard                                                        |

5.4.2 **[Confirmed]** Mechanic → symbol mapping (D12). v1 has five symbols: two timing symbols and three zone symbols. There is **no Exile symbol**; mechanics that start in hand and are cast from exile show the Hand symbol, because that is where the player starts using them.

| Symbol (model id)                 | Label        | Keywords                                                                                                                       |
| --------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Flash (`flash`)                   | FLASH        | Flash; also every Instant (5.4.6)                                                                                              |
| Split second (`split-second`)     | SPLIT SECOND | Split second (new icon needed)                                                                                                 |
| Hand (`hand`)                     | HAND         | Cycling and every _-cycling_ variant, channel, ninjutsu, commander ninjutsu, transmute, forecast, bloodrush, reinforce, madness, suspend, foretell, plot |
| Top of library (`library`)        | LIBRARY      | Miracle                                                                                                                        |
| Graveyard (`graveyard`)           | GRAVEYARD    | Flashback, unearth, escape, disturb, embalm, eternalize, retrace, jump-start, scavenge, encore, dredge, aftermath               |

The keyword lists live in a configuration table (section 9), so new mechanics are added there.

5.4.3 **[Confirmed]** Detection (D12) combines three sources:

- the Scryfall `keywords` array, looked up in the mapping table above
- the card type: every Instant gets Flash
- oracle-text phrases for abilities without a keyword, where the card refers to itself in that zone: "this card from/in your hand", "this card from/on the top of your library", "this card from/in your graveyard" (e.g. Gravecrawler's "You may cast this card from your graveyard")

The result is stored in the card model as `zoneSymbols` (T-A8).

5.4.4 **[Confirmed]** Any ability that works while the card is in the zone counts, not only casting and activating (D12). Bloodghast ("return this card from your graveyard to the battlefield", a triggered ability) gets the Graveyard symbol. This also covers README goal 12, "Active in grave". Abilities that trigger as the card moves into a zone, such as Emrakul's "When Emrakul is put into a graveyard from anywhere", do not count.

5.4.5 **[Confirmed]** The flash symbol is labelled **FLASH**, not "INSTANT", so it is not confused with the Instant card type (D12).

5.4.6 **[Confirmed]** Instants also get the Flash symbol, so the timing slot is consistent for every card castable at instant speed (D12).

5.4.7 **[Confirmed]** There is no maximum number of zone/timing symbols; every symbol that applies is shown (D12). Order, top to bottom: Flash, Split second, Hand, Top of library, Graveyard. Running out of space is handled by the stat-bar collision rules (D19).

5.4.8 **[Confirmed]** There is **no "NORMAL" symbol** (D13). The icon labelled NORMAL on the Damnation and Jace mockups is not created or used; a card without flash or split second simply has no timing symbol.

### 5.5 Supertype and subtype (middle)

5.5.1 **[Confirmed]** Legendary is shown as a crown icon with the label "LEGENDARY" (Niv-Mizzet).

5.5.2 **[Inferred]** Basic is shown with a labelled icon (Forest, composite image).

5.5.3 **[Confirmed]** Planeswalkers are not exempt: every legendary card, planeswalkers included, shows the crown + LEGENDARY (D15, revised). The Jace mockup's missing LEGENDARY icon is treated as an omission.

5.5.4 **[Confirmed]** Snow and World get an icon with a label, like Legendary and Basic (D15):

| Supertype | Icon                                     | Label     |
| --------- | ---------------------------------------- | --------- |
| Legendary | Crown                                    | LEGENDARY |
| Basic     | Basic icon                               | BASIC     |
| Snow      | Snowflake (the same art as the {S} mana symbol) | SNOW      |
| World     | Globe                                    | WORLD     |

Token is out of scope for v1 and gets no icon; tokens are decided with the other special layouts (section 8). Ongoing and Elite only appear on out-of-scope card kinds (5.1.4) and get no icon.

**[Confirmed]** A card with several supertypes shows one icon per supertype, stacked in type-line order (D15): Dark Depths shows LEGENDARY then SNOW; Snow-Covered Forest shows BASIC then SNOW. Overflow is handled by D19.

5.5.5 **[Confirmed]** Subtype icons appear in the middle section with no text label (D16). The mockups label them EQUIPMENT (Sword of Fire and Ice) and AURA (Feral Invocation); D16 drops those labels. Zone/timing and supertype icons keep their labels (5.4, 5.5.1–5.5.4).

5.5.6 **[Confirmed]** Creature subtypes and token subtypes do not get icons (README goal 9).

5.5.7 Subtypes listed in the Components doc:

| Parent type     | Subtypes listed                   |
| --------------- | --------------------------------- |
| Artifact        | Equipment, Vehicle, Food          |
| Enchantment     | Aura, Saga, Curse, Rune           |
| Land            | Desert, Gate, Lair, Locus, Urza's |
| Instant/Sorcery | Adventure, Arcane, Lesson, Trap   |

5.5.8 **[Confirmed]** Neither: the list is replaced (D16). Only two groups of subtypes get an icon:

| Subtypes                                    | Icon                                                     |
| ------------------------------------------- | -------------------------------------------------------- |
| Aura, Equipment, Fortification              | New icons (cards that attach to another card)            |
| Plains, Island, Swamp, Mountain, Forest     | That colour's mana symbol ({W}, {U}, {B}, {R}, {G})      |
| Wastes                                      | The colourless mana symbol ({C})                         |

**[Confirmed]** The basic land type symbols show what the land taps for (D16, revised). They are not part of the middle stack: they form their own group in the bar, one icon per land type in type-line order, centred on the middle of the text box (Breeding Pool shows {G} above {U} there). The middle stack has priority: if it spills below the type line (5.6.3) far enough to reach them, they are pushed down to sit just under it.

Every other subtype gets no icon and shows only in the type line, including the rest of the Components list (Vehicle, Food, Saga, Curse, Rune, Desert, Gate, Lair, Locus, Urza's, Adventure, Arcane, Lesson, Trap). Whether a subtype gets an icon depends only on the subtype, so Equipment on an artifact creature (reconfigure) and Forest on Dryad Arbor still show; creature subtypes never do (5.5.6). The mapping is a config table (section 9), so a subtype can be added later without code changes. For reference, the earlier open question listed these real subtypes missing from the Components doc:

- **Artifact:** Clue, Treasure, Blood, Map, Powerstone, Incubator, Gold, Contraption, Fortification, Attraction
- **Enchantment:** Class, Room, Case, Role, Shrine, Cartouche, Background, Shard
- **Land:** Cave, Sphere, Town, Mine, Power-Plant, Tower, Planet, and the basic land types (Plains, Island, Swamp, Mountain, Forest, Wastes)
- **Instant/Sorcery:** Omen

5.5.9 **[Confirmed]** A card with several subtypes that have icons shows one icon each, in type-line order, like supertypes (D15, D16). Subtypes without icons are skipped, so an Aura Curse shows only the Aura icon. Overflow is handled by D19.

5.5.10 **[Confirmed]** Subtype icons are icon-only; zone/timing and supertype icons carry a text label (D16).

### 5.6 Middle-section layout

5.6.1 **[Confirmed]** Stack order, top to bottom (D19): attaching subtype icons (Aura, Equipment, Fortification) → supertype icons → zone/timing symbols, so zone/timing sits nearest the type line. Land mana symbols are a separate group beside the text box (5.5.8). Within each group the earlier rules apply: subtypes and supertypes in type-line order (D15, D16), zone/timing in the fixed D12 order. This reverses the Feral Invocation mockup, which has FLASH above AURA; its PERMANENT label is removed by D18 (5.7.3).

5.6.2 **[Confirmed]** The stack is anchored at the type line and grows upward into the space beside the art, unless it would meet the mana block (5.6.3).

5.6.3 **[Confirmed]** Collision rule (D19). When the stack would meet the mana block, these steps apply in order, stopping at the first that fits:

1. **Continue below the type line.** The stack starts just under the mana block and runs down past the type line into the empty bar beside the text box, keeping its order. It may go down to the top of the bottom section (stats, defense badge, NON-PERMANENT), less the room the land mana symbols need (5.5.8), which it pushes down ahead of it. Planeswalkers skip this step, as their loyalty costs use the bar beside the text box (7.2.1).
2. **Drop the labels** under supertype and zone/timing icons.
3. **Shrink the icons**, all together, down to a minimum of half size.

Nothing is ever hidden. Order (5.6.1) does not change in any step. In practice, real cards rarely reach step 1: a legendary five-colour creature with flash and flashback still fits above the type line. The preview spike has synthetic stress cases for each step (`spikes/fixture-preview/stress.js`).

### 5.7 Bottom section

5.7.1 **[Confirmed]** Creature stats: power over a crossed-swords icon, a horizontal divider, then toughness over a shield icon.

5.7.2 **[Confirmed]** Permanence is spelled vertically, one letter per line: "PERMANENT" (Sword, Feral Invocation) or "NON-PERMANENT" (Damnation, Lightning Strike, with the hyphen on its own line).

5.7.3 **[Confirmed]** Only NON-PERMANENT is shown (D18). Permanents never get a permanence label, so the PERMANENT label in the Sword of Fire and Ice and Feral Invocation mockups is dropped; on a permanent with no stats, loyalty or defense the bottom of the bar is left empty. Instants and sorceries always show NON-PERMANENT, as their bottom is never used by anything else.

5.7.4 **[Confirmed]** Lands show no permanence label, like every other permanent (5.7.3, D18).

5.7.5 **[Confirmed]** Planeswalkers: see section 7.2.

5.7.6 **[Confirmed]** Special power/toughness values are drawn exactly as printed (the Scryfall string): `*`, `1+*` (Tarmogoyf), `X`, negative values, two-digit values (Emrakul 15/15). The font shrinks so the value fits the bar width (D18). A `*` is drawn the same size as the digits beside it, not as the font's small raised asterisk.

5.7.7 **[Confirmed]** Other stat-like values (D18):

- **Vehicles** show power/toughness in the creature position (5.7.1), but drawn hollow (outlined numbers and icons) to show the stats only apply once crewed (Smuggler's Copter). This settles the Components doc's "Creature only" conflict (section 12).
- **Battles** show defense in a defense badge (a new icon) at the bottom of the bar, overlapping the bar edge like the planeswalker loyalty badge (7.2.3) (Invasion of Zendikar).
- **Spacecraft** render as normal artifacts. If one has power/toughness, it is drawn hollow like a vehicle, as it only applies once stationed. Station thresholds (STATION N+) are not shown in the bar in v1; they belong with the Phase 4 segmented layouts.
- **Levelers, Sagas and Classes** are special layouts, post-v1 (2.5, section 8).

---

## 6. Card box

### 6.1 Name bar

6.1.1 **[Confirmed]** The name bar is at the top of the card box, next to the card type icon. It shows the card name only; the mana cost is in the stat bar.

### 6.2 Art box

6.2.1 **[Confirmed]** The art box sits below the name bar and extends to the type line. See 3.4 for art sourcing and cropping.

### 6.3 Type line

6.3.1 **[Confirmed]** Shows the real type line from the JSON (3.3.4).

6.3.2 **[Confirmed]** The set symbol is at the right end of the type line.

6.3.3 **[Confirmed]** The set symbol comes from Scryfall's set SVGs (D7) and is drawn plain black for every rarity (D20). Rarity is shown only by the letter in the footer (6.5.1).

### 6.4 Text box

6.4.1 **[Confirmed]** Contains rules text, with flavour text below in italics (Feral Invocation, Lightning Strike).

6.4.2 **[Inferred]** Reminder text is shown in italics in parentheses (Fiendslayer Paladin).

6.4.3 **[Inferred]** A watermark (e.g. guild symbol) is drawn behind the text (Niv-Mizzet). **[Confirmed]** Which watermark a card has comes from Scryfall's `watermark` field (e.g. `izzet`); the images are custom SVGs in `res/symbols/` (D7, D20).

6.4.4 **[Inferred]** Basic lands show a large mana symbol in the text box instead of text (Forest).

6.4.5 **[Confirmed]** Power/toughness modifiers in rules text are drawn with the sword and shield icons, e.g. "+2 [sword] +2 [shield]" (Feral Invocation). **[Confirmed]** Only numeric modifiers with a sign on both numbers use it: +N/+N and -N/-N (Dismember's -5/-5), and mixed signs such as +1/-1 (D20). Everything else stays as text: X modifiers (+X/+X), counters ("a +1/+1 counter" is drawn as text too, since the counter name is not a modifier) and plain stats such as "a 1/1 Goblin token" or "X/X". Flavour text is never converted.

6.4.6 **[Confirmed]** Mana symbols in rules text are drawn as printed, one symbol each, with no grouping or counts (D11): "Equip {2}" uses the 2 symbol, "Add {C}{C}" shows two diamonds, and "{2}{U}: Draw a card" shows the 2 and U symbols. The grouped symbol + count display and the generic mana symbol are used only in the stat bar.

6.4.7 Symbols to support in rules text. The Components doc lists tap, untap, energy (listed twice) and mana symbols. **[Confirmed]** All of the following are supported too (D20); {Q}, {S}, {X} and {C} are already in `symbols.svg`, and the rest need new icons. A symbol with no icon falls back to its text code:

- {Q} (untap, as distinct from the untap arrow)
- {S} (snow)
- {X}
- {C} (colourless)
- the chaos symbol
- tickets ({TK})
- loyalty cost symbols inside text
- the planeswalker symbol

  6.4.8 **[Confirmed]** Text fitting (D20): if the rules and flavour text don't fit at full size, the flavour text is dropped first. The rules text then shrinks to fit, down to a minimum size (configurable; the preview spike uses 12px against a 26px normal size). Rules text is never cut. The spike's `stress-drop-flavour` case shows this.

### 6.5 Footer

6.5.1 **[Confirmed]** The footer contains:

- collector number and rarity (e.g. "85/165 R")
- set code and language (e.g. "PLC - EN")
- artist credit with the paintbrush icon
- copyright line
- ~~the holo stamp in the centre~~: no holo stamp is drawn (6.5.3)

  6.5.2 **[Confirmed]** Copyright line: "™ & © <year> Wizards of the Coast", where the year is the year the image is generated (D20). The mockups' fixed "© 2014" is not used, and the card model has no copyright field (3.3.6).

  6.5.3 **[Confirmed]** No holo stamp on any card (D20); the centre of the footer is left empty.

### 6.6 Frame colour

6.6.1 **[Confirmed]** The name bar, type line and text box are coloured by card colour:

| Card                                        | Frame       |
| ------------------------------------------- | ----------- |
| Black (Damnation)                           | Black/grey  |
| Blue (Jace)                                 | Blue        |
| Green (Feral Invocation)                    | Green       |
| Multicolour (Niv-Mizzet)                    | Gold        |
| Colourless artifact (Sword of Fire and Ice) | Silver/grey |
| Land (Forest, Wasteland)                    | Real land frame (6.6.2): stone frame, colour in pinlines, bars and text box (D21) |

6.6.2 **[Confirmed]** Frames not shown in the mockups (D21):

- **Two-colour hybrid** (Kitchen Finks {G/W}; Phyrexian hybrid such as Ajani's {G/W/P} too): a split frame, left half the first colour of the hybrid symbol, right half the second, blended in the middle. Other two-colour cards stay gold.
- **Coloured artifacts** (Reaper King): the card's colour, by the same rule as any card (mono colour, gold, or split). Only colourless artifacts are silver.
- **Lands** use the land frame of real cards (current frame), with the same colours and saturation (D21, revised). Every land has the same textured stone frame; the colour is in the pinlines around each panel, the name and type bars, and the text box. The palette comes from the card's colour if it has one (Dryad Arbor green), otherwise from the colours it taps for (its "Add …" text and basic land types). No colour: grey panels with a grey-brown pinline (Wasteland). One colour: that colour's land palette (Forest green). Two colours: grey bars, with the pinlines and the text box blending from the first colour to the second (Breeding Pool green → blue). Three or more, or "any color": gold pinlines and bars with a cream text box (City of Brass). The colours are sampled from Scryfall scans: the M19 basics, Wasteland (EMA), Command Tower (CMR) and Breeding Pool (RNA); the values are in the preview spike (`LAND` in `spikes/fixture-preview/run.js`).
- **Colourless non-artifact cards** (Ugin, Thought-Knot Seer): silver, like colourless artifacts.
- **Devoid** (Complete Disregard): silver, tinted by the colours in its mana cost, with the same one / two / three-or-more rule as lands.
- **Tokens**: out of scope for v1 (D15, section 8).

---

## 7. Rules by card kind

### 7.1 Creature

- Stat bar: creature type icon, mana, middle-section icons as applicable, stats at the bottom (5.7.1, special values 5.7.6). No permanence label (5.7.3).
- Reference: Niv-Mizzet, the Firemind; Fiendslayer Paladin; Wurmcoil Engine.

### 7.2 Planeswalker

7.2.1 **[Confirmed]** Loyalty ability costs (+N, 0, −N) appear in the stat bar, each vertically centred on its ability's band in the text box. **[Confirmed]** They are drawn in the printed-card shapes (D22): + costs in a badge pointing up, − costs in a badge pointing down, 0 in a flat badge, with a white number on dark grey. Badges scale down to fit short bands, so they never touch.

7.2.2 **[Confirmed]** The text box is divided into alternating shaded bands, one per ability.

7.2.3 **[Confirmed]** Starting loyalty is shown in a loyalty badge at the bottom-left of the card, overlapping the bottom of the bar.

7.2.4 **[Confirmed]** Static abilities get a band with no cost in the bar (Components doc: "blank space").

7.2.5 **[Confirmed]** No permanence label (5.7.3, D18); the bottom is occupied by loyalty. The Jace mockup shows a NORMAL icon, which is not used (5.4.8). **[Confirmed]** Planeswalkers show the LEGENDARY icon like any legendary card (5.5.3, D15).

7.2.6 **[Confirmed]** Band layout (D22). Band heights drive the vertical positions in the bar, so text layout is calculated before the bar is drawn.

- Every Oracle line gets a band, loyalty abilities and static abilities alike (7.2.4). All bands are the same height and together fill the text box. All abilities share one font size, chosen so the longest ability fits its band; the font shrinks under the normal text-fitting rules (6.4.8).
- There is no maximum number of abilities. If the text still doesn't fit at the minimum font size, the text box grows upward into the art: the type line moves up with it, and the art gets shorter. The middle stack stays anchored at the type line, wherever it ends up.
- The preview spike's `stress-many-abilities` case (nine abilities) shows the text box growing. No real in-scope card has more than four loyalty abilities; Urza, Planeswalker has five but is a meld card (post-v1).

7.2.7 **[Confirmed]** −X and +X costs are drawn like numbers, in the same badges (D22): Ugin's −X shows "−X" in a downward badge.

### 7.3 Instant and sorcery

- Stat bar: type icon, mana, "NON-PERMANENT" at the bottom.
- References: Damnation, Lightning Strike.
- Instants also get the FLASH symbol (5.4.6).

### 7.4 Artifact (including Equipment)

- Stat bar: artifact icon, mana, Equipment subtype icon (no label, D16). No permanence label (5.7.3, D18); the bottom is empty unless it is a vehicle or spacecraft with hollow stats (5.7.7).
- Reference: Sword of Fire and Ice.

### 7.5 Enchantment (including Aura)

- Stat bar: enchantment icon, mana, zone/timing icons (flash), Aura subtype icon (no label, D16). No permanence label (5.7.3, D18).
- Reference: Feral Invocation.

### 7.6 Land

- Stat bar: land icon, no mana section, supertype icon (Basic) where applicable, and the mana symbol of each basic land type it has, icon-only, centred beside the text box (Forest; dual lands show two, 5.5.8).
- Basic lands show a large mana symbol in the text box.
- References: Forest, Wasteland.
- No permanence label (5.7.4, D18).

### 7.7 Multi-type cards

- One type icon per type at the top, in type-line order, shrunk to fit one row (5.1.2–5.1.3).
- Stats if the card is a creature.
- Reference: Wurmcoil Engine (Artifact Creature).

---

## 8. Special layouts (no mockup yet)

The Components doc lists these "Flip" markers, which mix different concepts:

- Day
- Night
- Spark
- Ignite (meaning unclear)
- Moon
- Emrakul
- Enchantment
- Modal (front)
- Modal (back)

  8.1 **[Open]** What each marker means and when it applies. Sun/Moon, Spark and Emrakul are transform markers, Day/Night is a mechanic (daybound), and Modal is MDFC.

  8.2 **[Open]** Each of the following layouts needs a mockup or an explicit "out of scope for v1":

- transform double-faced cards (front and back)
- modal double-faced cards
- split cards
- aftermath
- adventure
- Kamigawa-style flip cards
- meld
- saga
- class
- leveler
- room
- case
- battle, including transforming battles (single-face stat bar decided in 5.7.7)
- vehicle (single-face stat bar decided in 5.7.7)
- spacecraft station thresholds (5.7.7)
- prototype
- mutate
- omen
- tokens and emblems

  8.3 **[Open]** How double-faced cards map to output images (see 3.5.5), and how the back face is identified in the stat bar.

---

## 9. Reference data the renderer needs

The implementation should keep these as configuration tables rather than hard-coding them, so they can be extended:

| Table                                 | Maps        | Status                                               |
| ------------------------------------- | ----------- | ---------------------------------------------------- |
| Card type → icon                      | 5.1         | Defined (D14); Battle and Kindred icons to be made   |
| Supertype → icon + label              | 5.5.1–5.5.4 | Defined (D15); icons to be made                      |
| Subtype → icon                        | 5.5.7–5.5.9 | Defined (D16); Aura/Equipment/Fortification icons to be made |
| Mana symbol → icon, count rule, order | 5.3         | Defined (D11); Y, Z and some hybrid icons missing    |
| Mechanic → zone/timing symbol + label | 5.4         | Defined (D12); split second icon missing             |
| Text symbol → icon                    | 6.4.7       | Defined (D20); chaos, {TK}, planeswalker and loyalty icons missing |
| Colour(s) → frame style               | 6.6         | Defined (D21)                                        |
| Layout → marker / rendering rules     | 8           | Open                                                 |

9.1 **[Confirmed]** Symbol and icon sources:

- **Mana symbols (custom):** Use the generic mana symbol style from `res/symbols/symbols.svg` (includes 0-20, WUBRG, X, hybrids, etc.). Replaces standard rounded mana cost symbols with a stylized design.
- **Set symbols, creature/spell types, zone/timing icons:** Source from Scryfall SVG library (GPL-3.0 compatible) or create custom SVGs.
- **Watermarks (guild symbols, etc.):** Create custom SVGs or source from Scryfall as needed.
- **Traced icons:** card type, zone and toughness icons are traced from [magarena](https://github.com/magarena/magarena) PNGs (GPL-3.0, compatible with this project) by `scripts/trace-symbol.js`.
- All symbol assets are stored in `res/symbols/`. `res/symbols/README.md` lists every required symbol, its source, and which are still missing.

---

## 10. Non-functional requirements

10.1 **Fonts [Confirmed].** Use the Beleren fonts (free to use, located in `res/fonts/`). These provide the authentic Magic card aesthetic.

10.2 **Legal [Confirmed]** (D23).

- The output is effectively a set of proxies using Wizards of the Coast card art, text and symbols. The project follows the Wizards Fan Content Policy: it is free and non-commercial (no selling cards, images or access, no paywalls or sponsorships), and generated images are for personal use and playtesting.
- Wizards' unofficial Fan Content notice appears in the README and must appear in the app's UI when it is built (T-S8, frontend).
- Generated card images carry no extra "unofficial" marking; the footer keeps the copyright line (6.5.2).
- Design attribution: none needed (1.4). Symbol licensing: the symbol sheet is the project's own, traced icons are GPL-3.0 like the project, and set symbols come from Scryfall at runtime (9.1, `res/symbols/README.md`).

  10.3 **Accessibility [Open].** Colour indicators, frame colours and mana symbols should remain distinguishable for colour-blind players. This matters especially in the fanned view, which relies heavily on colour. The mockups already pair icons with text labels in the middle section; consider the same for colour indicators. The colour indicator itself is decided by D17 (5.2.5): divider lines between wedges, no letters.

  10.4 **Localisation [Open].** Whether non-English cards and non-English labels ("PERMANENT", "LEGENDARY", etc.) are in scope. The footer already shows a language code ("EN").

  10.5 **Performance [Open].** Expected batch size, e.g. a 100-card Commander deck, and acceptable generation time, given art downloads and rate limits.

---

## 11. Consolidated open questions

Grouped by area, so the project owner can answer them in batches. Numbers in brackets refer to the sections above.

### Product and scope

1. Is a mirrored right-edge bar needed? [1.3]
2. Who owns the layout design, and is permission or attribution needed? [1.4]
3. Are the README goals in priority order? What are the acceptance criteria? [2.1, 2.4]
4. Which layouts are in scope for v1? [2.5, 8.2]

### Architecture, input and output

5. CLI only, or also a server/UI? [3.1.2]
6. What is the input format, and how are quantities handled? [3.2.2, 3.2.3]
7. What name-matching rules apply, including DFC names? [3.2.4, 3.2.5]
8. What happens to unmatched names? [3.2.6]
9. Which JSON source (MTGJSON or Scryfall), and is it bundled or downloaded? [3.3.1, 3.3.2]
10. How is a printing chosen, and what is the default? [3.3.3]
11. Where does art come from? What are the caching, rate-limit and offline rules? [3.4.1]
12. What are the image format, dimensions, DPI and bleed? [3.5.2, 3.5.3]
13. How are files named inside the zip? [3.5.4, 3.5.6]
14. Do double-faced cards produce one image or two? [3.5.5]

### Layout

15. What are the exact dimensions and spacing? [4.3]
16. What are the overflow and collision rules for the stat bar? [4.4, 5.3.9, 5.6.3]

### Stat bar

17. Which icons are needed for Battle, Kindred and the other types, and in what order for multi-type cards? [5.1.3, 5.1.4]
18. What does the colour indicator look like, and does the mana block reflow? [5.2.3, 5.2.4]
19. How are colourless, XX, hybrid, mono-hybrid, Phyrexian, snow and {0} drawn? [5.3.6, 5.3.8]
20. What is the full mana symbol order? [5.3.7]
21. What is the complete mechanic → zone/timing symbol mapping? [5.4.2]
22. How are mechanics detected (keywords field, text parsing, or mapping table)? [5.4.3]
23. Do triggered abilities that work from a zone count? [5.4.4]
24. Should the flash label be "INSTANT" or "FLASH"? Do instants also get the bolt? [5.4.5, 5.4.6]
25. What is the maximum number and order of zone symbols? [5.4.7]
26. What does the "NORMAL" icon mean, and when does it appear? [5.4.8]
27. Why is there no LEGENDARY icon on Jace? [5.5.3]
28. Which icons are needed for the other supertypes? [5.5.4]
29. Is the subtype list exhaustive? Which icon wins when a card has several subtypes? [5.5.8, 5.5.9]
30. Which icons carry text labels? [5.5.10]
31. Is the permanence label shown only when the bottom is free? Do lands get it? [5.7.3, 5.7.4]
32. How are special P/T values, vehicles, battles and spacecraft handled? [5.7.6, 5.7.7]

### Card box

33. Where do set symbols and watermarks come from? [6.3.3, 6.4.3]
34. Does the sword/shield notation apply to all P/T text? [6.4.5]
35. Is the symbol + count pill used for all mana in rules text? [6.4.6]
36. Which additional text symbols are needed? [6.4.7]
37. What are the text-fitting rules? [6.4.8]
38. Is the copyright year per printing or fixed? When does the holo stamp appear? [6.5.2, 6.5.3]
39. What do the frames for hybrid, coloured artifacts, devoid and other unshown cases look like? [6.6.2]
40. How are long, many or ±X planeswalker abilities handled? [7.2.6, 7.2.7]

### Special layouts

41. What do the flip markers mean (including "Ignite")? [8.1]
42. How is the back face identified? [8.3]

### Non-functional

43. Which fonts, and under what licensing? [10.1]
44. What is the Fan Content Policy position? [10.2]
45. What are the accessibility requirements? [10.3]
46. Is localisation in scope? [10.4]
47. What are the expected batch sizes and performance targets? [10.5]

---

## 12. Corrections to the source documents

- **README goals 8, 11, 12, 13** (flash symbol, keyword symbols, active in grave) should be replaced by "Zone and timing symbols" (2.2).
- **Components doc, Special → "Instant"** should read "Flash" (it is the timing symbol, not the card type).
- **Components doc, Special → "Keywords"** should be replaced by "Zone and timing symbols".
- **Components doc, Special → "Active in grave"** is covered by the graveyard zone symbol.
- **Components doc, Other → "Non-permeant"** is a typo for "Non-permanent". It is the vertical permanence label (5.7.2), and "Permanent" should be listed alongside it.
- **Components doc, Stats → "Creature only"** conflicts with Vehicles, which have P/T without being creatures.
- **Components doc, Card box → Text box → Symbols** lists "Energy" twice.
- **Components doc, Card types** is missing Battle and Kindred, and a Supertypes section (Legendary, Basic, Snow, World).
- **Components doc, Card box** is missing the set symbol, flavour text, watermark and the footer fields.
- **Anatomy mockup** labels the whole mana block "Generic Mana"; it should read "Mana Cost".
