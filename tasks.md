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
| D15  | ✓ DECIDED: Planeswalkers show the Legendary crown like any legendary card; Basic, Snow (snowflake) and World (globe) get icons; no supertype labels (revised after T-B11); Token out of scope for v1; several supertypes = one icon each, type-line order | PO     | —          | 5.5.3–5.5.4       |
| D16  | ✓ DECIDED: Icons only for attaching subtypes (Aura, Equipment, Fortification) and basic land types (their mana symbol, own group centred beside the text box, pushed down by the middle stack); no other subtype icons; several = one each, type-line order; subtype icons have no label | PO     | —          | 5.5.8–5.5.10      |
| D17  | ✓ DECIDED: One circle split into a wedge per colour (WUBRG, clockwise from the top) with divider lines; mana block moves down only when an indicator is present | PO     | —          | 5.2.3–5.2.5       |
| D18  | ✓ DECIDED: Only NON-PERMANENT is shown (no PERMANENT label, lands included); special P/T as printed, shrunk to fit; vehicles and spacecraft show hollow P/T; battles get a defense badge; station post-v1 | PO     | D1         | 5.7.3–5.7.7       |
| D19  | ✓ DECIDED: Middle order attaching subtype → supertype → zone/timing; the stack hangs from the top of the type line beside the text box (planeswalkers: grows up from the type line beside the art; revised in T-B8); on collision it drops labels, then shrinks icons (never hides); mana block and top/bottom never move; no mana-row limit | PO + B | D8         | 4.4, 5.3.9, 5.6.3 |
| D20  | ✓ DECIDED: Set symbol plain black (Scryfall SVG); watermark from Scryfall field + custom SVGs; sword/shield only for numeric ±N/±N; all extra text symbols; drop flavour then shrink; copyright year = generation year (field removed); no holo stamp | PO     | D7         | 6.3–6.5           |
| D21  | ✓ DECIDED: Frames match real cards (sampled colours, textured border, pinlines); hybrid = split frame; coloured artifacts = card colour; lands use the real land frame (stone frame, colour in pinlines/bars/text box, by card colour or produced mana; 2 = blend, 3+/any = gold); colourless = artifact/Eldrazi frame, devoid = translucent over the art; tokens post-v1 | PO     | D1         | 6.6.2             |
| D22  | ✓ DECIDED: Equal-height bands filling the text box, one font size, shrink to fit; then text box grows into the art (no ability limit); ±X like numbers; printed-card cost badges (+ up, − down, 0 flat) | PO     | —          | 7.2.6–7.2.7       |
| D23  | ✓ DECIDED: No attribution needed (Osprey Dawn mockup is only a reference); follow the Fan Content Policy (free, non-commercial, notice in README and app); no marking on card images | PO     | —          | 1.4, 10.2         |
| D24  | ✓ DECIDED: No formal accessibility target; English only for v1 (labels in config); no performance target, generation time measured and reported | PO     | —          | 10.3–10.5         |
| T-S2 | ✓ DONE: Reviewed every decision (D1–D24) against Requirements: all questions answered and recorded except 8.1/8.3 (deferred to D25); answered the gaps (name matching, printing selection, art crop, output location, README goals) | A or B | D12        | 12                |

## Phase 2: Core build (weeks 2–6)

### Planning: hosting and deployment

Decide these first: they set the frameworks the API, frontend and deployment are built on, so they block the server, UI and deployment work, but not the parsing or rendering tasks.

