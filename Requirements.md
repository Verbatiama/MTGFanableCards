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

1.4 **[Open]** Who owns the layout design. The composite mockup carries an "OSPREYDAWN" watermark; confirm permission to implement it and whether attribution is required.

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

  3.3.6 **[Confirmed]** Card-model schema for v1: each card is represented as a single object containing identity fields (`name`, `types`, `supertypes`, `subtypes`, `layout`), mana info (`manaCost` with grouped symbol counts), power/toughness or loyalty fields, colour indicator information, oracle text kept in the same formatting as Scryfall, and footer metadata (`collectorNumber`, `rarity`, `setCode`, `artist`, `copyright`). This structure is sufficient for rendering, and additional fields can be added later only if a concrete need appears.

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
- **Middle**, anchored at the type line: zone/timing symbols, supertype, subtype.
- **Bottom**, anchored to the bottom: stats, loyalty, or the permanence label.

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

    4.4 **[Open]** Collision and overflow rules for when the sections don't fit (see 5.6).

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

5.2.3 **[Open]** Appearance: plain colour pips, or mana symbols without counts. How two-colour and multi-colour indicators are drawn.

5.2.4 **[Open]** Reflow: whether the mana block moves down to make room.

5.2.5 **[Open]** Accessibility: the indicator should not rely on colour alone (see 10.3).

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

5.3.9 **[Open]** Maximum rows before the mana block collides with the middle section. Five-colour costs, and large costs such as Emrakul's {15} or Draco's {16} (which is one row but a two-digit count), need testing.

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

5.5.3 **[Open]** Jace is legendary but shows no LEGENDARY icon. Are planeswalkers exempt (they are always legendary), or was it an omission?

5.5.4 **[Open]** Icons for other supertypes: Snow, World, and Token if tokens are in scope.

5.5.5 **[Confirmed]** Subtype icons appear in the middle section with a text label below: EQUIPMENT (Sword of Fire and Ice), AURA (Feral Invocation).

5.5.6 **[Confirmed]** Creature subtypes and token subtypes do not get icons (README goal 9).

5.5.7 Subtypes listed in the Components doc:

| Parent type     | Subtypes listed                   |
| --------------- | --------------------------------- |
| Artifact        | Equipment, Vehicle, Food          |
| Enchantment     | Aura, Saga, Curse, Rune           |
| Land            | Desert, Gate, Lair, Locus, Urza's |
| Instant/Sorcery | Adventure, Arcane, Lesson, Trap   |

5.5.8 **[Open]** Whether this list is exhaustive or a starting set. Real subtypes not in it include:

- **Artifact:** Clue, Treasure, Blood, Map, Powerstone, Incubator, Gold, Contraption, Fortification, Attraction
- **Enchantment:** Class, Room, Case, Role, Shrine, Cartouche, Background, Shard
- **Land:** Cave, Sphere, Town, Mine, Power-Plant, Tower, Planet, and the basic land types (Plains, Island, Swamp, Mountain, Forest, Wastes)
- **Instant/Sorcery:** Omen

Also define how new subtypes get added (e.g. a config table mapping subtype to icon).

5.5.9 **[Open]** Which icon appears when a card has several subtypes with icons, e.g. Equipment + Vehicle, or Food + Equipment.

5.5.10 **[Open]** Rule for which icons carry a text label and which are icon-only. So far, every middle-section icon in the mockups has a label.

### 5.6 Middle-section layout

5.6.1 **[Inferred]** Stack order, top to bottom (Feral Invocation): zone/timing symbol → subtype → permanence label. Niv-Mizzet shows the supertype in the same region.

5.6.2 **[Inferred]** The stack is anchored at the type line and grows upward into the space beside the art.

5.6.3 **[Open]** The full order when supertype, subtype and several zone symbols all apply, and the collision rule when the stack meets the mana block. For example, a legendary five-colour creature with flash and flashback.

### 5.7 Bottom section

5.7.1 **[Confirmed]** Creature stats: power over a crossed-swords icon, a horizontal divider, then toughness over a shield icon.

5.7.2 **[Confirmed]** Permanence is spelled vertically, one letter per line: "PERMANENT" (Sword, Feral Invocation) or "NON-PERMANENT" (Damnation, Lightning Strike, with the hyphen on its own line).

