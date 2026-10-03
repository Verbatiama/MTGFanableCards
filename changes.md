# Mockup comparison: differences (T-S4)

Every difference between the ten reference mockups (`Examples/jauIjDF.jpeg`) and the real renderer's output for the same fixtures. To see them side by side (mockup left, render right), run `npm run mockups:compare` and open `out/mockups/<card>.png`.

Each change is marked:

- **New**: no requirement or decision covers it yet; it needs a decision.
- **Decided**: an earlier decision already explains it; listed so it can be confirmed or reopened.

The owner answered every change on 2026-10-03; each **Decision** line records the answer. Changes C1–C6, C9, C13, C15, C17, C18 and C21–C23 need work; the rest stay as they are.

## Stat bar

### C1. Power/toughness size (New)

- **Cards:** Fiendslayer Paladin, Niv-Mizzet, Wurmcoil Engine
- **Mockup:** large numbers (about 60 px) with a large sword under the power and a large shield under the toughness, filling the bottom of the bar.
- **Render:** numbers are 36 px with a 20 px sword and shield (`BAR_BOTTOM.stats` in `src/config/layout.js`), about half the mockup's size. The mockup's are much easier to read in a fanned hand.
- **Decision:** Match the mockup: numbers about 60 px, sword and shield about 50 px (long values still shrink to fit).

### C2. Equipment icon design (New)

- **Cards:** Sword of Fire and Ice
- **Mockup:** a sword crossing a shield.
- **Render:** a thin upright sword drawn in T-B14. It's narrow and hard to read at bar size.
- **Decision:** Redraw like the mockup: a sword crossing a shield, bold enough to read at bar size.

### C3. Aura icon design (New)

- **Cards:** Feral Invocation
- **Mockup:** a ring crowned with flame-like prongs.
- **Render:** a sun with rays (T-B14).
- **Decision:** Redraw in the mockup's design (chosen from a side-by-side comparison).

### C4. Basic supertype icon design (New)

- **Cards:** Forest
- **Mockup:** a white pentagon (Requirements 5.5.2 cites the composite for this icon).
- **Render:** a stack of bricks (T-B14).
- **Decision:** Use the pentagon, as 5.5.2 references.

### C5. Legendary crown design (New)

- **Cards:** Niv-Mizzet, Jace
- **Mockup:** a five-pointed spiky crown with a chevron cut into it, above a band.
- **Render:** a plain crown.
- **Decision:** Replace the crown with a tracing of `Examples/Commander-2014.png` (the Commander 2014 shield).

### C6. Planeswalker type icon (New)

- **Cards:** Jace
- **Mockup:** the planeswalker "spark" (the three-pronged symbol from card backs).
- **Render:** a round swirl from the Mana font.
- **Decision:** Use the planeswalker spark.

### C7. Several card types: split icon vs a row (Decided: D14)

- **Cards:** Wurmcoil Engine
- **Mockup:** artifact and creature icons overlap, divided by a diagonal line.
- **Render:** the two icons side by side in one row, shrunk to fit (D14).
- **Decision:** Keep D14's single row.

### C8. Zone/timing and label changes (Decided: D12, D13, D18, D19, 5.5.1, D16)

- **Cards:** Damnation, Feral Invocation, Fiendslayer Paladin, Jace, Lightning Strike, Niv-Mizzet, Sword of Fire and Ice, Forest, Wasteland, Wurmcoil Engine
- **Mockup:** NORMAL icon; INSTANT label; PERMANENT label; FLASH above AURA; LEGENDARY, BASIC, AURA and EQUIPMENT labels.
- **Render:** no NORMAL icon (D13); FLASH instead of INSTANT, and Feral Invocation gets FLASH from its keyword (D12); no PERMANENT label (D18); AURA above FLASH (D19); no labels on supertype and subtype icons (5.5.1, D16).
- **Decision:** Keep all (D12, D13, D18, D19, 5.5.1, D16 stand).

### C9. Non-basic icon (Decided: D15)

- **Cards:** Wasteland
- **Mockup:** a NON-BASIC icon.
- **Render:** none. D15 gives icons only to Basic, Snow, World and Legendary; non-basic isn't a supertype.
- **Decision:** Add a non-basic icon to every land that isn't basic.

### C10. Basic land mana symbol in the bar (Decided: D16)

- **Cards:** Forest
- **Mockup:** nothing beside the text box.
- **Render:** the Forest's green mana symbol beside the text box (D16, 5.5.8).
- **Decision:** Keep it (D16 stands).

### C11. Loyalty costs as badges (Decided: D22)

- **Cards:** Jace
- **Mockup:** plain numbers (+2, 0, −1, −12).
- **Render:** printed-card cost badges (D22).
- **Decision:** Keep the badges (D22 stands).

### C12. Mana rows position and spacing (Decided: recent layout commits)

- **Cards:** all
- **Mockup:** mana rows start right under the type icon, rows touching, symbol and count a little larger.
- **Render:** rows start lower and are spread out ("Mana rows over the art: lower start, spread out", commit bb25ec6).
- **Decision:** Keep ours (the recent layout change stands).

## Card box

### C13. Rules text font (New)

- **Cards:** all
- **Mockup:** rules and flavour text in a regular-weight book serif (like the MPlantin of real cards); only the name and type line are Beleren.
- **Render:** everything in Beleren Bold (D6 names Beleren but doesn't say it's for rules text). Bold Beleren is heavier and fits fewer words per line.
- **Decision:** Keep Beleren 2016 for all text. The classic Beleren file the owner added (`res/fonts/beleren.ttf`) was tested on Sword of Fire and Ice and Damnation and looked the same (same swash F, I and J), so it is removed.

