# MTGFannableCards

Scripts to generate MTG cards in a fannable style

## Goals

A feature list, not a priority order; the plan is in `tasks.md` and the full requirements in `Requirements.md`.

- Generate a normal card with a black bar on the left
- Mana symbols on the left
- Card types top left
- Power and toughness
- Symbols in text
- Loyalty abilities
- Colour indicator
- Zone and timing symbols: flash, split second, castable from hand, top of library or graveyard (replaces the earlier flash symbol, keyword symbols and "active in grave" goals)
- Subtype symbols (not including creatures or tokens)
- Special symbols (flip markers)

## Development

Requires Linux and Node.js 22 or later (see `.nvmrc`). On Windows, use WSL and clone the repository into the Linux filesystem (e.g. `~/MTGFanableCards`), not under `/mnt/c` or `/mnt/d`: node-canvas cannot load the Beleren fonts on native Windows, and `node_modules` must be installed from Linux.

```
npm install
npm run check         # lint + format check + tests (what CI runs)
npm test              # tests only (node:test)
npm start             # backend API on http://localhost:3000
npm run spike:preview # Generate preview images from development spikes
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
web/        Frontend UI (React + Vite, D27): decklist input and live card previews
test/       Tests (*.test.js), with card-model fixtures in test/fixtures/cards/
spikes/     Throwaway experiments and their write-ups (e.g. spikes/rendering/, T-B1)
res/        Bundled assets: fonts/ (Beleren, D6) and symbols/ (mana symbols, D7)
cache/      Downloaded Scryfall data and art (not committed)
out/        Generated cards (not committed)
```

Code in `src/render/`, `src/model/` and `web/` must not use Node-only APIs, because it also runs in the browser.

## Legal

MTGFannableCards is unofficial Fan Content permitted under the [Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy). Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

The project is free and non-commercial. Generated cards are for personal use and playtesting; don't sell them. The code is licensed under GPL-3.0 (see `LICENSE`).