| ID  | Task                                                                                                                                                                                                                       | Owner  | Depends on   | Req   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------ | ----- |
| D26 | ✓ DECIDED: Fastify; JSON REST under /api with background jobs + polling (POST /api/jobs, GET status, download); OpenAPI from route schemas; configurable limits (64 KB, 250 cards, 2 concurrent jobs, files kept 1 h) | PO + A | D9           | 3.6.1 |
| D27 | ✓ DECIDED: React + Vite (JS, source in web/, served by Fastify); batches rendered on the server, live single-card previews in the browser with src/render/; no thumbnail gallery | PO + B | D5, D9       | 3.6.2 |
| D28 | ✓ DECIDED: DigitalOcean VPS in Sydney (2 GB, ~US$12/month, owner pays) running the self-hosting Docker setup; data and art cache on a Docker volume; fannable.verbatiam.dev with Caddy and automatic TLS | PO     | D2, D10, D23 | 3.6.3 |
| D29 | ✓ DECIDED: Docker image (GHCR) + Compose file with optional Caddy profile; env-var settings; art cache capped (10 GB default, drop least-used 25% at the cap); CLI via the same image or npm run cli; Linux x86-64, 2 GB RAM, ~15 GB disk | PO + A | D5, D26      | 3.6.4 |
| D30 | ✓ DECIDED: Deploy on every push to main (CI → GHCR :main → SSH compose pull/up), graceful shutdown finishes running jobs; built-in Scryfall refresh every 24 h; JSON logs + free uptime check on /api/health; per-IP rate limits (10 jobs/h, 120 previews/min) | PO + A | D26, D28     | 3.6.5 |

### Dev A: data pipeline

| ID    | Task                                                                                                                                                           | Depends on           | Req          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------ |
| T-A3  | ✓ DONE: Card data loader (src/data/): downloads Scryfall Default Cards + Unique Artwork (gzipped JSON Lines) when newer, refreshes every 24 h and swaps without a restart, indexes English cards by full/face name with suggestions; real data: 35k cards, ~10 s, ~560 MB heap | T-A1, D2             |  3.3, 3.3.2          |
| T-A4  | ✓ DONE: Decklist parser (src/parse/decklist.js: quantities, (SET) number / [SET], sections, comments, foil markers) and printing selection (src/data/resolve.js: first regular printing by default, set/number with fallback warnings, unmatched names with suggestions) | T-A3, D3, T-S2       | 3.2, 3.3.3   |
| T-A5  | ✓ DONE: Mana cost parser (src/parse/mana-cost.js): groups symbols with counts in the D11 order, generic summed and last, {0} vs no cost; matches all fixtures and parses every per-face cost in the Scryfall data | S1, D11              | 5.3          |
| T-A6  | ✓ DONE: Card-model mapper (src/model/from-scryfall.js): Scryfall printing → one model per face (type line split, WUBRG colours, colour indicator, grouped mana, stats, footer); reproduces all fixtures; all 110k real faces validate; split/flip/adventure refused (out of scope) | T-A3, T-A5, S1       | 3.3.1        |
| T-A7  | ✓ DONE: Oracle text tokenizer (src/parse/oracle-text.js): text/symbol/P-T tokens, italic reminder and flavour text, sword/shield only for numeric ±N/±N, planeswalker loyalty cost split; the preview spike now uses it (previews unchanged) | S1, D11, D20         | 6.4          |
| T-A8  | ✓ DONE: Zone/timing detection (src/parse/zone-symbols.js, table in src/config/zone-symbols.js): keywords counted only when the face has them, instants get Flash, self-in-zone phrases; wired into the mapper, matches every fixture; warp added (hand) | T-A6, D12            | 5.4          |
| T-A9  | ✓ DONE: Configuration tables in src/config/ (card types, supertypes, subtypes and land mana, zone/timing styles and keywords, text and stat symbols, frame palettes, labels); mapper and preview spike use them (previews unchanged); a test pins the icons still to be made | S1, D7, D14–D16, D21 | 9            |
| T-A10 | ✓ DONE: Art fetcher (src/art/art-cache.js): disk cache with a usage index, 100 ms request spacing, shared in-flight downloads, null on failure (black placeholder), least-used 25% evicted at ART_CACHE_MAX_GB; the preview spike uses it | T-A4, D10, T-S2, D29      | 3.4          |
| T-A11 | ✓ DONE: Output (src/output/): file names from face names with counters for copies, PNG writer, cards.zip (fflate), A4 PDF with 9 cards per page at 63 × 88 mm as JPEGs, with cut lines (pdf-lib); the preview spike also writes _sheets.pdf | D4, T-B2             | 3.5          |
| T-A12 | ✓ DONE: CLI (src/cli.js, `npm run cli -- deck.txt`): cards.zip in out/ by default, `--pdf`/`--png`/`--zip`, `--out`, stdin with `-`; problems on stderr by line, exit 0 unless nothing was generated, `--strict` exits 1 on any problem (decided with the PO); shared decklist → images step in src/generate.js for T-C1; Docker wiring left to T-S9                                                                                                                            | T-A4, T-A11, D9      | 3.1.2, 3.2.6 |

