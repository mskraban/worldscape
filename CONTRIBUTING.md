# Contributing to Worldscape

Thanks for helping! Worldscape is small on purpose: one dependency-free engine (`public/engine.js`) shared by the browser and the server, built from the files in `src/`.

## Setup

```bash
git clone https://github.com/mskraban/worldscape.git
cd worldscape
npm install
npm test        # should be all green
npm run dev     # http://localhost:3000
```

Node 20 or newer.

## Where things live

| Folder | What |
|--------|------|
| `src/00-core.js` … `src/90-poster.js` | The engine, concatenated in numeric order into `public/engine.js` (`npm run build`). Same scope, no imports. |
| `src/10-tongue.js` | Languages: phonologies, vocabulary, place-name grammar |
| `src/20-terrain.js`, `30-places.js` | Terrain, rivers, biomes, borders, cities, roads, provinces |
| `src/40-heraldry.js`, `80-heraldry-draw.js` | Flag and arms data, and their drawing |
| `src/45-state.js`, `50-history.js`, `60-anthem.js` | Government and facts, chronicle, music |
| `src/85-map.js`, `88-sheet.js`, `90-poster.js` | Map, sheet music and poster renderers |
| `lib/`, `api/` | The server: fonts, limits, handlers |

## The golden rule: seeds must not change

A seed is a promise: it must give the same country forever. `test/fixtures/signatures.json` freezes the output for eight seeds, and the test fails if anything generated changes.

- Use only `rng` (from `sub(seed, 'tag')`) for randomness, never `Math.random()` while generating. Each feature has its own stream, so adding a feature never disturbs another.
- Generation code uses only integer maths and `+ − × ÷ √` (no `sin`, `cos`, `pow` on floats that shape the data), so every JavaScript engine agrees to the last bit. Trigonometry is fine in drawing code.
- If you really must change what seeds produce, bump `VERSION` in `src/00-core.js`, run `npm run freeze`, and say so in the pull request.
- Always run `npm run build` after editing `src/`. A test fails if `public/engine.js` is stale.

## Good first contributions

- A new **tongue** (a phonology in `TONGUES`; see the existing ten).
- A new **charge** for flags and arms (`CHG` in `80-heraldry-draw.js`, plus the `CHARGES` table).
- A new **history event** template in `50-history.js`.
- A new **map style** palette in `MAP_STYLES` (`85-map.js`).
- Translations of the site.

New content that appends to a list changes what some seeds produce, so it needs a `VERSION` bump. Say so in the PR.

## Pull requests

- Keep them focused and include a screenshot of what changed (a poster or map is perfect).
- `npm test` must pass; CI runs it.
- New user-facing text: plain and friendly, no jargon.

## Reporting bugs

Open an issue with the seed and the URL. The seed alone reproduces everything.

## Code of conduct

Be kind and assume good intent. Harassment and personal attacks are not tolerated.
