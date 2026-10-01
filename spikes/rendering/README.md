# T-B1 rendering spike

Draws the same test scene with two Canvas 2D backends and exports a PNG from each. The scene has a black stat bar with mana symbols, a Beleren card name, rules text with inline symbols, a rotated permanence label, and one symbol drawn at 4× size. It also writes a contact sheet of every symbol in `res/symbols/symbols.svg`.

```
npm run spike:render        # both backends
npm run spike:render -- napi-rs-canvas
```

Output goes to `out/spike/` (not committed):

| File                         | What it shows                    |
| ---------------------------- | -------------------------------- |
| `<backend>.png`              | 750×1050 test card               |
| `<backend>-symbols.png`      | all 54 symbols with their codes  |

Files:

- `scene.js` holds the drawing code. It uses only the standard `CanvasRenderingContext2D` API, so the same code runs in the browser.
- `symbols.js` cuts one symbol out of the sheet as a standalone SVG string.
- `run.js` is the harness: font registration, image loading, PNG encoding and timing for each backend.

## Candidates

|                              | `canvas` (node-canvas) 3.2.3            | `@napi-rs/canvas` 1.0.9            |
| ---------------------------- | --------------------------------------- | ---------------------------------- |
| Engine                       | Cairo + Pango, SVG via librsvg          | Skia, SVG via Skia's SVG module    |
| Install on Windows           | Prebuilt binary, no build step, ~36 MB  | Prebuilt binary, no build step, ~37 MB |
| Native system libraries      | Bundled in prebuilt binaries; build tools plus Cairo/Pango where no prebuilt binary exists | None                     |
| Draw + PNG encode, per card (Windows) | ~63 ms                         | ~35 ms                             |
| Draw + PNG encode, per card (Linux)   | ~44 ms                         | ~32 ms                             |
| Load 5 symbols + fonts (Windows) | ~90 ms                              | ~125 ms                            |
| Beleren fonts on Windows     | **Fails** (see below)                   | Works                              |
| Beleren fonts on Linux       | Works                                   | Works                              |
| Symbol sheet SVG             | Works once the sheet is preprocessed (see below) | Works once the sheet is preprocessed (see below) |
| Inline symbols in text       | Works                                   | Works                              |
| Rotated text                 | Works                                   | Works                              |
| Vector symbol scaled to 200px | Sharp                                  | Sharp                              |

Timings are the mean of 20 renders. Windows means the dev machine on Node 24; Linux means WSL 2 Ubuntu 26.04 on the same machine, Node 22.22, with the project copied into the Linux filesystem and `npm ci` run there. PNG size is about 50 KB for both. Once fonts are set aside, the two backends produce visually identical output, and the contact sheets match.

One small difference: with `textBaseline = 'middle'`, node-canvas places the text about 3px higher than `@napi-rs/canvas`, because Pango and Skia measure the font differently. Layout code that needs pixel-exact output on both should position text from the alphabetic baseline.

## Findings

### 1. node-canvas cannot use Beleren on Windows (Linux is fine)

`registerFont` in node-canvas 3.2.3 on Windows fails for any font that is not installed system-wide. Pango logs `couldn't load font "Beleren2016 Bold …", falling back to "Sans Bold …"` and draws in a default sans font.

I checked that this is the library and not our files:

- Windows itself loads the file. `AddFontResourceEx` succeeds, and GDI+ reports a `Beleren2016` family with Regular and Bold styles.
- A system font copied and renamed to an uninstalled family name fails the same way.
- Registering an already-installed font only appears to work, because Pango finds it among the system fonts.
- Changing the weight passed to `registerFont`, the CSS weight, the family alias, the file path (OneDrive or temp folder) or the font's OS/2 weight makes no difference.

**On Linux it works.** In WSL 2 (Ubuntu 26.04, Node 22.22), the prebuilt node-canvas binary bundles its own Cairo, Pango and librsvg, so no system packages were needed. `registerFont` loaded both Beleren files from `res/fonts/` with no fallback warning, even though Beleren is not installed system-wide (`fc-list` does not list it). The card name, rules text and small-caps label all render in Beleren, all 54 symbols render, and the test suite passes.

So node-canvas is usable if rendering always happens on Linux: on a Linux server, in CI (GitHub Actions uses Ubuntu), and in WSL for development on Windows. Native Windows development would still need a workaround, such as installing the fonts for the Windows user (not tested).

