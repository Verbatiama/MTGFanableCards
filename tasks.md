# MTG Fannable Cards — Tasks

Task plan derived from `Requirements.md`. The work is split into two tracks so two developers can work at the same time:

- **Dev A** builds the data pipeline: input, card data, parsing, art and output.
- **Dev B** builds the renderer: layout, stat bar, card box and text.

The two tracks meet at a **card model**, an agreed data structure describing one card ready to draw. Once the developers agree it in task S1, Dev B can render from hand-written sample card models while Dev A builds the parser that produces them.

Decisions (D) are owned by the project owner (PO) unless marked otherwise. References in the Req column point to sections of `Requirements.md`.

## Phase 0: Blocking decisions and setup (week 1)

These decisions block most of the build work, so they should be settled first.

| ID   | Task                                                                                                                         | Owner  | Depends on | Req         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ----------- |
| D1   | ✓ DECIDED: V1 includes all card types (single-face rendering), double-faced as two images, special layouts post-v1           | PO     | —          | 2.5         |
| D2   | ✓ DECIDED: Scryfall Default Cards + Unique Artwork, downloaded daily                                                         | PO + A | —          | 3.3.1–3.3.2 |
| D3   | ✓ DECIDED: Decklist format with quantities, both // and single face names, warning for unmatched (no batch failure)          | PO     | —          | 3.2.2–3.2.6 |
| D4   | ✓ DECIDED: PNG 750×1050px (300 DPI), black border, card-name.png naming, zip "cards", optional PDF A4 with 9 tiled cards     | PO     | —          | 3.5         |
| D5   | ✓ DECIDED: node-canvas with Canvas 2D API (backend and frontend, same code)                                                  | B      | —          | 3.1.3       |
| D6   | ✓ DECIDED: Use Beleren fonts from Assets/Fonts/ (free to use)                                                                | PO + B | —          | 10.1        |
| D7   | ✓ DECIDED: Custom SVG mana symbols from res/symbols/, Scryfall SVGs for set/type icons, custom watermarks                    | PO     | —          | 9.1         |
| D8   | Set exact layout dimensions, icon sizes and spacing, and decide whether a mirrored bar is needed                             | PO     | D4         | 1.3, 4.3    |
| D9   | ✓ DECIDED: Backend API + frontend UI (API for programmatic access, UI for decklist input)                                    | PO     | —          | 3.1.2       |
| D10  | Decide the art policy: runtime download, caching, rate limiting, offline behaviour and placeholder, cropping                 | PO     | D2         | 3.4         |
| S1   | Agree the card-model schema: types, grouped mana, stats, loyalty, colour indicator, zone symbols, text tokens, footer fields | A + B  | —          | 3.3.1       |
| T-A1 | Scaffold the project: Node repo, linting, test framework, CI, folder structure                                               | A      | —          | 3.1.1       |
| T-B1 | Rendering spike: draw a bar, a symbol, text with an inline icon, and export a PNG with two candidate technologies            | B      | —          | 3.1.3       |
| T-A2 | Build a fixture set: the 10 mockup cards plus edge cases, as hand-written card-model JSON                                    | A      | S1         | all         |

## Phase 1: Rule decisions (weeks 1–3, alongside build work)

These can be settled while building starts. Each one blocks only the tasks listed in Phase 2.

| ID   | Task                                                                                                                                                                                      | Owner  | Depends on | Req               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ----------------- |
| D11  | Mana display rules: colourless vs generic, XX, Y/Z, hybrid variants, Phyrexian, snow, {0} vs no cost, symbol order, whether the in-text pill matches the bar                              | PO     | —          | 5.3, 6.4.6        |
| D12  | Zone/timing symbols: full mechanic → symbol mapping, detection method, whether triggered abilities count, FLASH vs INSTANT label, whether instants get the bolt, maximum number and order | PO     | —          | 5.4.1–5.4.7       |
| D13  | Meaning of the "NORMAL" icon and when it appears                                                                                                                                          | PO     | —          | 5.4.8             |
| D14  | Card type icons for Battle, Kindred and others; icon order for multi-type cards                                                                                                           | PO     | D1         | 5.1.3–5.1.4       |
| D15  | Supertypes: whether planeswalkers show LEGENDARY; icons for Snow, World and Token                                                                                                         | PO     | —          | 5.5.3–5.5.4       |
| D16  | Subtypes: final list, precedence when a card has several, which icons get text labels                                                                                                     | PO     | —          | 5.5.8–5.5.10      |
| D17  | Colour indicator appearance and mana-block reflow                                                                                                                                         | PO     | —          | 5.2.3–5.2.5       |
| D18  | Bottom section: permanence label rule, lands, special P/T values, vehicles, battles and spacecraft                                                                                        | PO     | D1         | 5.7.3–5.7.7       |
| D19  | Stat-bar overflow and collision rules                                                                                                                                                     | PO + B | D8         | 4.4, 5.3.9, 5.6.3 |
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
| T-B8  | Stat bar middle: stack of zone/timing, NORMAL, supertype and subtype icons                          | T-B7, D12, D13, D15, D16      | 5.4–5.6      |
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
