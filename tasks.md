# MTG Fannable Cards — Tasks

Task plan derived from `Requirements.md`. The work is split into two tracks so two developers can work at the same time:

- **Dev A** builds the data pipeline: input, card data, parsing, art and output.
- **Dev B** builds the renderer: layout, stat bar, card box and text.

The two tracks meet at a **card model**, an agreed data structure describing one card ready to draw. Once the developers agree it in task S1, Dev B can render from hand-written sample card models while Dev A builds the parser that produces them.

Decisions (D) are owned by the project owner (PO) unless marked otherwise. References in the Req column point to sections of `Requirements.md`.

## Phase 0: Blocking decisions and setup (week 1)

These decisions block most of the build work, so they should be settled first.

| ID   | Task                                                                                                                                                                   | Owner  | Depends on | Req         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ----------- |
| D1   | ✓ DECIDED: V1 includes all card types (single-face rendering), double-faced as two images, special layouts post-v1                                                     | PO     | —          | 2.5         |
| D2   | ✓ DECIDED: Scryfall Default Cards + Unique Artwork, downloaded daily                                                                                                   | PO + A | —          | 3.3.1–3.3.2 |
| D3   | ✓ DECIDED: Decklist format with quantities, both // and single face names, warning for unmatched (no batch failure)                                                    | PO     | —          | 3.2.2–3.2.6 |
| D4   | ✓ DECIDED: PNG 750×1050px (300 DPI), black border, card-name.png naming, zip "cards", optional PDF A4 with 9 tiled cards                                               | PO     | —          | 3.5         |
| D5   | ✓ DECIDED: node-canvas with Canvas 2D API (backend and frontend, same code). Confirmed after T-B1; develop and render on Linux/WSL (fonts fail on native Windows) | B      | —          | 3.1.3       |
| D6   | ✓ DECIDED: Use Beleren fonts from res/fonts/ (free to use)                                                                                                              | PO + B | —          | 10.1        |
| D7   | ✓ DECIDED: Custom SVG mana symbols from res/symbols/, Scryfall SVGs for set/type icons, custom watermarks                                                              | PO     | —          | 9.1         |
| D8   | ✓ DECIDED: Dimensions from example mockups, configurable in code, no mirrored bar for v1                                                                               | PO     | D4         | 1.3, 4.3    |
| D9   | ✓ DECIDED: Backend API + frontend UI (API for programmatic access, UI for decklist input)                                                                              | PO     | —          | 3.1.2       |
| D10  | ✓ DECIDED: Scryfall runtime download, local cache, 100ms rate limit, black placeholder for missing art                                                                 | PO     | D2         | 3.4         |
| S1   | ✓ AGREED: Card-model schema sufficient for v1; keep oracle text in Scryfall formatting, with `manaCost` grouped and extra fields only added if a concrete need appears | A + B  | —          | 3.3.1       |
| T-A1 | ✓ DONE: Scaffold the project: Node repo, linting (ESLint + Prettier), test framework (node:test), CI (GitHub Actions), folder structure                          | A      | —          | 3.1.1       |
| T-B1 | ✓ DONE: Rendering spike (spikes/rendering/): node-canvas vs @napi-rs/canvas. node-canvas fonts fail on native Windows, work on Linux/WSL; D5 kept, project moves to WSL | B      | —          | 3.1.3       |
| T-A2 | ✓ DONE: Fixture set (test/fixtures/cards/): 10 mockup cards + 30 edge-case faces as card-model JSON, schema and validator in src/model/card-model.js | A      | S1         | all         |

## Phase 1: Rule decisions (weeks 1–3, alongside build work)

These can be settled while building starts. Each one blocks only the tasks listed in Phase 2.