### Dev B: renderer

| ID    | Task                                                                                                | Depends on                    | Req          |
| ----- | --------------------------------------------------------------------------------------------------- | ----------------------------- | ------------ |
| T-B2  | ✓ DONE: Render foundation: layout and font config (src/config/layout.js), renderCard(ctx, model, { env, art }) for node-canvas and the browser (src/render/render-card.js), Node side with Beleren fonts and PNG output (src/render/node.js), `npm run render:fixtures` into out/render/ | D5, D6, D8, S1                | 4            |
| T-B3  | ✓ DONE: Asset loader (src/render/assets.js): sheet symbols by Scryfall code, generic and composed mana symbols, icons by config path, cached tinting, placeholders for icons that fail to load; environment-neutral (Node env in src/render/node.js); sheet cutter moved to src/render/symbol-sheet.js; the spike uses it (previews unchanged) | T-B2, D7                      | 9.1          |
| T-B4  | ✓ DONE: Card-box frame (src/render/frame.js): framePalette for the D21 colour rules, textured border, pinlines, name bar, art box with centre crop, type line with the Scryfall set symbol (src/art/set-symbols.js, cached) or the set code, text box background; the spike uses it | T-B2, D20, D21                | 6.1–6.3, 6.6 |
| T-B5  | ✓ DONE: Text box (src/render/text-box.js): wrapping with inline symbols (src/render/symbols.js, grey-circle fallback for codes without an image), slanted italics for reminder and flavour text, sword/shield P/T modifiers wrapped as one group, flavour divider, watermark (or its name), fitting that drops flavour then shrinks to the minimum; planeswalkers and basic lands left to T-B11/T-B12; the spike uses it (previews unchanged) | T-B2, T-A7 (or fixtures), D20 | 6.4          |
| T-B6  | ✓ DONE: Footer (src/render/footer.js): collector number and rarity letter, set code and language, artist with the paintbrush (name shrinks to stay clear of the left column), copyright with the generation year; no holo stamp; the spike uses it | T-B2, D20                     | 6.5          |
| T-B7  | ✓ DONE: Stat bar top (src/render/stat-bar.js): statBarTop() lays out type icons (one row, type-line order, shrunk to fit; no icon for out-of-scope types), the wedge colour indicator in its own row only when present, and the mana rows with counts; sizes in BAR_TOP (src/config/layout.js); returns where the top ends for the middle stack; the spike uses it (previews unchanged) | T-B3, D11, D14, D17           | 5.1–5.3      |
| T-B8  | ✓ DONE: Stat bar middle (src/render/stat-bar.js): statBarMiddle() stacks attaching subtypes, supertypes and zone/timing symbols hanging from the top of the type line (planeswalkers: growing up from it), drops labels then shrinks icons to half size, flags overflow; land mana symbols centred on the text box, pushed down by the stack; sizes in BAR_MIDDLE; anchoring decided with the PO (D19 revised); stress-spill renamed stress-long-stack | T-B7, D12, D13, D15, D16      | 5.4–5.6      |
| T-B9  | ✓ DONE: Stat bar bottom (src/render/stat-bar.js): statBarBottom() picks power/toughness (values as printed, shrunk to fit, digit-sized `*`; hollow with outlined icons for vehicles and spacecraft), the starting loyalty badge, the defense badge or the vertical NON-PERMANENT label; sizes in BAR_BOTTOM, which also set how far the middle stack may reach; shared drawBadge for loyalty costs (T-B11); the spike uses it | T-B2, D18                     | 5.7          |
| T-B10 | ✓ DONE: Stat-bar overflow and collision handling: a mana block past the type line pushes the hanging stack below it; what still doesn't fit (middle stack at half size, mana rows, rules text at the minimum) is drawn anyway and returned as warnings from renderCard (no red mark on the card), printed by the spike; new stress-mana-rows case | T-B7–T-B9, D19                | 4.4          |
| T-B11 | ✓ DONE: Planeswalker layout (src/render/planeswalker.js): cardLayout() gives equal ability bands filling the text box (one font size, shrink to fit, then the text box grows into the art and the type line moves up); shaded alternate bands; loyalty cost badges centred on their bands (static abilities none, ±X like numbers); renderCard lays out first and passes the bands to every part; warns (and skips the art) when abilities need more room than the art has; sizes in ABILITY_BAND; the spike uses it (previews unchanged) | T-B5, T-B9, D22               | 7.2          |
| T-B12 | ✓ DONE: Basic land (src/render/text-box.js): the mana symbol it taps for (from its rules text, {C} for Wastes), large and centred in the text box instead of text, smaller if the box is short; size in BASIC_LAND_SYMBOL; the spike uses it (previews unchanged). The real renderer now matches the spike on every fixture except the spike's BACK FACE marker (T-B13) | T-B5                          | 6.4.4        |
| T-B14 | ✓ DONE: Missing icons (`npm run symbols:build`): power, text symbols, loyalty badges, 30 watermarks and artist brush from the Mana font (SIL OFL); Battle, Kindred, split second, supertypes, subtypes and defense badge drawn; Y, Z and 15 extra hybrids composed; all in src/config; the preview spike uses them | D7, D14–D16, D18, D20 | 9.1 |

