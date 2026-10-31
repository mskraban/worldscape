/* ───────────────────────── Places: cities, roads, provinces, features, neighbours ─────────────────────────
   Everything here is integer/√ arithmetic on the terrain grid, so a seed gives the same country everywhere. */

const COUNTRY_TYPES = [['continental', 2], ['peninsula', 3], ['island', 3], ['archipelago', 2]];
const SITE_BIOME = [0, 1.0, 0.7, 0.55, 0.05, 0, 0.35, 0.1, 0.1, 0];
const ROAD_BIOME = [99, 1, 1.25, 2.6, 7, 16, 0.9, 4.5, 1.6, 99];
const REGION_HEADS = { coast: ['harbor', 'cape', 'bridge'], mountain: ['mountain', 'tower', 'fort'], forest: ['forest', 'spring', 'oak'], plains: ['field', 'valley', 'hill'], general: ['valley', 'hill', 'stone'] };

function cellXY(i) { return [i % GW, (i / GW) | 0]; }
function cdist(a, b) { const dx = a % GW - b % GW, dy = ((a / GW) | 0) - ((b / GW) | 0); return Math.sqrt(dx * dx + dy * dy); }

/* Dijkstra between two cells; `pass(j)` says if a cell may be entered, `cost(a,b)` is the step cost. */
function pathBetween(a, b, pass, cost) {
  const dist = new Float64Array(GN).fill(1e9), prev = new Int32Array(GN).fill(-1), heap = new Heap();
  dist[a] = 0; heap.push(0, a);
  while (heap.size) {
    const c = heap.pop(), d = heap.lastKey;
    if (d > dist[c]) continue;
    if (c === b) break;
    const x = c % GW, y = (c / GW) | 0;
    for (const [dx, dy] of NB8) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const j = ny * GW + nx; if (!pass(j)) continue;
      const nd = d + cost(c, j) * (dx && dy ? 1.4142 : 1);
      if (nd < dist[j]) { dist[j] = nd; prev[j] = c; heap.push(nd, j); }
    }
  }
  if (dist[b] >= 1e9) return null;
  const path = []; for (let c = b; c >= 0; c = prev[c]) path.push(c);
  return path.reverse();
}

/* principal axis of a cell set without trig: eigenvector of the 2×2 covariance matrix */
function principalAxis(cells) {
  let mx = 0, my = 0; for (const c of cells) { mx += c % GW; my += (c / GW) | 0; } mx /= cells.length; my /= cells.length;
  let a = 0, b = 0, d = 0; for (const c of cells) { const x = c % GW - mx, y = ((c / GW) | 0) - my; a += x * x; b += x * y; d += y * y; }
  a /= cells.length; b /= cells.length; d /= cells.length;
  const lam = (a + d) / 2 + Math.sqrt(((a - d) / 2) * ((a - d) / 2) + b * b);
  let vx = b, vy = lam - a; if (Math.abs(vx) + Math.abs(vy) < 1e-9) { vx = 1; vy = 0; }
  const n = Math.sqrt(vx * vx + vy * vy); vx /= n; vy /= n; if (vx < 0) { vx = -vx; vy = -vy; }
  return { cx: mx, cy: my, vx, vy, elong: Math.sqrt(lam / Math.max(1e-6, a + d - lam)) };
}

function countryNameFor(lang) {
  const r = lang.rng, T = lang.T;
  for (let k = 0; k < 30; k++) {
    let s = lang.syl(); if (r.chance(0.55)) s += lang.syl();
    const n = lang.fmt(lang.join(s, r.pick(T.countryEnds)));
    if (n.length >= 5 && n.length <= 10 && !/[aeiouy]{3,}/i.test(n)) return n;
  }
  return lang.fmt(lang.join(lang.syl(), lang.rng.pick(T.countryEnds)));
}
function demonymOf(name) {
  const l = name.toLowerCase(), last = l[l.length - 1];
  if (last === 'a') return name + 'n';
  if ('eiouy'.indexOf(last) >= 0) return name + 'an';
  return name + 'ish';
}

