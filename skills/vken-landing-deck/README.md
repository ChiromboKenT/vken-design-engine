# vken-landing-deck

Sister skill to [`vken-landing`](../vken-landing/).
Produces a single-file slide deck in the **Atelier Zero** design
language — warm-paper background, italic-serif emphasis, coral
terminating dots, surreal collage plates — paginated as a horizontal
magazine swipe deck (←/→ · wheel · touch · ESC overview), the same
nav model as [`guizang-ppt`](../guizang-ppt/).

> **Read first** — agent contract, schema, and self-check live in
> [`SKILL.md`](./SKILL.md). This README is the human quick-start.

## 30-second tour

```bash
# 1. Compose the worked example.
npx tsx scripts/compose.ts inputs.example.json example.html

# 2. Open it.
open example.html
```

The deck assumes 16 collage assets at `../vken-landing/assets/`
(the sister skill ships them). Use ←/→ · Space · PageUp/PageDown ·
Home/End to navigate, ESC for the overview grid.

## What you get

- N viewport-sized slides (the worked example has 11) laid out
  horizontally on a `transform: translateX(...)` flex track.
- Per-slide chrome strip (top + bottom): brand mark · deck title ·
  location · live `NN / TT` counter.
- Coral progress bar at the bottom that fills as you advance.
- Dot indicator near the bottom (click to jump).
- ESC overview grid with scaled thumbnails.
- 7 slide kinds: `cover`, `section`, `content`, `stats`, `quote`,
  `cta`, `end`. Mix freely.
- Same 16-slot image library as the landing-page sister skill —
  no extra prompting or rendering.

## Files

```text
skills/vken-landing-deck/
├── SKILL.md                 # ← agent contract (read this first)
├── README.md                # ← you are here
├── schema.ts                # typed slide variants + brand block (re-exports from sister)
├── inputs.example.json      # VKEN Design Engine 11-slide pitch deck
├── example.html             # canonical rendering
└── scripts/
    └── compose.ts           # inputs.json + sister styles.css → index.html
```

## Authoring a deck

1. Copy `inputs.example.json` to your project as `inputs.json`.
2. Edit `brand` (or copy from a sister-skill `inputs.json` you already have).
3. Set `deck_title` (the kicker shown in the chrome strip).
4. Build the `slides` array. Each entry is one of seven kinds — see
   [`schema.ts`](./schema.ts) for the full type. A typical pitch:

   ```text
   1.  cover     — title plate
   2.  section   — chapter divider
   3-5. content  — manifesto, capabilities, method
   6.  stats     — the numbers
   7.  section   — chapter divider
   8.  content   — selected work
   9.  quote     — customer testimonial
   10. cta       — primary action
   11. end       — kicker word
   ```

5. Run the composer:

   ```bash
   npx tsx scripts/compose.ts inputs.json out/index.html
   ```

## Image strategy

The deck inherits the sister skill's 16-slot image library. Set
`inputs.imagery.assets_path` to wherever those PNGs live; the example
uses `'../vken-landing/assets/'`.

To regenerate or stub:

```bash
# Generate via gpt-image-2 (fal.ai)
FAL_KEY=fal-... npx tsx ../vken-landing/scripts/imagegen.ts \
  ../vken-landing/inputs.example.json \
  --out=../vken-landing/assets/

# Or paper-textured SVG placeholders
npx tsx ../vken-landing/scripts/placeholder.ts ../vken-landing/assets/
```

## Migrating from `editorial-collage-deck`

This skill replaces the older `editorial-collage-deck` skill. The renames
are mechanical:

| Old | New |
| --- | --- |
| skill folder `editorial-collage-deck/` | `vken-landing-deck/` |
| shared assets `../editorial-collage/assets/` | `../vken-landing/assets/` |
| TS type `EditorialCollageDeckInputs` | `VkenLandingDeckInputs` |

The `EditorialCollageDeckInputs` alias re-exported from
[`schema.ts`](./schema.ts) is a temporary bridge: it is kept for the
**v0.3.x** line and removed in the next minor release (**v0.4.0**).
Update imports before then.

## See also

- [`vken-landing`](../vken-landing/) — landing page sister skill.
- [`guizang-ppt`](../guizang-ppt/) — the magazine-deck navigation pattern this skill borrows.
- [`design-systems/atelier-zero/DESIGN.md`](../../design-systems/atelier-zero/DESIGN.md) — design tokens.