### Application: API and frontend

| ID   | Task                                                                                                                                                         | Owner | Depends on       | Req                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------------- | ------------------- |
| T-C1 | ✓ DONE: API on Fastify (src/server/): jobs (POST /api/jobs → 202, status with progress, queue position and the full report, download), in-memory queue with MAX_RUNNING_JOBS and expiry, previews (/api/cards, /api/art/:id, new /api/set-symbols/:code, /assets/fonts and /assets/symbols), JSON-schema validation and limits, OpenAPI at /api/docs, /api/health, per-IP rate limits (forwarded headers trusted from private addresses; TRUST_PROXY), graceful shutdown that finishes running jobs, JSON logs; serves web/dist when built | A     | D26, D30, T-A4, T-A11 | 3.1.2, 3.2.6, 3.5   |
| T-C2 | ✓ DONE: Frontend in React + Vite (web/, `npm run web:dev` / `web:build` into web/dist, served by the API): decklist input (remembered in the browser), live preview of the line under the cursor drawn with src/render/ in the browser (both faces; within font anti-aliasing of the server render), clickable suggestions for unmatched names, zip/PDF choice, progress and queue position, problem report with links to the lines, download, Fan Content notice; light and dark, phone width; CI builds it | B     | D27, T-C1        | 3.1.2, 3.2.6, 10.2  |

## Phase 3: Integration and hardening (weeks 6–8)

