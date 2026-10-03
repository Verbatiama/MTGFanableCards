# MTG Fannable Cards — Requirements

This document consolidates the project goals from `README.md` and `Components of a card.md`, the reference mockups (Niv-Mizzet, the Firemind; Damnation; Sword of Fire and Ice; Jace, the Mind Sculptor; Feral Invocation; and the ten-card composite), and decisions made by the project owner. It is arranged in the order an implementer needs it: what the app is, how data flows through it, how a card is laid out, the rules for each card kind, the reference data the renderer depends on, and finally the questions that still need answers.

Each requirement is tagged:

- **[Confirmed]**: stated by the owner or unambiguous in the mockups.
- **[Inferred]**: observed in the mockups but not explicitly confirmed; verify before relying on it.
- **[Open]**: not yet decided; see section 11 for the consolidated question list.

---

## 1. Purpose and concept

1.1 **[Confirmed]** The application generates Magic: The Gathering cards in a new "fannable" layout.

1.2 **[Confirmed]** "Fannable" means that when the cards in a hand are fanned out, as much information as possible sits on the visible edge. A black **stat bar** runs the full height of the card's left edge, and it carries the information a player needs while only that strip is visible: card type, mana cost, colour indicator, timing/zone symbols, supertype, subtype, the NON-PERMANENT label, and stats, loyalty or defense.

1.3 **[Confirmed]** No mirrored (right-edge bar) variant for v1 (D8, 4.3).

1.4 **[Confirmed]** The composite mockup carries an "OSPREYDAWN" watermark: Osprey Dawn made that mockup, and the project uses it only as a reference example. The project does not reuse their work, so no permission or attribution is needed (D23).

---

## 2. Scope and priorities

2.1 The README originally listed these goals (it now lists them without numbers, with goals 8, 11, 12 and 13 merged as 2.2 describes). **[Confirmed]** They are a feature list, not a priority order or milestone plan; ordering and phases come from `tasks.md` (T-S2 review):

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
- **Unsupported layouts in a decklist** (T-A6): split, flip and adventure cards, whose halves share one side, can't be mapped in v1. They are reported for that line, like unmatched names (3.2.6), and the rest of the batch continues. Other special layouts with a single face (saga, class, leveler and so on) are drawn as normal cards until Phase 4.

---

## 3. Application architecture

### 3.1 Runtime

3.1.1 **[Confirmed]** The application runs on Node.js and is written in JavaScript.

3.1.2 **[Confirmed]** Interface: **Backend API for programmatic access + frontend UI for decklist input**. Users can input a decklist with quantities via the UI, and developers can call the API directly.

3.1.3 **[Confirmed]** Rendering approach: **node-canvas with Canvas 2D API**. Same drawing code works in both backend (Node.js via node-canvas) and frontend (native browser CanvasRenderingContext2D). Direct pixel control for precise card layout. Server-side rendering runs on Linux (WSL for development on Windows): node-canvas cannot load the bundled Beleren fonts on native Windows (see `spikes/rendering/README.md`, T-B1).

### 3.2 Input

3.2.1 **[Confirmed]** The user supplies card names. Each name is looked up in a JSON file of Magic cards.

3.2.2 **[Confirmed]** Input format: **Decklist format with quantities** (e.g., `4 Lightning Bolt`, `1 Counterspell`). Quantities are respected; `4 Lightning Bolt` produces four card images.

- Accepted lines (T-A4): `4 Lightning Bolt`, `4x Lightning Bolt`, or a bare name (quantity 1), optionally followed by a printing as `(M10)`, `(M10) 146` or `[M10]`, the formats Arena, MTGO and Moxfield export. Trailing foil markers such as `*F*` are ignored.
- Blank lines, comments (`//` or `#`) and section headers (Deck, Sideboard, Commander, Companion, Maybeboard, ...) are skipped. Cards in every section are generated. A quantity of 0 is reported as an error for that line.

3.2.3 **[Confirmed]** Quantities: `4 Lightning Bolt` produces **four separate images** (one per copy).

3.2.4 **[Confirmed]** Name matching is case-insensitive exact (T-S2 review): case, repeated spaces and curly vs straight apostrophes are ignored, otherwise the name must match. A name that doesn't match is reported as unmatched (3.2.6), with up to three close suggestions in the warning; it is never replaced automatically.

3.2.5 **[Confirmed]** Double-faced card names: accept **both** the full name with `//` (e.g., `Delver of Secrets // Insectile Aberration`) **and** either face name alone (e.g., `Delver of Secrets` or `Insectile Aberration`).

