# MTGFannableCards

Scripts to generate MTG cards in a fannable style

Goals

1. Generate a normal card with a black bar on the left
2. Mana symbols on the left
3. Card types top left
4. Power toughness
5. Symbols in text
6. Loyalty abilities
7. Colour Indicator
8. Flash symbol
9. Subtype symbols (Not including creatures or tokens)
10. Special symbols (Colour indicator, Flip)
11. Keyword symbols (ones that exist in arena)
12. Active in grave
13. Keyword symbols (other)

## Development

Requires Node.js 22 or later (see `.nvmrc`).

```
npm install
npm run check    # lint + format check + tests (what CI runs)
npm test         # tests only (node:test)
npm start        # backend API on http://localhost:3000
```

### Folder structure

```
src/
  data/     Dev A: Scryfall bulk data loader, decklist parser, printing selection
  parse/    Dev A: mana cost parser, oracle text tokenizer, zone/timing detection
  model/    Card-model mapper (Scryfall JSON -> card model, S1)
  config/   Configuration tables: type, subtype, mechanic, symbol, frame colour
  art/      Art fetcher with cache and rate limiting
  output/   PNG writer, file naming, zip and PDF bundling
  render/   Dev B: Canvas 2D drawing code, shared by node-canvas and the browser
  server/   Backend API
public/     Frontend UI for decklist input
test/       Tests (*.test.js), with card-model fixtures in test/fixtures/cards/
res/        Bundled assets: fonts/ (Beleren, D6) and symbols/ (mana symbols, D7)
cache/      Downloaded Scryfall data and art (not committed)
out/        Generated cards (not committed)
```

Code in `src/render/`, `src/model/` and `public/` must not use Node-only APIs, because it also runs in the browser.