| ID   | Task                                                                                                                                                                                      | Owner  | Depends on | Req               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ----------------- |
| D11  | ✓ DECIDED: Symbol + count for every symbol (X, hybrid, Phyrexian, snow included); new generic symbol in the bar only, diamond for {C}; {0} = generic 0; printed order, then S, C, X, generic last; text symbols as printed | PO     | —          | 5.3, 6.4.6        |
| D12  | ✓ DECIDED: Flash (also on instants, labelled FLASH), Split second, Hand, Top of library, Graveyard; no Exile (suspend/foretell/plot/madness = Hand); keywords + type + phrase detection; any ability active in the zone counts; no maximum, fixed order | PO     | —          | 5.4.1–5.4.7       |
| D13  | ✓ DECIDED: No "NORMAL" symbol; it is not created or used. Cards without flash or split second have no timing symbol | PO     | —          | 5.4.8             |
| D14  | ✓ DECIDED: New icons for Battle and Kindred; Dungeon/Plane/Phenomenon/Scheme/Conspiracy/Vanguard out of scope (no icon); type-line order; one row, icons shrink to fit | PO     | D1         | 5.1.3–5.1.4       |
| D15  | ✓ DECIDED: Planeswalkers show LEGENDARY like any legendary card; Snow (snowflake) and World (globe) get icon + label; Token out of scope for v1; several supertypes = one icon each, type-line order | PO     | —          | 5.5.3–5.5.4       |
| D16  | ✓ DECIDED: Icons only for attaching subtypes (Aura, Equipment, Fortification) and basic land types (their mana symbol, below the supertype icons); no other subtype icons; several = one each, type-line order; subtype icons have no label | PO     | —          | 5.5.8–5.5.10      |
| D17  | ✓ DECIDED: One circle split into a wedge per colour (WUBRG, clockwise from the top) with divider lines; mana block moves down only when an indicator is present | PO     | —          | 5.2.3–5.2.5       |
| D18  | ✓ DECIDED: Only NON-PERMANENT is shown (no PERMANENT label, lands included); special P/T as printed, shrunk to fit; vehicles and spacecraft show hollow P/T; battles get a defense badge; station post-v1 | PO     | D1         | 5.7.3–5.7.7       |
| D19  | ✓ DECIDED: Middle order attaching subtype → supertype → land mana → zone/timing; on collision the stack continues below the type line, then drops labels, then shrinks icons (never hides); mana block and top/bottom never move; no mana-row limit | PO + B | D8         | 4.4, 5.3.9, 5.6.3 |
| D20  | Card box: set symbol source and rarity colouring, watermark source, scope of the sword/shield notation, extra text symbols, text-fitting rules, copyright year, holo stamp                | PO     | D7         | 6.3–6.5           |
| D21  | Frame colours for cases not yet shown: hybrid, coloured artifacts, devoid and others                                                                                                      | PO     | D1         | 6.6.2             |
| D22  | Planeswalker edge cases: long abilities, more than four abilities, ±X costs                                                                                                               | PO     | —          | 7.2.6–7.2.7       |
| D23  | Legal: design attribution (Osprey Dawn) and Fan Content Policy position                                                                                                                   | PO     | —          | 1.4, 10.2         |
| D24  | Accessibility, localisation and performance targets                                                                                                                                       | PO     | —          | 10.3–10.5         |
| T-S2 | Apply the corrections to README and the Components doc                                                                                                                                    | A or B | D12        | 12                |

## Phase 2: Core build (weeks 2–6)

### Dev A: data pipeline

| ID    | Task                                                                                                                                                           | Depends on           | Req          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------ |
| T-A3  | Card data loader: load and index the JSON, look up by name                                                                                                     | T-A1, D2             | 3.3          |
| T-A4  | Input parser and printing selection                                                                                                                            | T-A3, D3             | 3.2, 3.3.3   |
| T-A5  | Mana cost parser: group symbols with counts, apply ordering                                                                                                    | S1, D11              | 5.3          |
| T-A6  | Card-model mapper: JSON → card model (types, supertypes, subtypes, stats, loyalty, colour indicator, footer)                                                   | T-A3, T-A5, S1       | 3.3.1        |
| T-A7  | Oracle text tokenizer: inline symbols, P/T modifiers, reminder and flavour text, loyalty ability split                                                         | S1, D11, D20         | 6.4          |
| T-A8  | Zone/timing detection                                                                                                                                          | T-A6, D12            | 5.4          |
| T-A9  | Configuration tables: type, supertype, subtype, mechanic, text symbol and frame colour mappings. Build the structure early and fill contents as decisions land | S1, D7, D14–D16, D21 | 9            |
| T-A10 | Art fetcher with cache, rate limiting and placeholder                                                                                                          | T-A4, D10            | 3.4          |
| T-A11 | Output: image writer, file naming, zip bundling                                                                                                                | D4, T-B2             | 3.5          |
| T-A12 | CLI entry point and error reporting                                                                                                                            | T-A4, T-A11, D9      | 3.1.2, 3.2.6 |