`@napi-rs/canvas` loads the fonts with `GlobalFonts.registerFromPath` on Windows with no workaround.

### 2. The Beleren TTFs are bold-only and their metadata contradicts itself

The name table says "Regular", while OS/2 says weight 700 and the Bold flag is not set. Request them as `bold <size> "Beleren"`, and in node-canvas register them with `weight: 'bold'`. A plain `<size> "Beleren"` request is not guaranteed to match.

### 3. The symbol sheet needs preprocessing for Skia

`symbols.svg` styles its shapes with CSS classes in a `<style>` block. librsvg and browsers apply them, but Skia ignores `<style>`, so every symbol came out solid black in `@napi-rs/canvas`. `inlineClassStyles()` rewrites the classes as presentation attributes. It skips any property the element already sets, because one `<clipPath>` sets both `class="st12"` and a `clip-path` attribute, and the resulting duplicate attribute made librsvg reject the whole file.

The preprocessed SVG renders the same in both backends. Doing this once at build time (T-B3) would be cheaper than doing it on every load.

### 4. Symbol sheet layout and codes

- **Layout:** the sheet is a grid of 100×100 cells at a 105px pitch. Each symbol is a group labelled with its code (`inkscape:label="wu"`).
- **Extraction:** `symbolCell()` finds a symbol's cell from the first shape inside its group: a circle for plain symbols, or the first path for hybrids, which are drawn as two half-circles. All 54 labels map to distinct cells.
- **Energy:** `e` has no background circle. It is a bare black glyph, so it needs a light background (or a circle drawn behind it) on the black stat bar.
- **Codes:** these are not Scryfall's. The asset loader (T-B3) needs a mapping table:

| Scryfall       | Sheet           |
| -------------- | --------------- |
| `{W/U}`        | `wu`            |
| `{2/W}`        | `2w`            |
| `{W/P}`        | `pw` (order reversed) |
| `{T}` / `{Q}`  | `t` / `q`       |
| `{E}`          | `e`             |
| `{S}`          | `snow`          |
| `{C}`          | `c`             |
| `{X}`          | `x`             |
| `{∞}` / `{½}`  | `infin` / `half`|

- **Missing from the sheet:** `{Y}`, `{Z}`, generic costs above 20 (`{100}`, `{1000000}`), hybrid Phyrexian such as `{G/U/P}`, and colourless hybrid such as `{C/W}`. This feeds into D11.

### 5. Inline symbols in text

Sizing an icon at 1.25× the font's cap height (from `measureText('M').actualBoundingBoxAscent`) and centring it on the cap height lines it up with the text in both backends. Each run's width comes from `measureText`, so the same approach will drive line wrapping in T-B5.

## Outcome

**D5 stays with node-canvas, and the project moves to WSL.** Development, CI and the server all run on Linux, where node-canvas loads the Beleren fonts correctly (finding 1). This keeps the original decision. The trade-offs accepted with it:

- Windows developers run the project inside WSL, with the repository in the Linux filesystem (for example `~/MTGFanableCards`), not under `/mnt/c` or `/mnt/d`. `node_modules` must be installed from Linux, because the native binaries differ per platform.
- node-canvas is about 1.4× slower than `@napi-rs/canvas` on Linux (about 44 ms against 32 ms per card). That is about 4.4 s of drawing for a 100-card deck, small next to art downloads at the 100 ms rate limit (10.5).

Follow-ups for T-B2:

- Add a font check that fails loudly when Beleren falls back to a system font, so an accidental native Windows run can't produce cards in the wrong font.
- Register the fonts with `weight: 'bold'` and request them as `bold <size> "Beleren"` (finding 2).
- Move `canvas` from devDependencies to dependencies and remove `@napi-rs/canvas`. Remove the `napi-rs-canvas` backend from `run.js` at the same time.
- Keep the backend-specific code (canvas creation, font registration, image loading, PNG encoding) behind a thin adapter, so the backend can still be swapped if needed. `scene.js` already uses only the standard API.
- Preprocess the symbol sheet once in T-B3 (finding 3). node-canvas does not need the CSS inlining, but it is harmless and keeps the browser and any future Skia backend working.

Not covered by this spike: the browser side. Browsers load fonts with `FontFace` and render SVG with full CSS support, so neither problem above applies there, but it has not been run.