3.2.6 **[Confirmed]** Unmatched names (typos, card doesn't exist): **Frontend displays a warning; API returns a success/failure report** along with the generated files. Cards that match are processed; unmatched cards are reported but do not block the batch.

3.2.7 **[Confirmed]** English only for v1: English card names and English output (10.4, D24).

### 3.3 Card data source

3.3.1 **[Confirmed]** Card data source: **Scryfall bulk data**. Use Default Cards JSON (one unique card per printing) plus Unique Artwork files (all artwork variants per card). This provides complete card details and all artwork options.

3.3.2 **[Confirmed]** Files are downloaded daily. The app fetches updated data on startup (or on demand) and caches locally.

3.3.3 **[Confirmed]** Printing selection (T-S2 review). One card name matches many printings, and art, set symbol, collector number and rarity all vary by printing.

- The user can name a printing after the card: `4 Lightning Bolt (M10)` (set code) or `4 Lightning Bolt (M10) 146` (set code and collector number), the format Arena and MTGO exports use.
- Without one, the card's first printing is used: the earliest paper printing that isn't a promo, oversized or gold-bordered memorabilia, so the default is never a prerelease promo or a digital-only version. A card with no such printing uses its earliest printing (T-A4).
- A set code with no printing of the card, or a collector number not in that set, falls back (to the default, or to the set's first printing) with a warning; Arena's own set codes, such as DAR for Dominaria, can differ from Scryfall's.

  3.3.4 **[Confirmed]** The type line shows the card's real type line from the JSON. Subtypes invented in the mockups ("Sorcery - Wrath", "Artifact - Sword", "Enchantment - Beast", "Planeswalker - Jace Beleren") are to be ignored.

  3.3.5 **[Confirmed]** Rules text comes from Oracle text in the JSON. The mockup text contains typos ("it's owner's", "hhis") and is not authoritative.

  3.3.6 **[Confirmed]** Card-model schema for v1: each card is represented as a single object containing identity fields (`name`, `types`, `supertypes`, `subtypes`, `layout`), mana info (`manaCost` with grouped symbol counts), power/toughness or loyalty fields, colour indicator information, oracle text kept in the same formatting as Scryfall, and footer metadata (`collectorNumber`, `rarity`, `setCode`, `artist`). There is no `copyright` field: the renderer builds the copyright line itself (6.5.2, D20). This structure is sufficient for rendering, and additional fields can be added later only if a concrete need appears.

### 3.4 Card art

3.4.1 **[Confirmed]** Card art sourcing:

- **Source:** Scryfall image URLs (via the Unique Artwork files for artwork variants)
- **Timing:** Downloaded at runtime during card generation
- **Caching:** Downloaded images are cached locally to avoid re-downloading
- **Rate limiting:** Requests are spaced 100ms apart to respect Scryfall API limits
- **Cache size:** capped; the least-used 25% of art is deleted when the cap is reached (3.6.4, D29).
- **Fallback behavior:** If art is unavailable (failed request, network error, or no image URL in data), render a **solid black placeholder** in the art box. The card still generates successfully.

  3.4.2 **[Confirmed]** Art is scaled to cover the art box, which is narrower than a standard card because of the stat bar, and the overflow is trimmed evenly from both sides (centre crop). No distortion and no empty space (T-S2 review).

### 3.5 Output

3.5.1 **[Confirmed]** Output format: **PNG, 750×1050 pixels (300 DPI for printing)**. Cards include a black border around the edges. **[Confirmed]** The border is 36px (about 3 mm, like a printed card) on all four sides, outside the stat bar, frame and footer; it is one setting (`BORDER` in `src/config/layout.js`). The text box keeps its size and the art box is shorter to make room. The loyalty and defense badges straddle the bar's bottom edge into the border (5.7.7, 7.2.3). All images bundled into a zip file named `cards`.

3.5.2 **[Confirmed]** File naming: `card-name.png` (e.g., `Lightning-Bolt.png`, `Counterspell.png`). Duplicate card names are handled by appending a counter if needed (e.g., `Counterspell-2.png`).

3.5.3 **[Confirmed]** Output options:

- **Default:** Zip file with individual PNG images
- **Optional:** PDF (A4 size) with 9 cards tiled per sheet for printing convenience. Cards are placed at real card size, 63 × 88 mm (about 300 DPI), in a 3 × 3 grid centred on the page, so printed cards can be cut out and sleeved (T-A11). Cards are embedded as JPEGs (quality 0.92), about a quarter of the size of PNGs with no visible loss in print. Thin grey cut lines run along every card edge in use: horizontal lines across the full page width, vertical lines from the top of the page to the bottom of the last row of cards, so they show on the margins and on the cards' black borders.

  3.5.4 **[Confirmed]** Double-faced cards: **Two separate images** (front and back). Each face gets its own PNG file (e.g., `Delver-of-Secrets.png` and `Insectile-Aberration.png`, or with face labels if needed).

  3.5.6 **[Confirmed]** The zip is named `cards` (`cards.zip`, or `cards.pdf` for the PDF option; D4). The frontend downloads it in the browser and API calls return it in the response; the server keeps the finished file only until it expires (1 hour by default, 3.6.1). Script and command-line runs write to `out/` (T-S2 review).


### 3.6 Hosting and deployment

The application has a backend API and a frontend UI (3.1.2, D9), but how it is built and hosted is not decided yet (decisions D26–D30 in `tasks.md`).

3.6.1 **[Confirmed]** Backend framework and API design (D26):

- **Framework:** Fastify, replacing the `node:http` health-check stub. Requests are validated with Fastify's JSON schemas, and the OpenAPI description is generated from the same schemas.
- **Batch flow:** background jobs with polling, so long decks don't hit proxy timeouts and the UI can show progress. Jobs and their finished files are held by the single server process (in memory and a local temporary directory), so unfinished jobs are lost on restart.
- **Endpoints**, JSON under `/api`:

| Method and path              | Purpose                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`            | Health check (exists)                                                                                                      |
| `POST /api/jobs`             | Body: `{ decklist, format }` with `format` `zip` (default) or `pdf`. Returns `202` with the job id                        |
| `GET /api/jobs/:id`          | Status: `queued`, `running`, `done` or `failed`; cards total and done; unmatched names with suggestions (3.2.4, 3.2.6)     |
| `GET /api/jobs/:id/download` | The finished `cards.zip` or `cards.pdf`                                                                                    |
| `GET /api/cards`             | Preview data (D27): `?line=` one decklist line; returns the card model(s) for the matched printing, or the unmatched report |
| `GET /api/art/:id`           | Art for a preview, served from the art cache (3.4)                                                                         |
| `GET /assets/*`              | Fonts and symbol files for in-browser rendering                                                                            |
| `GET /api/docs`              | OpenAPI description                                                                                                        |

- **Limits**, set by environment variables with generous defaults: decklist body 64 KB, 250 cards per job, 2 jobs running at once (others wait in a queue), finished files kept for 1 hour. Self-hosters can raise or remove them; the CLI has no limits (10.5). Abuse protection for a public instance is D30.

3.6.2 **[Confirmed]** Frontend stack (D27):

- **Stack:** React with Vite, in JavaScript (3.1.1). The source lives in `web/`; Vite builds it into static files that Fastify serves, and during development Vite's dev server proxies `/api` to Fastify.
- **Rendering:** batches are rendered on the server, in the background job (3.6.1). The UI also previews single cards live in the browser with the same drawing code from `src/render/` (3.1.3): selecting a decklist line shows that card (both faces for double-faced cards). Previews use the Beleren fonts and symbol files served by the app, so they match the server output closely, but small font-rendering differences between browsers and node-canvas are possible; the downloaded files are the reference.
- **No thumbnails:** after a batch finishes, the UI offers the download only; it does not show the generated images.

3.6.3 **[Confirmed]** Cloud hosting (D28):

- **Platform:** a VPS on DigitalOcean in Sydney (SYD1): 2 GB RAM, 1 vCPU, 50 GB SSD, about US$12/month. It runs the same Docker setup self-hosters use (3.6.4), as one long-running process, which suits the in-memory job model (3.6.1).
- **Cost:** paid by the project owner. The target was about US$10/month; the 2 GB machine, chosen for room to index the Scryfall data in memory, is slightly over. No ads, donations or paid features (10.2).
- **Storage:** the Scryfall bulk data (3.3) and the art cache (3.4) live on the VPS disk, in a Docker volume so they survive redeploys.
- **Domain and TLS:** `fannable.verbatiam.dev`, a subdomain of the owner's domain, pointed at the VPS by a DNS record. A Caddy reverse proxy on the VPS terminates TLS with automatic Let's Encrypt certificates (T-S10, T-S11).

3.6.4 **[Confirmed]** Self-hosting (D29):

- **Distribution:** a Docker image published to GitHub Container Registry for each release, plus a `docker-compose.yml`. The Compose file always runs the app, with a data volume; a Caddy service behind a Compose profile adds HTTPS on a domain, the same setup as the public instance (3.6.3). Running from a clone with `npm start` (Linux, Node.js 22) stays documented as the developer route.
- **CLI:** the same image and repository: `docker compose run app cli decklist.txt`, or `npm run cli -- decklist.txt` from a clone. Output goes to the mounted `out/` folder. No separate npm package.
- **Configuration**, by environment variables:

| Variable              | Default     | Purpose                                                  |
| --------------------- | ----------- | -------------------------------------------------------- |
| `PORT`                | `3000`      | HTTP port                                                |
| `DATA_DIR`            | `/data`     | Scryfall bulk data (3.3)                                 |
| `ART_CACHE_DIR`       | `/data/art` | Art cache (3.4)                                          |
| `ART_CACHE_MAX_GB`    | `10`        | Art cache cap (below)                                    |
| `MAX_BODY_KB`         | `64`        | Decklist request size (3.6.1)                            |
| `MAX_CARDS_PER_JOB`   | `250`       | Cards per job (3.6.1); `0` for no limit                  |
| `MAX_RUNNING_JOBS`    | `2`         | Jobs rendering at once; others queue (3.6.1)             |
| `JOB_TTL_MINUTES`     | `60`        | How long finished files are kept (3.6.1)                 |
| `SCRYFALL_REFRESH_HOURS` | `24`     | How often to check for new Scryfall data (3.6.5)         |
| `RATE_LIMIT_JOBS_PER_HOUR` | `10`   | New jobs per client IP per hour; `0` for no limit (3.6.5) |
| `RATE_LIMIT_PREVIEW_PER_MINUTE` | `120` | Preview requests per client IP per minute; `0` for no limit (3.6.5) |

- **Art cache cap:** the cache records how often each art is used. When it reaches `ART_CACHE_MAX_GB`, the least-used 25% of cached art is deleted (ties broken by least recent use).
- **Minimum requirements:** a Linux host with Docker (x86-64), 2 GB RAM, and about 15 GB of disk: the Scryfall data plus the art cache at its default cap.

3.6.5 **[Confirmed]** Operations (D30):

- **Deployment:** continuous. Every push to `main` runs CI (lint, format, tests); if it passes, GitHub Actions builds the image, publishes it to GitHub Container Registry as `:main`, and deploys it to the VPS over SSH (`docker compose pull && docker compose up -d`). Version tags publish `:vX.Y.Z` and `:latest` for self-hosters (3.6.4). The SSH key and host are GitHub Actions secrets.
- **Graceful shutdown:** because jobs live in the server process (3.6.1), a deploy must not kill them. On shutdown the server stops accepting new jobs and lets running jobs finish, within a grace period (`stop_grace_period` in the Compose file, 5 minutes); queued jobs that never started are lost.
- **Scryfall refresh:** built into the app. Every `SCRYFALL_REFRESH_HOURS` (24) the server checks Scryfall's bulk-data timestamp, downloads newer data, and swaps it in without a restart (3.3.2). This works the same for self-hosters.
- **Logging and monitoring:** structured JSON logs to stdout (Fastify's logger), with Docker log rotation. A free external uptime monitor (e.g. UptimeRobot) checks `GET /api/health` and emails the owner when it fails.
- **Abuse protection:** per-IP rate limits on top of the request limits (3.6.1), returning `429`: `RATE_LIMIT_JOBS_PER_HOUR` (10) for new jobs and `RATE_LIMIT_PREVIEW_PER_MINUTE` (120) for preview requests; `0` turns a limit off. Client IPs come from the reverse proxy's forwarded headers. No accounts or captcha.
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

4.2 **[Confirmed]** The stat bar has three sections (D16–D19):

- **Top**, anchored to the top: card type icon, colour indicator, mana cost.
- **Middle**, hanging from the type line: the top of the first symbol aligns with the top of the type line box, and the stack runs down beside the type line and text box (5.6.2): attaching subtypes, supertypes, zone/timing symbols (5.6.1). Below it, beside the text box, the land mana symbols (5.5.8). Planeswalkers' stack grows upward from the bottom of the type line instead (5.6.2).
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

5.2.2 **[Confirmed]** Cards that need it are mainly back faces of double-faced cards, plus cards such as Ancestral Vision and Dryad Arbor. It should be driven by the JSON colour indicator field.

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
| Hand (`hand`)                     | HAND         | Cycling and every _-cycling_ variant, channel, ninjutsu, commander ninjutsu, transmute, forecast, bloodrush, reinforce, madness, suspend, foretell, plot, warp (added in T-A8: cast from hand, then from exile, like plot) |
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

5.5.2 **[Confirmed]** Basic is shown with a labelled icon, BASIC (Forest, composite image; D15).

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

**[Confirmed]** The basic land type symbols show what the land taps for (D16, revised). They are not part of the middle stack: they form their own group in the bar, one icon per land type in type-line order, centred on the middle of the text box (Breeding Pool shows {G} above {U} there). The middle stack has priority: if it runs far enough down beside the text box to reach them, they are pushed down to sit just under it (5.6.3).

Every other subtype gets no icon and shows only in the type line, including the rest of the Components list (Vehicle, Food, Saga, Curse, Rune, Desert, Gate, Lair, Locus, Urza's, Adventure, Arcane, Lesson, Trap). Whether a subtype gets an icon depends only on the subtype, so Equipment on an artifact creature (reconfigure) and Forest on Dryad Arbor still show; creature subtypes never do (5.5.6). The mapping is a config table (section 9), so a subtype can be added later without code changes. For reference, the earlier open question listed these real subtypes missing from the Components doc:

- **Artifact:** Clue, Treasure, Blood, Map, Powerstone, Incubator, Gold, Contraption, Fortification, Attraction
- **Enchantment:** Class, Room, Case, Role, Shrine, Cartouche, Background, Shard
- **Land:** Cave, Sphere, Town, Mine, Power-Plant, Tower, Planet, and the basic land types (Plains, Island, Swamp, Mountain, Forest, Wastes)
- **Instant/Sorcery:** Omen

5.5.9 **[Confirmed]** A card with several subtypes that have icons shows one icon each, in type-line order, like supertypes (D15, D16). Subtypes without icons are skipped, so an Aura Curse shows only the Aura icon. Overflow is handled by D19.

5.5.10 **[Confirmed]** Subtype icons are icon-only; zone/timing and supertype icons carry a text label (D16).

### 5.6 Middle-section layout

5.6.1 **[Confirmed]** Stack order, top to bottom (D19): attaching subtype icons (Aura, Equipment, Fortification) → supertype icons → zone/timing symbols. Land mana symbols are a separate group beside the text box (5.5.8). Within each group the earlier rules apply: subtypes and supertypes in type-line order (D15, D16), zone/timing in the fixed D12 order. This reverses the Feral Invocation mockup, which has FLASH above AURA; its PERMANENT label is removed by D18 (5.7.3).

5.6.2 **[Confirmed]** The stack hangs from the type line (revised in T-B8): the top of its first symbol is level with the top of the type line box, and it runs down beside the type line and text box. Nothing in the middle stack sits beside the art. **[Confirmed]** Planeswalkers are the exception, as their loyalty costs use the bar beside the text box (7.2.1): their stack's bottom sits at the bottom of the type line and it grows upward beside the art.

5.6.3 **[Confirmed]** Collision rule (D19, revised in T-B8). The stack may run down to the top of the bottom section (stats, defense badge, NON-PERMANENT), less the room the land mana symbols need (5.5.8), which it pushes down ahead of it. A planeswalker's stack may grow up to just under the mana block. When it doesn't fit, these steps apply in order, stopping at the first that fits:

1. **Drop the labels** under supertype and zone/timing icons.
2. **Shrink the icons**, all together, down to a minimum of half size.

Nothing is ever hidden. Order (5.6.1) does not change in any step. In practice, real cards never reach step 1: a legendary creature with flash and flashback fits beside the text box with room to spare. The preview spike has synthetic stress cases for each step (`spikes/fixture-preview/stress.js`).

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

6.3.3 **[Confirmed]** The set symbol comes from Scryfall's set SVGs (D7) and is drawn plain black for every rarity (D20). Rarity is shown only by the letter in the footer (6.5.1). Scryfall's set list maps each set code to its icon (promo sets often use their parent's); the list and the icons are cached, and the list is fetched again at most once a day when a code isn't in it. Without a symbol, the set code is shown instead (T-B4).

### 6.4 Text box

6.4.1 **[Confirmed]** Contains rules text, with flavour text below in italics (Feral Invocation, Lightning Strike).

6.4.2 **[Confirmed]** Reminder text is shown in italics in parentheses (Fiendslayer Paladin).

6.4.3 **[Confirmed]** A watermark (e.g. guild symbol) is drawn behind the text (Niv-Mizzet). **[Confirmed]** Which watermark a card has comes from Scryfall's `watermark` field (e.g. `izzet`); the images are custom SVGs in `res/symbols/` (D7, D20).

6.4.4 **[Confirmed]** Basic lands show a large mana symbol in the text box instead of text (Forest).

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

6.6.1 **[Confirmed]** Frames match real Magic cards in the current frame, with the same colours and saturation (D21, revised). Each frame has a textured border, coloured pinlines around the name bar, art, type line and text box, pale name and type bars, and a pale text box. The colours are sampled from Scryfall scans and kept in the preview spike (`FRAME` and `LAND` in `spikes/fixture-preview/run.js`):

| Card                                        | Frame (reference scan)                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| White                                       | Cream border, off-white bars and text box (Pacifism, DVD)                       |
| Blue (Jace)                                 | Blue border and pinlines, pale blue bars and text box (Divination, M15)         |
| Black (Damnation)                           | Near-black border, grey bars, pale grey-white text box (Murder, EMN)            |
| Red                                         | Red border, peach bars, pale pink text box (Shock, DDN)                         |
| Green (Feral Invocation)                    | Green border, grey-green bars, pale green text box (Giant Growth, EVG)          |
| Multicolour (Niv-Mizzet)                    | Gold border and bars, cream text box; pinlines in the card's two colours (Lightning Helix, DDN), or pale gold for three or more (Mantis Rider, KTK; Bant Charm, 2X2) |
| Colourless artifact (Sword of Fire and Ice) | Blue-grey border, light grey bars and text box (Mind Stone, C14)                |
| Land (Forest, Wasteland)                    | Land frame (6.6.2)                                                              |

6.6.2 **[Confirmed]** Frames not shown in the mockups (D21):

- **Two-colour hybrid** (Kitchen Finks {G/W}; Phyrexian hybrid such as Ajani's {G/W/P} too): the border, pinlines and text box are split, left the first colour of the hybrid symbol and right the second, blended in the middle; the bars are grey and the text box is paler than either colour's (Kitchen Finks, UMA). Other two-colour cards are gold.
- **Coloured artifacts** (Reaper King): the card's colour, by the same rule as any card (mono colour, gold, or split). Only colourless artifacts use the artifact frame.
- **Lands** use the land frame of real cards (current frame), with the same colours and saturation (D21, revised). Every land has the same textured stone frame; the colour is in the pinlines around each panel, the name and type bars, and the text box. The palette comes from the card's colour if it has one (Dryad Arbor green), otherwise from the colours it taps for (its "Add …" text and basic land types). No colour: grey panels with a grey-brown pinline (Wasteland). One colour: that colour's land palette (Forest green). Two colours: grey bars, with the pinlines and the text box blending from the first colour to the second (Breeding Pool green → blue). Three or more, or "any color": gold pinlines and bars with a cream text box (City of Brass). The colours are sampled from Scryfall scans: the M19 basics, Wasteland (EMA), Command Tower (CMR) and Breeding Pool (RNA); the values are in the preview spike (`LAND` in `spikes/fixture-preview/run.js`).
- **Colourless non-artifact cards** (Ugin, Thought-Knot Seer): the colourless frame, a grey-brown border with greyish bars and a pale stone text box (Thought-Knot Seer, OGW).
- **Devoid** (Complete Disregard): as on real devoid cards, the art shows through a translucent border (lightly tinted by the first colour in its mana cost, or gold for three or more) and a translucent text box, with grey bars (Complete Disregard, BFZ).
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

  8.1 **[Open, deferred to D25]** What each marker means and when it applies. Sun/Moon, Spark and Emrakul are transform markers, Day/Night is a mechanic (daybound), and Modal is MDFC.

  8.2 **[Confirmed]** These layouts are out of scope for v1 (D1); their mockups and rules are D25 (Phase 4). Battles and vehicles are rendered as single faces in v1 (5.7.7):

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

  8.3 Double-faced cards produce one image per face (3.5.4, D1, D4) **[Confirmed]**. How the back face is identified in the stat bar is **[Open, deferred to D25]**.

---

## 9. Reference data the renderer needs

The implementation keeps these as configuration tables rather than hard-coding them, so they can be extended. They live in `src/config/` (T-A9), one module per row; labels drawn on cards are there too, so they can be translated later (10.4). The renderer uses a placeholder until each missing icon is made (T-B14):

| Table                                 | Maps        | Status                                               |
| ------------------------------------- | ----------- | ---------------------------------------------------- |
| Card type → icon                      | 5.1         | Defined (D14); all icons made (T-B14)                |
| Supertype → icon + label              | 5.5.1–5.5.4 | Defined (D15); all icons made (T-B14)                |
| Subtype → icon                        | 5.5.7–5.5.9 | Defined (D16); all icons made (T-B14)                |
| Mana symbol → icon, count rule, order | 5.3         | Defined (D11); Y, Z and the extra hybrids composed (T-B14) |
| Mechanic → zone/timing symbol + label | 5.4         | Defined (D12); all icons made (T-B14)                |
| Text symbol → icon                    | 6.4.7       | Defined (D20); all icons made (T-B14)                |
| Colour(s) → frame style               | 6.6         | Defined (D21)                                        |
| Layout → marker / rendering rules     | 8           | Open                                                 |

9.1 **[Confirmed]** Symbol and icon sources:

- **Mana symbols (custom):** Use the generic mana symbol style from `res/symbols/symbols.svg` (includes 0-20, WUBRG, X, hybrids, etc.). Replaces standard rounded mana cost symbols with a stylized design.
- **Set symbols, creature/spell types, zone/timing icons:** Source from Scryfall SVG library (GPL-3.0 compatible) or create custom SVGs.
- **Watermarks (guild symbols, etc.):** Create custom SVGs or source from Scryfall as needed.
- **Mana font icons (T-B14):** power, text symbols, loyalty badges, watermarks and the artist brush come from the [Mana font](https://github.com/andrewgioia/mana) by Andrew Gioia (SIL OFL 1.1). Icons it doesn't have (Battle, Kindred, split second, supertypes, subtypes, defense badge) were drawn for this project, and the missing mana symbols composed from the sheet; see `scripts/build-icons.js`.
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

  10.3 **Accessibility [Confirmed].** No formal accessibility target for v1, for card images or the frontend (D24). The decisions already made stand: mana symbols carry glyphs, zone/timing and supertype icons carry labels (D12, D15), and the colour indicator uses divider lines with no letters (D17, 5.2.5).

  10.4 **Localisation [Confirmed].** English only for v1 (D24): English printings and English labels ("NON-PERMANENT", "LEGENDARY", "FLASH", …). The labels live in the configuration tables (section 9), so translations can be added later without code changes. The footer keeps its language code ("EN").

  10.5 **Performance [Confirmed].** No hard target and no batch-size limit for v1 (D24). Generation time is measured and reported (e.g. for a 100-card Commander deck, with and without cached art), but there is no pass/fail threshold. Art downloads are bounded by the Scryfall rate limit (100ms per request, D10), so about 10 seconds per 100 uncached cards.

---

## 11. Consolidated open questions

The questions raised while writing these requirements, grouped by area. Numbers in brackets refer to the sections above. Every question up to 47 has been answered, except the two special-layout questions deferred to D25 (Phase 4); each one says where its answer is recorded (T-S2 review). Questions 48–52, on hosting, are answered too (D26–D30).

### Product and scope

1. Is a mirrored right-edge bar needed? [1.3] — **Answered:** no, not for v1 (D8).
2. Who owns the layout design, and is permission or attribution needed? [1.4] — **Answered:** Osprey Dawn's mockup is only a reference; no permission or attribution needed (D23).
3. Are the README goals in priority order? What are the acceptance criteria? [2.1, 2.4] — **Answered:** no, `tasks.md` is the plan (T-S2 review); acceptance criteria are set per phase (2.4).
4. Which layouts are in scope for v1? [2.5, 8.2] — **Answered:** all card types as single faces, double-faced cards as two images, special layouts after v1 (D1).

### Architecture, input and output

5. CLI only, or also a server/UI? [3.1.2] — **Answered:** backend API and frontend UI (D9).
6. What is the input format, and how are quantities handled? [3.2.2, 3.2.3] — **Answered:** decklist with quantities, one image per copy (D3).
7. What name-matching rules apply, including DFC names? [3.2.4, 3.2.5] — **Answered:** case-insensitive exact with suggestions (T-S2 review); either face name or the full `//` name (D3).
8. What happens to unmatched names? [3.2.6] — **Answered:** reported, the batch continues (D3).
9. Which JSON source (MTGJSON or Scryfall), and is it bundled or downloaded? [3.3.1, 3.3.2] — **Answered:** Scryfall bulk data, downloaded daily (D2).
10. How is a printing chosen, and what is the default? [3.3.3] — **Answered:** optional `(SET) number` after the name, otherwise the first printing (T-S2 review).
11. Where does art come from? What are the caching, rate-limit and offline rules? [3.4.1] — **Answered:** Scryfall at runtime, cached, 100ms apart, black placeholder (D10). Cropping: cover and centre crop (3.4.2, T-S2 review).
12. What are the image format, dimensions, DPI and bleed? [3.5.1, 3.5.3] — **Answered:** PNG 750×1050 at 300 DPI with a black border, zip or A4 PDF (D4).
13. How are files named inside the zip, and where does output go? [3.5.2, 3.5.6] — **Answered:** `card-name.png` with a counter for duplicates (D4); the zip downloads in the UI or returns from the API, scripts write to `out/` (T-S2 review).
14. Do double-faced cards produce one image or two? [3.5.4] — **Answered:** two (D1, D4).

### Layout

15. What are the exact dimensions and spacing? [4.3] — **Answered:** from the mockups, configurable (D8).
16. What are the overflow and collision rules for the stat bar? [4.4, 5.3.9, 5.6.3] — **Answered:** D19.

### Stat bar

17. Which icons are needed for Battle, Kindred and the other types, and in what order for multi-type cards? [5.1.3, 5.1.4] — **Answered:** D14.
18. What does the colour indicator look like, and does the mana block reflow? [5.2.3, 5.2.4] — **Answered:** D17.
19. How are colourless, XX, hybrid, mono-hybrid, Phyrexian, snow and {0} drawn? [5.3.6, 5.3.8] — **Answered:** D11.
20. What is the full mana symbol order? [5.3.7] — **Answered:** D11.
21. What is the complete mechanic → zone/timing symbol mapping? [5.4.2] — **Answered:** D12.
22. How are mechanics detected (keywords field, text parsing, or mapping table)? [5.4.3] — **Answered:** D12.
23. Do triggered abilities that work from a zone count? [5.4.4] — **Answered:** yes (D12).
24. Should the flash label be "INSTANT" or "FLASH"? Do instants also get the bolt? [5.4.5, 5.4.6] — **Answered:** FLASH, and yes (D12).
25. What is the maximum number and order of zone symbols? [5.4.7] — **Answered:** no maximum, fixed order (D12).
26. What does the "NORMAL" icon mean, and when does it appear? [5.4.8] — **Answered:** it isn't used (D13).
27. Why is there no LEGENDARY icon on Jace? [5.5.3] — **Answered:** an omission; planeswalkers show it (D15).
28. Which icons are needed for the other supertypes? [5.5.4] — **Answered:** Snow and World; Token is out of scope (D15).
29. Is the subtype list exhaustive? Which icon wins when a card has several subtypes? [5.5.8, 5.5.9] — **Answered:** D16.
30. Which icons carry text labels? [5.5.10] — **Answered:** zone/timing and supertype icons; subtype icons don't (D16).
31. Is the permanence label shown only when the bottom is free? Do lands get it? [5.7.3, 5.7.4] — **Answered:** only NON-PERMANENT is shown; lands get none (D18).
32. How are special P/T values, vehicles, battles and spacecraft handled? [5.7.6, 5.7.7] — **Answered:** D18.

### Card box

33. Where do set symbols and watermarks come from? [6.3.3, 6.4.3] — **Answered:** D7, D20.
34. Does the sword/shield notation apply to all P/T text? [6.4.5] — **Answered:** only numeric ±N/±N modifiers (D20).
35. Is the symbol + count pill used for all mana in rules text? [6.4.6] — **Answered:** no, rules text shows symbols as printed (D11).
36. Which additional text symbols are needed? [6.4.7] — **Answered:** all of them (D20).
37. What are the text-fitting rules? [6.4.8] — **Answered:** drop flavour text, then shrink (D20).
38. Is the copyright year per printing or fixed? When does the holo stamp appear? [6.5.2, 6.5.3] — **Answered:** the year the image is generated; no holo stamp (D20).
39. What do the frames for hybrid, coloured artifacts, devoid and other unshown cases look like? [6.6.2] — **Answered:** D21.
40. How are long, many or ±X planeswalker abilities handled? [7.2.6, 7.2.7] — **Answered:** D22.

### Special layouts

41. What do the flip markers mean (including "Ignite")? [8.1] — **Deferred** to D25 (Phase 4).
42. How is the back face identified? [8.3] — **Deferred** to D25 (Phase 4).

### Non-functional

43. Which fonts, and under what licensing? [10.1] — **Answered:** Beleren, free to use (D6).
44. What is the Fan Content Policy position? [10.2] — **Answered:** follow it (D23).
45. What are the accessibility requirements? [10.3] — **Answered:** no formal target (D24).
46. Is localisation in scope? [10.4] — **Answered:** English only for v1 (D24).
47. What are the expected batch sizes and performance targets? [10.5] — **Answered:** no hard target; measured and reported (D24).

### Hosting and deployment

48. Which backend framework, and what does the API look like? [3.6.1] — **Answered:** Fastify, JSON REST with background jobs and polling, configurable limits (D26).
49. Which frontend stack, and are cards rendered in the browser or on the server? [3.6.2] — **Answered:** React with Vite; batches on the server, live single-card previews in the browser (D27).
50. Where is the public instance hosted, and who pays? [3.6.3] — **Answered:** a DigitalOcean VPS in Sydney (2 GB, ~US$12/month, owner pays) at `fannable.verbatiam.dev` (D28).
51. How do people self-host it? [3.6.4] — **Answered:** Docker image and Compose file (optional Caddy for HTTPS), environment-variable settings, capped art cache, CLI in the same image (D29).
52. How is it deployed, refreshed, monitored and protected from abuse? [3.6.5] — **Answered:** deploy on every push to `main`, built-in daily refresh, logs and an uptime check, per-IP rate limits (D30).

---

## 12. Corrections to the source documents

The Components doc is not in this repository, so its corrections are recorded here for whoever maintains it.

- **README goals 8, 11, 12, 13** (flash symbol, keyword symbols, active in grave) should be replaced by "Zone and timing symbols" (2.2). **Applied** to the README; the colour indicator in goal 10 is merged with goal 7 (2.3).
- **Components doc, Special → "Instant"** should read "Flash" (it is the timing symbol, not the card type).
- **Components doc, Special → "Keywords"** should be replaced by "Zone and timing symbols".
- **Components doc, Special → "Active in grave"** is covered by the graveyard zone symbol.
- **Components doc, Other → "Non-permeant"** is a typo for "Non-permanent". It is the vertical permanence label (5.7.2). Only NON-PERMANENT is used; there is no PERMANENT label (D18).
- **Components doc, Stats → "Creature only"** conflicts with Vehicles, which have P/T without being creatures. Vehicles and spacecraft show hollow stats (D18, 5.7.7).
- **Components doc, Card box → Text box → Symbols** lists "Energy" twice.
- **Components doc, Card types** is missing Battle and Kindred, and a Supertypes section (Legendary, Basic, Snow, World).
- **Components doc, Card box** is missing the set symbol, flavour text, watermark and the footer fields.
- **Anatomy mockup** labels the whole mana block "Generic Mana"; it should read "Mana Cost".