| ID   | Task                                                                           | Owner | Depends on        | Req       |
| ---- | ------------------------------------------------------------------------------ | ----- | ----------------- | --------- |
| T-S3 | ✓ DONE: Pipeline wired end to end (names → zip) through src/generate.js for the CLI, the API jobs and the browser previews; test/pipeline.test.js runs every fixture's real Scryfall printing through database → decklist → models → renderer → zip and gets images identical to the fixture renders; smoke run of 3,000 random real cards: no failures or warnings, only split/adventure/flip skipped | A + B | T-A12, T-B4–T-B12, T-C1, T-C2 | 3         |
| T-S4 | ✓ DONE: Visual regression against the 10 mockups: every difference listed in changes.md (26) and decided with the PO; 12 applied (mockup-sized P/T, new Aura/Equipment/Basic/Legendary/planeswalker icons, non-basic icon, centred rules text, plain ±N/±N, ringed inline symbols, mockup frame colours, full-art basics, no watermarks, no collector number/rarity); test/visual.test.js compares the 10 renders with approved references (`npm run visual:update`), `npm run mockups:compare` puts each beside its mockup | B     | T-A2, T-S3        | all       |
| T-S5 | Unit tests for real JSON edge cases (hybrid, XX, colour indicator, multi-type) | A     | T-A6–T-A8         | 5         |
| T-S6 | Performance run on a 100-card deck, including art downloads                    | A     | T-S3, D24         | 10.5      |
| T-S7 | Accessibility and localisation work, as scoped by D24                          | B     | D24, T-S3         | 10.3–10.4 |
| T-S8 | User documentation: README usage, input format, licensing notes                | A     | T-S3, D23         | —         |
| T-S9 | Deployment: Docker image published to GHCR (`:main` on every push, `:vX.Y.Z`/`:latest` on tags), `docker-compose.yml` with the optional Caddy profile and log rotation, GitHub Actions deploy to the VPS on every push to main (D30), self-hosting guide (D29). Give Node enough heap for a refresh, when two card databases briefly coexist (~1.2 GB; e.g. `--max-old-space-size=1536`) | A     | T-S3, D26–D30, T-S11     | 3.6       |
| T-S10 | Provision the VPS (D28): DigitalOcean droplet in Sydney, 2 GB; firewall (SSH, HTTP, HTTPS only), Docker, Caddy reverse proxy | PO + A | D28, D29 | 3.6.3 |
| T-S11 | Set up the subdomain: DNS record for `fannable.verbatiam.dev` pointing at the VPS, Caddy site with automatic Let's Encrypt TLS, check HTTPS works | PO | T-S10 | 3.6.3 |
| T-S12 | Monitoring: free uptime monitor on `https://fannable.verbatiam.dev/api/health` with email alerts to the owner | PO | T-S9 | 3.6.5 |

## Phase 4: Special layouts (after v1, or as scoped by D1)

| ID    | Task                                                                                                         | Owner | Depends on | Req     |
| ----- | ------------------------------------------------------------------------------------------------------------ | ----- | ---------- | ------- |
| D25   | Mockups and rules for the in-scope special layouts, and the meaning of the flip markers (including "Ignite") | PO    | D1         | 8.1–8.3 |
| T-A13 | TODO: Parse multi-face data (double-faced, split, adventure and others) into the card model                        | A     | D25, T-A6  | 8       |
| T-B13 | Render double-faced faces, back-face marker, split, adventure, saga, class and battle                        | B     | D25, T-B10 | 8       |

## Critical path and parallel working

- **Critical path:** S1 → T-B1 → D5 → T-B2 → T-B7 → T-B8 → T-B10 → T-S3. The rendering track is longer, so Dev B's blockers (D5, D6, D8, D11) should be decided first.
- **Early start for Dev B:** the fixture set (T-A2) lets Dev B build the whole renderer without waiting for any of Dev A's parsing.
- **Dev A's stretch:** Dev A has slack between T-A8 and T-A11. That time can go on the configuration tables, the art fetcher and the edge-case tests (T-S5).
- **Decisions that stop both developers:** D2, D8 and D11 block both tracks. Chase them in the first week.
- **Decisions that only block release:** D23 (legal) doesn't block development, but it must be resolved before anything is published.