### Dev B: renderer

| ID    | Task                                                                                                | Depends on                    | Req          |
| ----- | --------------------------------------------------------------------------------------------------- | ----------------------------- | ------------ |
| T-B2  | Render foundation: canvas, dimension constants, font loading, `render(cardModel) → image` interface | D5, D6, D8, S1                | 4            |
| T-B3  | Asset loader for symbols and icons, with placeholder icons until the final set arrives              | T-B2, D7                      | 9.1          |
| T-B4  | Card-box frame: name bar, art box and cropping, type line, set symbol, frame colours                | T-B2, D20, D21                | 6.1–6.3, 6.6 |
| T-B5  | Text box: inline symbols, italics, sword/shield P/T notation, watermark, text fitting               | T-B2, T-A7 (or fixtures), D20 | 6.4          |
| T-B6  | Footer                                                                                              | T-B2, D20                     | 6.5          |
| T-B7  | Stat bar top: type icons (including multi-type), colour indicator, mana block                       | T-B3, D11, D14, D17           | 5.1–5.3      |
| T-B8  | Stat bar middle: stack of zone/timing, supertype and subtype icons                                  | T-B7, D12, D13, D15, D16      | 5.4–5.6      |
| T-B9  | Stat bar bottom: creature stats, vertical permanence label                                          | T-B2, D18                     | 5.7          |
| T-B10 | Stat-bar overflow and collision handling                                                            | T-B7–T-B9, D19                | 4.4          |
| T-B11 | Planeswalker layout: shaded bands, loyalty costs aligned with abilities, loyalty badge              | T-B5, T-B9, D22               | 7.2          |
| T-B12 | Basic land: large mana symbol in the text box                                                       | T-B5                          | 6.4.4        |

## Phase 3: Integration and hardening (weeks 6–8)

| ID   | Task                                                                           | Owner | Depends on        | Req       |
| ---- | ------------------------------------------------------------------------------ | ----- | ----------------- | --------- |
| T-S3 | Wire the full pipeline end to end: names → zip                                 | A + B | T-A12, T-B4–T-B12 | 3         |
| T-S4 | Visual regression tests against the 10 mockups                                 | B     | T-A2, T-S3        | all       |
| T-S5 | Unit tests for real JSON edge cases (hybrid, XX, colour indicator, multi-type) | A     | T-A6–T-A8         | 5         |
| T-S6 | Performance run on a 100-card deck, including art downloads                    | A     | T-S3, D24         | 10.5      |
| T-S7 | Accessibility and localisation work, as scoped by D24                          | B     | D24, T-S3         | 10.3–10.4 |
| T-S8 | User documentation: README usage, input format, licensing notes                | A     | T-S3, D23         | —         |

## Phase 4: Special layouts (after v1, or as scoped by D1)

| ID    | Task                                                                                                         | Owner | Depends on | Req     |
| ----- | ------------------------------------------------------------------------------------------------------------ | ----- | ---------- | ------- |
| D25   | Mockups and rules for the in-scope special layouts, and the meaning of the flip markers (including "Ignite") | PO    | D1         | 8.1–8.3 |
| T-A13 | Parse multi-face data (double-faced, split, adventure and others) into the card model                        | A     | D25, T-A6  | 8       |
| T-B13 | Render double-faced faces, back-face marker, split, adventure, saga, class and battle                        | B     | D25, T-B10 | 8       |

## Critical path and parallel working

- **Critical path:** S1 → T-B1 → D5 → T-B2 → T-B7 → T-B8 → T-B10 → T-S3. The rendering track is longer, so Dev B's blockers (D5, D6, D8, D11) should be decided first.
- **Early start for Dev B:** the fixture set (T-A2) lets Dev B build the whole renderer without waiting for any of Dev A's parsing.
- **Dev A's stretch:** Dev A has slack between T-A8 and T-A11. That time can go on the configuration tables, the art fetcher and the edge-case tests (T-S5).
- **Decisions that stop both developers:** D2, D8 and D11 block both tracks. Chase them in the first week.
- **Decisions that only block release:** D23 (legal) doesn't block development, but it must be resolved before anything is published.