5.7.3 **[Inferred]** The permanence label only appears when the bottom isn't occupied by stats or loyalty. Creatures and planeswalkers don't show it. Confirm this rule.

5.7.4 **[Open]** Lands: the Forest and Wasteland mockups don't clearly show a permanence label, although lands are permanents. Confirm.

5.7.5 **[Confirmed]** Planeswalkers: see section 7.2.

5.7.6 **[Open]** Special power/toughness values: `*`, `1+*`, `X`, negative values, and two-digit values.

5.7.7 **[Open]** Other stat-like values:

- Vehicles have power/toughness but are not creatures. The Components doc says stats are "Creature only", which conflicts.
- Battles have defense.
- Spacecraft have station values.
- Levelers, Sagas and Classes have segmented structures similar to loyalty.

---

## 6. Card box

### 6.1 Name bar

6.1.1 **[Confirmed]** The name bar is at the top of the card box, next to the card type icon. It shows the card name only; the mana cost is in the stat bar.

### 6.2 Art box

6.2.1 **[Confirmed]** The art box sits below the name bar and extends to the type line. See 3.4 for art sourcing and cropping.

### 6.3 Type line

6.3.1 **[Confirmed]** Shows the real type line from the JSON (3.3.4).

6.3.2 **[Confirmed]** The set symbol is at the right end of the type line.

6.3.3 **[Open]** Set symbol source (e.g. the Keyrune font or Scryfall SVGs), and whether it is coloured by rarity.

### 6.4 Text box

6.4.1 **[Confirmed]** Contains rules text, with flavour text below in italics (Feral Invocation, Lightning Strike).

6.4.2 **[Inferred]** Reminder text is shown in italics in parentheses (Fiendslayer Paladin).

6.4.3 **[Inferred]** A watermark (e.g. guild symbol) is drawn behind the text (Niv-Mizzet). **[Open]** Where watermark data and images come from.

6.4.4 **[Inferred]** Basic lands show a large mana symbol in the text box instead of text (Forest).

6.4.5 **[Confirmed]** Power/toughness modifiers in rules text are drawn with the sword and shield icons, e.g. "+2 [sword] +2 [shield]" (Feral Invocation). **[Open]** Whether this applies to all P/T references in text, including "-1/-1", "X/X" tokens, and counters.

6.4.6 **[Confirmed]** Mana symbols in rules text are drawn as printed, one symbol each, with no grouping or counts (D11): "Equip {2}" uses the 2 symbol, "Add {C}{C}" shows two diamonds, and "{2}{U}: Draw a card" shows the 2 and U symbols. The grouped symbol + count display and the generic mana symbol are used only in the stat bar.

6.4.7 Symbols to support in rules text. The Components doc lists tap, untap, energy (listed twice) and mana symbols. Additional symbols to decide on **[Open]**:

- {Q} (untap, as distinct from the untap arrow)
- {S} (snow)
- {X}
- {C} (colourless)
- the chaos symbol
- tickets ({TK})
- loyalty cost symbols inside text
- the planeswalker symbol

  6.4.8 **[Open]** Text fitting: font shrinking rules, minimum font size, and behaviour when Oracle text is too long.

### 6.5 Footer

6.5.1 **[Confirmed]** The footer contains:

- collector number and rarity (e.g. "85/165 R")
- set code and language (e.g. "PLC - EN")
- artist credit with the paintbrush icon
- copyright line
- the holo stamp in the centre

  6.5.2 **[Open]** Copyright year: every mockup shows "© 2014". Should it be the printing's release year or a fixed string?

  6.5.3 **[Open]** Whether the holo stamp always appears, or only on certain rarities.

### 6.6 Frame colour

6.6.1 **[Confirmed]** The name bar, type line and text box are coloured by card colour:

| Card                                        | Frame       |
| ------------------------------------------- | ----------- |
| Black (Damnation)                           | Black/grey  |
| Blue (Jace)                                 | Blue        |
| Green (Feral Invocation)                    | Green       |
| Multicolour (Niv-Mizzet)                    | Gold        |
| Colourless artifact (Sword of Fire and Ice) | Silver/grey |
| Land (Forest, Wasteland)                    | Tan         |

6.6.2 **[Open]** Frames not yet shown:

