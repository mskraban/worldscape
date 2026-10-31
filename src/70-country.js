/* ───────────────────────── The whole country: one seed in, everything out ───────────────────────── */

function generateCountry(seed) {
  seed = String(seed).trim() || 'seed';
  const geo = generateGeography(seed);
  const heraldry = makeHeraldry(sub(seed, 'heraldry'), geo);
  const state = makeState(sub(seed, 'state'), geo, heraldry);
  const history = makeHistory(sub(seed, 'history'), geo, state, heraldry);
  const anthem = makeAnthem(sub(seed, 'anthem'), geo, state);
  return { seed, version: VERSION, geo, heraldry, state, history, anthem };
}

/* a compact, JSON-safe summary (no grids) for the API and for tests */
function countrySummary(c) {
  const g = c.geo, st = c.state;
  const pt = (x, y) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  return {
    seed: c.seed, version: c.version,
    country: { name: g.name, demonym: g.demonym, tongue: g.tongue, feel: g.lang.feel, type: g.type, government: st.government, ruler: st.rulerFull, motto: st.motto, capital: g.cities[0].name },
    facts: Object.fromEntries(st.facts),
    cities: g.cities.map((x) => ({ name: x.name, meaning: x.en, x: x.x, y: x.y, population: x.pop, capital: x.capital, port: x.port, region: g.regions[x.region].name })),
    regions: g.regions.map((r) => ({ name: r.name, meaning: r.en, title: st.regionTitle, capital: g.cities[r.capital].name, cells: r.cells, centre: pt(r.cx, r.cy) })),
    geography: {
      areaKm2: g.area, population: g.population, coastKm: g.coastKm, kmPerCell: g.kmPerCell,
      peaks: g.peaks.map((p) => ({ name: p.name, meaning: p.en, altitude: p.alt })), ranges: g.ranges.map((r) => ({ name: r.name, meaning: r.en })),
      rivers: g.rivers.map((r) => ({ name: r.name, meaning: r.en, lengthKm: r.length })), lakes: g.lakes.map((l) => ({ name: l.name, meaning: l.en })), seas: g.seas.map((s) => ({ name: s.name, meaning: s.en })),
      neighbours: g.neighbours.map((n) => ({ name: n.name, tongue: n.tongue })),
    },
    flag: c.heraldry.flag, arms: c.heraldry.arms, symbolism: c.heraldry.meaning,
    history: { eraName: c.history.eraName, now: c.history.now, events: c.history.events.map((e) => ({ year: e.year, title: e.title, text: e.text })), houses: c.history.houses },
    anthem: { title: c.anthem.title, key: `${c.anthem.tonic} ${c.anthem.mode}`, meter: `${c.anthem.meter}/4`, tempo: c.anthem.tempo, composer: c.anthem.composer, lyrics: c.anthem.lines.map((l) => ({ text: l.text, en: l.en })), verse2: c.anthem.verse2 },
  };
}

/* friendly random seeds for the “surprise me” button and the random endpoints (the only non-deterministic function) */
const SEED_A = ['amber', 'ashen', 'bright', 'cinder', 'crimson', 'dawn', 'ember', 'fallow', 'gilded', 'hollow', 'iron', 'jade', 'kind', 'lunar', 'misty', 'north', 'old', 'pale', 'quiet', 'rowan', 'silver', 'storm', 'tidal', 'umber', 'velvet', 'wild', 'winter', 'yellow', 'zephyr', 'golden'];
const SEED_B = ['fox', 'heron', 'harbor', 'marsh', 'crown', 'lantern', 'meadow', 'oak', 'otter', 'peak', 'quill', 'raven', 'reef', 'saddle', 'sparrow', 'spire', 'stag', 'thistle', 'vale', 'willow', 'wolf', 'bridge', 'comet', 'drum', 'ferry', 'glade', 'hearth', 'island', 'kestrel', 'mill'];
function randomSeed() { const r = Math.random; return `${SEED_A[Math.floor(r() * SEED_A.length)]}-${SEED_B[Math.floor(r() * SEED_B.length)]}-${Math.floor(r() * 900 + 100)}`; }