function generateGeography(seed) {
  seed = String(seed);
  let type, T, C, attempt = 0;
  const tongueIdx = sub(seed, 'tongue').int(0, TONGUES.length - 1);
  const tongueId = TONGUES[tongueIdx].id;
  const lang = makeLanguage(sub(seed, 'lang'), tongueId);
  const rng = sub(seed, 'places');
  for (; attempt < 12; attempt++) {
    const g = sub(seed, 'geo' + attempt);
    type = attempt < 8 ? g.weighted(COUNTRY_TYPES) : 'peninsula';
    T = buildTerrain(g, type); C = claimTerritory(g, T);
    if (C && C.count >= 2200) break;
  }
  const grng = sub(seed, 'geo' + attempt);
  const dist = distanceFields(T.isSea);
  const D = drainage(grng, T, dist);
  const B = classifyBiomes(grng, T, D, dist);
  const own = C.owner, isOwn = (i) => own[i] === 1;
  const biome = B.biome;
  const kmPerCell = rng.pick([2, 3, 4, 5]);
  const maxAlt = rng.int(24, 52) * 100;
  const alt = (i) => Math.round(B.le[i] * maxAlt / 10) * 10;

  /* river mask: the top slice of flow accumulation */
  const accs = []; for (let i = 0; i < GN; i++) if (!T.isSea[i]) accs.push(D.acc[i]);
  accs.sort((a, b) => a - b);
  const riverThr = Math.max(28, accs[Math.floor(accs.length * 0.968)] || 28);
  const riverMask = new Uint8Array(GN);
  for (let i = 0; i < GN; i++) if (!T.isSea[i] && biome[i] !== BIOME.LAKE && D.acc[i] >= riverThr) riverMask[i] = 1;
  const nearRiver = (i) => { const x = i % GW, y = (i / GW) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < GW && b < GH && riverMask[b * GW + a]) return true; } return false; };
  const nearBiome = (i, code, r) => { const x = i % GW, y = (i / GW) | 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < GW && b < GH && biome[b * GW + a] === code) return true; } return false; };

  /* territory stats */
  const ownCells = []; let sx = 0, sy = 0, minx = GW, maxx = 0, miny = GH, maxy = 0;
  for (let i = 0; i < GN; i++) if (isOwn(i)) { ownCells.push(i); const [x, y] = cellXY(i); sx += x; sy += y; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  const centroid = [sx / ownCells.length, sy / ownCells.length];

  /* ── cities ── */
  const score = new Float32Array(GN).fill(-1);
  for (const i of ownCells) {
    if (biome[i] === BIOME.LAKE) continue;
    let s = SITE_BIOME[biome[i]];
    if (s <= 0) continue;
    const ts = dist.toSea[i];
    if (ts >= 0 && ts <= 2) s += 0.9;
    if (nearRiver(i)) s += 0.8;
    if (nearBiome(i, BIOME.LAKE, 2)) s += 0.35;
    s += hash2(i % GW, (i / GW) | 0, 77) * 0.5;
    score[i] = s;
  }
  const cand = ownCells.filter((i) => score[i] > 0).sort((a, b) => score[b] - score[a] || a - b);
  const nCities = rng.int(8, 12);
  const spacing = Math.max(8, Math.sqrt(ownCells.length / nCities) * 0.85);
  const rad = Math.sqrt(ownCells.length / 3.14);
  const centreCell = (() => { let b = -1, bd = 1e9; for (const i of ownCells) { const d = (i % GW - centroid[0]) ** 2 + (((i / GW) | 0) - centroid[1]) ** 2; if (d < bd) { bd = d; b = i; } } return b; })();
  let capCell = cand.find((i) => cdist(i, centreCell) < rad * 0.55) ?? cand[0];
  const picked = [capCell];
  for (const c of cand) { if (picked.length >= nCities) break; if (picked.every((p) => cdist(p, c) >= spacing)) picked.push(c); }
  const popBase = rng.int(60, 420) * 1000;
  const cities = picked.map((cell, k) => {
    const ts = dist.toSea[cell];
    const site = ts >= 0 && ts <= 1 ? 'coast' : nearRiver(cell) ? 'river' : nearBiome(cell, BIOME.MOUNTAIN, 3) ? 'mountain' : biome[cell] === BIOME.FOREST ? 'forest' : biome[cell] === BIOME.PLAINS ? 'plains' : 'general';
    const heads = SITE_HEADS[site].filter((h) => lang.lex[h]);
    const name = k === 0 ? lang.place(['tower', 'crown', 'fort', 'stone', 'king'].filter((h) => lang.lex[h]), undefined, 0.35) : lang.place(heads, undefined, 0.3);
    const pop = Math.round(popBase / Math.pow(k + 1, 0.9) * (0.82 + 0.36 * rng.next()) / 100) * 100;
    return { id: k, cell, x: cell % GW, y: (cell / GW) | 0, name: name.text, en: name.en, site, port: site === 'coast', pop, rank: k === 0 ? 4 : k < 3 ? 3 : k < 6 ? 2 : 1, capital: k === 0, alt: alt(cell) };
  });

  /* ── roads: minimum spanning tree plus a few extra links, cheaper where roads already exist ── */
  const lakeOrSea = (j) => T.isSea[j] || biome[j] === BIOME.LAKE;
  const roadMask = new Uint8Array(GN);
  const links = [], inTree = new Set([0]);
  while (inTree.size < cities.length) {
    let best = null;
    for (const a of inTree) for (let b = 0; b < cities.length; b++) if (!inTree.has(b)) { const d = cdist(cities[a].cell, cities[b].cell); if (!best || d < best.d) best = { a, b, d }; }
    links.push([best.a, best.b, 'main']); inTree.add(best.b);
  }
  const extra = rng.int(2, 4); let tries = 0;
  while (links.length < cities.length - 1 + extra && tries++ < 60) {
    const a = rng.int(0, cities.length - 1), b = rng.int(0, cities.length - 1);
    if (a === b || cdist(cities[a].cell, cities[b].cell) > rad * 1.1) continue;
    if (links.some((l) => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a))) continue;
    links.push([a, b, 'minor']);
  }
  const roads = [];
  for (const [a, b, kind] of links) {
    const path = pathBetween(cities[a].cell, cities[b].cell, (j) => isOwn(j) && !lakeOrSea(j), (p, j) => (ROAD_BIOME[biome[j]] + 24 * Math.abs(T.e[j] - T.e[p]) + (riverMask[j] ? 4 : 0)) * (roadMask[j] ? 0.3 : 1));
    if (!path) continue;
    for (const c of path) roadMask[c] = 1;
    roads.push({ a, b, kind, cells: path });
  }

  /* ── provinces: terrain-aware Voronoi grown from the biggest, well-spread cities ── */
  const nReg = Math.max(3, Math.min(7, Math.round(cities.length / 1.6)));
  const seeds = [0];
  while (seeds.length < nReg) {
    let best = -1, bd = -1;
    for (let k = 1; k < cities.length; k++) { if (seeds.includes(k)) continue; let md = 1e9; for (const s of seeds) md = Math.min(md, cdist(cities[k].cell, cities[s].cell)); md += cities[k].pop / 1e6; if (md > bd) { bd = md; best = k; } }
    if (best < 0) break; seeds.push(best);
  }
  const grow = (seedCells, tw) => {
    const out = new Uint8Array(GN).fill(255), rd = new Float64Array(GN).fill(1e9), heap = new Heap();
    seedCells.forEach((c, k) => { rd[c] = 0; heap.push(0, c); out[c] = k; });
    while (heap.size) {
      const c = heap.pop(), d = heap.lastKey; if (d > rd[c]) continue;
      const x = c % GW, y = (c / GW) | 0;
      for (const [dx, dy] of NB8) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= GW || b >= GH) continue; const j = b * GW + a; if (!isOwn(j)) continue;
        const nd = d + (dx && dy ? 1.4142 : 1) * (1 + tw * (Math.abs(T.e[j] - T.e[c]) * 10 + (biome[j] === BIOME.MOUNTAIN ? 0.4 : 0) + (riverMask[j] ? 0.1 : 0)) + hash2(a, b, 31) * 0.3);
        if (nd < rd[j]) { rd[j] = nd; out[j] = out[c]; heap.push(nd, j); } }
    }
    return out;
  };
  let seedCells = seeds.map((k) => cities[k].cell), regionOf = grow(seedCells, 0);
  for (let pass = 0; pass < 4; pass++) {           // Lloyd relaxation: move each seed to its province's middle
    const sum = seedCells.map(() => [0, 0, 0]);
    for (const i of ownCells) { const r = regionOf[i]; if (r === 255) continue; sum[r][0] += i % GW; sum[r][1] += (i / GW) | 0; sum[r][2]++; }
    seedCells = seedCells.map((c, k) => { if (!sum[k][2]) return c; const mx = sum[k][0] / sum[k][2], my = sum[k][1] / sum[k][2]; let b = c, bd = 1e9; for (const i of ownCells) if (regionOf[i] === k) { const d = (i % GW - mx) ** 2 + (((i / GW) | 0) - my) ** 2; if (d < bd) { bd = d; b = i; } } return b; });
    regionOf = grow(seedCells, pass < 3 ? 0.4 : 1);
  }
  for (const i of ownCells) if (regionOf[i] === 255) { let b = 0, bd = 1e9; seedCells.forEach((sc, k) => { const d = cdist(i, sc); if (d < bd) { bd = d; b = k; } }); regionOf[i] = b; }   // stray fragments join the nearest province
  const regions = seedCells.map((s, k) => ({ id: k, seedCell: s, cells: 0, coast: 0, mount: 0, forest: 0, plains: 0, sx: 0, sy: 0, cities: [] }));
  for (const i of ownCells) { const r = regions[regionOf[i]]; if (!r) continue; r.cells++; r.sx += i % GW; r.sy += (i / GW) | 0; const b = biome[i]; if (dist.toSea[i] >= 0 && dist.toSea[i] <= 2) r.coast++; if (b === BIOME.MOUNTAIN || b === BIOME.PEAK || b === BIOME.HILLS) r.mount++; if (b === BIOME.FOREST) r.forest++; if (b === BIOME.PLAINS) r.plains++; }
  cities.forEach((c) => { const r = regions[regionOf[c.cell]]; c.region = r ? r.id : 0; if (r) r.cities.push(c.id); });
  const seedCellsOf = (r) => r.seedCell;
  for (const r of regions) {
    r.cx = r.sx / Math.max(1, r.cells); r.cy = r.sy / Math.max(1, r.cells); delete r.sx; delete r.sy;
    const f = [['coast', r.coast * 1.3], ['mountain', r.mount * 1.5], ['forest', r.forest], ['plains', r.plains]].sort((a, b) => b[1] - a[1])[0];
    r.dominant = r.cells && f[1] / r.cells > 0.28 ? f[0] : 'general';
    const heads = REGION_HEADS[r.dominant].filter((h) => lang.lex[h]);
    const n = lang.place(heads, undefined, 0.2); r.name = n.text; r.en = n.en;
    r.capital = r.cities.length ? r.cities.slice().sort((a, b) => cities[b].pop - cities[a].pop)[0] : cities.reduce((bst, c) => (cdist(c.cell, seedCellsOf(r)) < cdist(cities[bst].cell, seedCellsOf(r)) ? c.id : bst), 0);
    r.pop = r.cities.reduce((s, id) => s + cities[id].pop, 0);
  }

  /* ── features: ranges, peaks, lakes, rivers, seas, islands ── */
  const mmask = new Uint8Array(GN); for (let i = 0; i < GN; i++) if (biome[i] === BIOME.MOUNTAIN || biome[i] === BIOME.PEAK) mmask[i] = 1;
  const mc = components(mmask, NB8), ranges = [];
  mc.sizes.forEach((sz, k) => {
    if (sz < 36) return; const cells = []; for (let i = 0; i < GN; i++) if (mc.lab[i] === k) cells.push(i);
    const ax = principalAxis(cells); let top = cells[0]; for (const c of cells) if (T.e[c] > T.e[top]) top = c;
    const ownShare = cells.filter(isOwn).length / cells.length;
    ranges.push({ cells: sz, ...ax, top, ownShare });
  });
  ranges.sort((a, b) => b.cells - a.cells);
  const mountHeads = ['mountain'].filter((h) => lang.lex[h]);
  ranges.splice(5);
  ranges.forEach((r) => { const n = lang.place(mountHeads.length ? mountHeads : ['stone'], undefined, 0); r.name = n.text; r.en = n.en; });
  let peaks = ranges.filter((r) => r.ownShare > 0.4).map((r) => { const n = lang.place(['peak', 'tower', 'fort'].filter((h) => lang.lex[h]), undefined, 0.2); return { name: n.text, en: n.en, cell: r.top, x: r.top % GW, y: (r.top / GW) | 0, alt: alt(r.top) }; }).sort((a, b) => b.alt - a.alt);
  if (!peaks.length) { let t = ownCells[0]; for (const c of ownCells) if (T.e[c] > T.e[t]) t = c; const n = lang.place(['peak', 'tower'].filter((h) => lang.lex[h]), undefined, 0.2); peaks = [{ name: n.text, en: n.en, cell: t, x: t % GW, y: (t / GW) | 0, alt: alt(t) }]; }

  const lmask = new Uint8Array(GN); for (let i = 0; i < GN; i++) if (biome[i] === BIOME.LAKE) lmask[i] = 1;
  const lc = components(lmask, NB4), lakes = [];
  lc.sizes.forEach((sz, k) => { if (sz < 7) return; const cells = []; for (let i = 0; i < GN; i++) if (lc.lab[i] === k) cells.push(i); const ax = principalAxis(cells); lakes.push({ cells: sz, cx: ax.cx, cy: ax.cy, vx: ax.vx, vy: ax.vy, own: cells.some(isOwn) }); });
  lakes.sort((a, b) => b.cells - a.cells); lakes.splice(4);
  lakes.forEach((l) => { const n = lang.place(['lake'].filter((h) => lang.lex[h]).concat(['spring'].filter((h) => lang.lex[h])).slice(0, 1) || ['stone'], undefined, 0); l.name = n.text; l.en = n.en; });

  const rivers = [];
  { const mouths = []; for (let i = 0; i < GN; i++) if (riverMask[i] && isOwn(i)) { const f = D.flowTo[i]; if (f < 0 || T.isSea[f] || biome[f] === BIOME.LAKE) mouths.push(i); }
    mouths.sort((a, b) => D.acc[b] - D.acc[a] || a - b);
    for (const m of mouths) {
      if (rivers.length >= 4) break;
      const path = [m]; let cur = m;
      for (;;) { let best = -1; const x = cur % GW, y = (cur / GW) | 0; for (const [dx, dy] of NB8) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= GW || b >= GH) continue; const j = b * GW + a; if (riverMask[j] && D.flowTo[j] === cur && (best < 0 || D.acc[j] > D.acc[best])) best = j; } if (best < 0) break; path.push(best); cur = best; }
      if (path.length < 16) continue;
      path.reverse();
      const n = lang.place(['river'].filter((h) => lang.lex[h]), undefined, 0);
      rivers.push({ name: n.text, en: n.en, cells: path, mouth: m, length: path.length * kmPerCell, source: path[0] });
    } }

  const seas = [];
  { const sc = (i) => Math.min(dist.toLand[i], 14) * 2 - cdist(i, centreCell) / 6; let b1 = -1, s1 = -1e9;
    for (let i = 0; i < GN; i++) if (T.isSea[i] && dist.toLand[i] >= 3) { const s = sc(i); if (s > s1) { s1 = s; b1 = i; } }
    if (b1 >= 0) { const n = lang.place(['sea'].filter((h) => lang.lex[h]), undefined, 0); seas.push({ name: n.text, en: n.en, x: b1 % GW, y: (b1 / GW) | 0, cell: b1 }); }
    let b2 = -1, s2 = -1e9; for (let i = 0; i < GN; i++) if (T.isSea[i] && dist.toLand[i] >= 5 && b1 >= 0 && cdist(i, b1) > 55) { const s = sc(i); if (s > s2) { s2 = s; b2 = i; } }
    if (b2 >= 0) { const n = lang.place(['sea'].filter((h) => lang.lex[h]), undefined, 0); seas.push({ name: n.text, en: n.en, x: b2 % GW, y: (b2 / GW) | 0, cell: b2 }); } }

  const islands = [];
  if (type === 'archipelago' || type === 'island') {
    const om = new Uint8Array(GN); for (const i of ownCells) om[i] = 1;
    const oc = components(om, NB8);
    oc.sizes.forEach((sz, k) => { if (sz < 24) return; const cells = []; for (let i = 0; i < GN; i++) if (oc.lab[i] === k) cells.push(i); const ax = principalAxis(cells); islands.push({ cells: sz, cx: ax.cx, cy: ax.cy }); });
    islands.sort((a, b) => b.cells - a.cells); islands.splice(6);
    islands.forEach((l) => { const n = lang.place(['island'].filter((h) => lang.lex[h]), undefined, 0.1); l.name = n.text; l.en = n.en; });
  }

  /* ── the country itself and its neighbours ── */
  const name = countryNameFor(lang);
  const nbTongues = TONGUES.filter((t) => t.id !== tongueId);
  const neighbours = C.neighbours.map((nb, k) => {
    const nl = makeLanguage(sub(seed, 'nb' + k), nbTongues[sub(seed, 'nbt' + k).int(0, nbTongues.length - 1)].id);
    const cells = []; for (let i = 0; i < GN; i++) if (own[i] === nb.id) cells.push(i);
    const ax = principalAxis(cells.length ? cells : [centreCell]);
    return { id: nb.id, name: countryNameFor(nl), tongue: nl.id, cells: cells.length, cx: ax.cx, cy: ax.cy };
  });
  const names = new Set([name]); neighbours.forEach((n) => { while (names.has(n.name)) n.name += 'a'; names.add(n.name); });

  const area = ownCells.length * kmPerCell * kmPerCell;
  const pop = cities.reduce((s, c) => s + c.pop, 0);
  const totalPop = Math.round(pop * (1.9 + rng.next() * 0.9) / 1000) * 1000;
  const bcount = {}; for (const i of ownCells) bcount[biome[i]] = (bcount[biome[i]] || 0) + 1;
  const coastCells = ownCells.filter((i) => dist.toSea[i] === 0).length;

  return { seed, type, tongue: tongueId, lang, name, demonym: demonymOf(name), kmPerCell, maxAlt, alt, T, C, D, B, dist, own, riverMask, roadMask, regionOf, cities, roads, regions, ranges, peaks, lakes, rivers, seas, islands, neighbours,
    bbox: [minx, miny, maxx, maxy], centroid, area, population: totalPop, coastKm: coastCells * kmPerCell, biomeCount: bcount, ownCount: ownCells.length };
}