- two-colour hybrid (split frame or gold)
- coloured artifacts
- coloured lands
- devoid
- colourless non-artifact cards
- lands that produce a colour
- tokens

---

## 7. Rules by card kind

### 7.1 Creature

- Stat bar: creature type icon, mana, middle-section icons as applicable, stats at the bottom (5.7.1). No permanence label (5.7.3).
- Reference: Niv-Mizzet, the Firemind; Fiendslayer Paladin; Wurmcoil Engine.

### 7.2 Planeswalker

7.2.1 **[Confirmed]** Loyalty ability costs (+N, 0, −N) appear in the stat bar, each vertically aligned with its ability in the text box.

7.2.2 **[Confirmed]** The text box is divided into alternating shaded bands, one per ability.

7.2.3 **[Confirmed]** Starting loyalty is shown in a loyalty badge at the bottom-left of the card, overlapping the bottom of the bar.

7.2.4 **[Confirmed]** Static abilities get a band with no cost in the bar (Components doc: "blank space").

7.2.5 **[Inferred]** No permanence label; the bottom is occupied by loyalty. The Jace mockup shows a NORMAL icon, which is not used (5.4.8), and no LEGENDARY icon (see 5.5.3).

7.2.6 **[Open]** Band heights drive the vertical positions in the bar, so text layout must be calculated before the bar can be drawn. Rules are needed for long abilities, text shrinking, and more than four abilities.

7.2.7 **[Open]** Display of −X and +X costs.

### 7.3 Instant and sorcery

- Stat bar: type icon, mana, "NON-PERMANENT" at the bottom.
- References: Damnation, Lightning Strike.
- Instants also get the FLASH symbol (5.4.6).

### 7.4 Artifact (including Equipment)

- Stat bar: artifact icon, mana, subtype icon (e.g. EQUIPMENT), "PERMANENT" at the bottom.
- Reference: Sword of Fire and Ice.

### 7.5 Enchantment (including Aura)

- Stat bar: enchantment icon, mana, zone/timing icons (flash), subtype icon (AURA), "PERMANENT" at the bottom.
- Reference: Feral Invocation.

### 7.6 Land

- Stat bar: land icon, no mana section, supertype icon (Basic) where applicable.
- Basic lands show a large mana symbol in the text box.
- References: Forest, Wasteland.
- See 5.7.4 on the permanence label.

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
- battle, including transforming battles
- vehicle
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
| Supertype → icon + label              | 5.5.1–5.5.4 | Legendary and Basic defined; others open             |
| Subtype → icon + label                | 5.5.7–5.5.9 | Partial list                                         |
| Mana symbol → icon, count rule, order | 5.3         | Defined (D11); Y, Z and some hybrid icons missing    |
| Mechanic → zone/timing symbol + label | 5.4         | Defined (D12); split second icon missing             |
| Text symbol → icon                    | 6.4.7       | Partial                                              |
| Colour(s) → frame style               | 6.6         | Mono, gold, colourless and land defined; others open |
| Layout → marker / rendering rules     | 8           | Open                                                 |

9.1 **[Confirmed]** Symbol and icon sources:

- **Mana symbols (custom):** Use the generic mana symbol style from `res/symbols/symbols.svg` (includes 0-20, WUBRG, X, hybrids, etc.). Replaces standard rounded mana cost symbols with a stylized design.
- **Set symbols, creature/spell types, zone/timing icons:** Source from Scryfall SVG library (GPL-3.0 compatible) or create custom SVGs.
- **Watermarks (guild symbols, etc.):** Create custom SVGs or source from Scryfall as needed.
- All symbol assets are stored in `res/symbols/`.

---

## 10. Non-functional requirements

10.1 **Fonts [Confirmed].** Use the Beleren fonts (free to use, located in `res/fonts/`). These provide the authentic Magic card aesthetic.

10.2 **Legal [Open].**

- The output is effectively a set of proxies using Wizards of the Coast card art, text and symbols. State the project's position relative to the Wizards Fan Content Policy.
- Resolve design attribution (1.4) and symbol licensing (9.1).

  10.3 **Accessibility [Open].** Colour indicators, frame colours and mana symbols should remain distinguishable for colour-blind players. This matters especially in the fanned view, which relies heavily on colour. The mockups already pair icons with text labels in the middle section; consider the same for colour indicators.

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