### C14. Card name font style (New)

- **Cards:** Fiendslayer Paladin, Forest, Feral Invocation, Jace, Sword of Fire and Ice
- **Mockup:** classic Beleren Bold: plain capital F, J and lower-case f.
- **Render:** Beleren 2016 Bold, whose F, J and f have calligraphic swashes ("Fiendslayer", "Forest", "Jace").
- **Decision:** Keep Beleren 2016 (see C13).

### C15. Short rules text vertical position (New)

- **Cards:** Damnation
- **Mockup:** short text centred vertically in the text box, as real cards do.
- **Render:** text always starts at the top of the text box.
- **Decision:** Centre short rules text vertically in the text box.

### C16. Space between abilities (New)

- **Cards:** Niv-Mizzet, Fiendslayer Paladin, Sword of Fire and Ice, Wasteland, Wurmcoil Engine
- **Mockup:** a full blank line between paragraphs.
- **Render:** a small gap (about a third of a line).
- **Decision:** Keep as is.

### C17. Inline sword/shield and symbol size and contrast (New)

- **Cards:** Feral Invocation, Sword of Fire and Ice, Wasteland
- **Mockup:** "+2 ⚔ +2 🛡" icons are as tall as the text and solid black; mana symbols in text are large.
- **Render:** the sword and shield are small, mid-grey icons; inline mana symbols (the {2} in "Equip {2}", {T}, {C}) are small and the generic number circle is pale grey, so it nearly disappears.
- **Decision:** Replace the sword and shield in rules text with standard formatting: "+3/+1", "-1/+2" as plain text (reverses that part of D20). Inline mana symbols: fix only the contrast of the generic number circle (sizes unchanged).

### C18. Frame colours and style (Decided: D21)

- **Cards:** all
- **Mockup:** saturated name and type bars in the card colour (bright yellow for Niv-Mizzet, orange for red, blue for Jace), rounded capsule bars with a dark outline, a dark grey text box for black (Damnation), and a pink land colour for Forest and Wasteland.
- **Render:** colours sampled from real cards (D21, revised): paler bars, textured coloured border, a pale text box (Damnation's is near-white), green Forest and grey Wasteland from the land palette.
- **Decision:** Match the mockup: re-sample the frame from the mockup (saturated name and type bars, capsule bars with a dark outline, grey text box on black cards, pink-tan land bars). D21's rules for which palette a card gets still apply.

### C19. Rounded card corners (New)

- **Cards:** all
- **Mockup:** the black card has rounded corners, like a real card.
- **Render:** square corners. D4 only says "black border".
- **Decision:** Keep square corners.

### C20. Holo stamp (Decided: D20)

- **Cards:** all
- **Mockup:** a silver oval at the bottom centre.
- **Render:** none (D20).
- **Decision:** Keep it dropped (D20 stands).

### C21. Full-art basic land (New)

- **Cards:** Forest
- **Mockup:** a full-art Forest: the art fills the card box, with no text box or type line bar; the mana symbol and "Basic Land - Forest" sit on the art.
- **Render:** the normal frame, with the large mana symbol in the text box (6.4.4). The mockup's look matches the full-art ZEN printing; the fixture uses M19.
- **Decision:** Full art for every basic land, like the mockup: name bar, art down to the footer, large mana symbol and type line over the art.

### C22. Watermark when the mockup has none (Decided: D20)

- **Cards:** Wurmcoil Engine
- **Mockup:** no watermark.
- **Render:** the Phyrexian watermark from the Scryfall data (D20). Niv-Mizzet's Izzet watermark matches.
- **Decision:** No watermarks (reverses that part of D20).

## Footer

### C23. Collector number without the set size (New: differs from 6.5)

- **Cards:** all
- **Mockup:** "123/165 R" (Requirements 6.5 gives "85/165 R" as the format).
- **Render:** "123 R". The card data has no set size; Scryfall's set list has it (`printed_size`, or `card_count`), and the set symbol fetcher already downloads that list.
- **Decision:** Don't render the collector number or rarity.

### C24. Copyright year (Decided: D20)

- **Cards:** all
- **Mockup:** "© 2014".
- **Render:** the generation year (D20).
- **Decision:** Keep the generation year (D20 stands).

## Card data

### C25. Printing used by the fixtures (New)

- **Cards:** Feral Invocation (mockup THS, fixture JMP), Lightning Strike (THS vs M19), Sword of Fire and Ice (MMA vs DST), Forest (ZEN vs M19), Wasteland (art from a later printing vs TMP), Niv-Mizzet (the mockup has Svetlin Velinov's art from a later printing labelled GPT vs Todd Lockwood's GPT art)
- **Mockup:** those printings' art, set symbols, collector numbers and flavour text.
- **Render:** the fixtures' printings, so art, set symbol and flavour differ (Lightning Strike's flavour, Niv-Mizzet's and Wasteland's added flavour).
- **Decision:** Keep the fixtures' printings.

### C26. Oracle text and real type lines (Decided: 3.3.4, 3.3.5)

- **Cards:** all
- **Mockup:** printed or invented text: "Sorcery - Wrath", "Artifact - Sword", "Enchantment - Beast", "Planeswalker - Jace Beleren", "Sorcery - Lightning", "creature or player", "it's owner's", "hhis", "Add {1} to your mana pool", "3/3" tokens with sword and shield; hyphen instead of em dash.
- **Render:** current Oracle text and real type lines, with an em dash; Lightning Strike is an instant; sword and shield only for ±N/±N modifiers (D20).
- **Decision:** Keep Oracle text and real type lines (3.3.4, 3.3.5 stand).
