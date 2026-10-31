/* ───────────────────────── Terrain: elevation, territory, drainage, biomes ───────────────────────── */
const GW = 240, GH = 160, GN = GW * GH;
const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BIOME = { SEA: 0, PLAINS: 1, FOREST: 2, HILLS: 3, MOUNTAIN: 4, PEAK: 5, DESERT: 6, MARSH: 7, TUNDRA: 8, LAKE: 9 };

/* label connected components of cells where mask[i] is truthy. Returns { lab, sizes } (lab -1 = not in mask). */
function components(mask, nb = NB4) {
  const lab = new Int32Array(GN).fill(-1), sizes = [], stack = [];
  for (let i = 0; i < GN; i++) {
    if (!mask[i] || lab[i] >= 0) continue;
    const id = sizes.length; let n = 0; stack.push(i); lab[i] = id;
    while (stack.length) {
      const c = stack.pop(); n++;
      const cx = c % GW, cy = (c / GW) | 0;
      for (const [dx, dy] of nb) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= GW || y >= GH) continue; const j = y * GW + x; if (mask[j] && lab[j] < 0) { lab[j] = id; stack.push(j); } }
    }
    sizes.push(n);
  }
  return { lab, sizes };
}

function buildElevation(rng, type) {
  const nz1 = makeNoise(rng.seed32()), nz2 = makeNoise(rng.seed32()), nz3 = makeNoise(rng.seed32());
  const e = new Float32Array(GN);
  const R = GH * 0.5, cx = GW * rng.range(0.44, 0.56), cy = GH * rng.range(0.46, 0.54);
  let sx = rng.range(-1, 1), sy = rng.range(-1, 1); const sl = Math.sqrt(sx * sx + sy * sy) || 1; sx /= sl; sy /= sl;
  const ridges = [];
  for (let i = 0, n = rng.int(1, 2); i < n; i++) {
    const ax = cx + rng.range(-0.5, 0.5) * R, ay = cy + rng.range(-0.4, 0.4) * R;
    let dx = rng.range(-1, 1), dy = rng.range(-1, 1); const l = Math.sqrt(dx * dx + dy * dy) || 1; dx /= l; dy /= l;
    const len = rng.range(0.5, 1.0) * R;
    ridges.push({ ax: ax - dx * len * 0.5, ay: ay - dy * len * 0.5, bx: ax + dx * len * 0.5, by: ay + dy * len * 0.5 });
  }
  const segDist = (x, y, r) => {
    const vx = r.bx - r.ax, vy = r.by - r.ay, t = clamp(((x - r.ax) * vx + (y - r.ay) * vy) / (vx * vx + vy * vy), 0, 1);
    const px = r.ax + vx * t, py = r.ay + vy * t; return Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
  };
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const u = x / GH, v = y / GH;
    const f = nz1.fbm(u * 3.0 + 3.1, v * 3.0 + 1.7, 5), g = nz2.fbm(u * 1.4 + 9.2, v * 1.4 + 4.4, 3);
    const dx = (x - cx) / R, dy = (y - cy) / R, d = Math.sqrt(dx * dx + dy * dy), proj = dx * sx + dy * sy, perp = dx * -sy + dy * sx;
    let m, rough = 0.9;
    if (type === 'island') { m = (0.8 + 0.45 * (g - 0.5) - d) * 1.6; }
    else if (type === 'archipelago') { m = (1.0 + 0.5 * (g - 0.5) - d) * 0.9; rough = 1.5; }
    else if (type === 'continental') { m = 0.6 - 1.8 * smooth(clamp((proj - 0.15 + 0.75 * (g - 0.5)) / 0.6, 0, 1)); }
    else { const t = -proj, neck = 0.38 + 0.5 * clamp((t + 0.2) / 1.0, 0, 1); m = Math.min((neck - Math.abs(perp) + 0.25 * (g - 0.5)) * 1.8, (t + 0.65 + 0.2 * (g - 0.5)) * 2); }
    let bump = 0;
    if (m > -0.3) for (const r of ridges) { const sd = segDist(x, y, r) / (0.2 * R); bump += nz3.ridged(u * 2.5, v * 2.5, 4) / (1 + sd * sd) * 1.0; }
    const mm = m > 0.25 ? 0.25 + (m - 0.25) * 0.1 : m;           // coast falls off, interior stays flat
    e[y * GW + x] = mm + (f - 0.5) * rough * (m > 0.25 ? 0.75 : 1) + bump;
  }
  return { e, cx, cy, R, sx, sy, nz2 };
}

function distanceFields(isSea) {
  /* distance (4-neighbour steps) from every cell to the nearest cell of the opposite kind */
  const toSea = new Float32Array(GN).fill(1e9), toLand = new Float32Array(GN).fill(1e9);
  const qS = [], qL = [];
  for (let i = 0; i < GN; i++) {
    const x = i % GW, y = (i / GW) | 0; let edgeSea = false, edgeLand = false;
    for (const [dx, dy] of NB4) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= GW || b >= GH) continue; const j = b * GW + a; if (isSea[j] !== isSea[i]) { if (isSea[i]) edgeLand = true; else edgeSea = true; } }
    if (!isSea[i] && edgeSea) { toSea[i] = 0; qS.push(i); }
    if (isSea[i] && edgeLand) { toLand[i] = 0; qL.push(i); }
  }
  const bfs = (q, dist, pass) => {
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % GW, y = (c / GW) | 0;
      for (const [dx, dy] of NB4) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= GW || b >= GH) continue; const j = b * GW + a; if (pass(j) && dist[j] > dist[c] + 1) { dist[j] = dist[c] + 1; q.push(j); } }
    }
  };
  bfs(qS, toSea, (j) => !isSea[j]); bfs(qL, toLand, (j) => isSea[j]);
  return { toSea, toLand };
}

function buildTerrain(rng, type) {
  const base = buildElevation(rng, type), e = base.e;
  const landFrac = { island: 0.34, archipelago: 0.3, continental: 0.62, peninsula: 0.5 }[type] + rng.range(-0.03, 0.03);
  const sorted = Float32Array.from(e).sort();
  const sea = sorted[Math.floor((1 - landFrac) * (GN - 1))];
  const minE = sorted[0], maxE = sorted[GN - 1];
  const en = new Float32Array(GN); for (let i = 0; i < GN; i++) en[i] = (e[i] - minE) / (maxE - minE);
  const seaLevel = (sea - minE) / (maxE - minE);
  const isSea = new Uint8Array(GN); for (let i = 0; i < GN; i++) isSea[i] = en[i] < seaLevel ? 1 : 0;
  return Object.assign(base, { e: en, seaLevel, isSea, type });
}

/* Territory: our country grows outward from a centre; steep ground is costly, so borders hug ridges and
   coasts. Remaining land becomes neighbouring lands. */
function claimTerritory(rng, T) {
  const { e, isSea, cx, cy, R, sx, sy, nz2, type } = T;
  const owner = new Uint8Array(GN); // 0 none/sea, 1 = our country, 2.. = neighbours
  const island = type === 'island' || type === 'archipelago';
  const shift = island ? 0 : 0.3;
  const tcx = cx + sx * R * shift, tcy = cy + sy * R * shift;
  let start = -1, bd = 1e12;
  for (let i = 0; i < GN; i++) { if (isSea[i]) continue; const dx = i % GW - tcx, dy = ((i / GW) | 0) - tcy, d = dx * dx + dy * dy; if (d < bd) { bd = d; start = i; } }
  if (start < 0) return null;
  let count = 0;
  if (island) {
    const tr = type === 'island' ? R * 1.1 : R * 1.0, inT = new Uint8Array(GN);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x; if (isSea[i]) continue;
      const dx = x - tcx, dy = y - tcy, rad = tr * (0.8 + 0.4 * nz2.fbm(x / GH * 2 + 50, y / GH * 2 + 20, 3));
      if (dx * dx + dy * dy < rad * rad) inT[i] = 1;
    }
    const { lab, sizes } = components(inT);
    if (!sizes.length) return null;
    let main = 0; for (let k = 1; k < sizes.length; k++) if (sizes[k] > sizes[main]) main = k;
    for (let i = 0; i < GN; i++) if (lab[i] >= 0 && (lab[i] === main || sizes[lab[i]] >= 18)) { owner[i] = 1; count++; }
  } else {
    const target = rng.int(3000, 6200), heap = new Heap(), seen = new Uint8Array(GN);
    heap.push(0, start); seen[start] = 1;
    while (heap.size && count < target) {
      const c = heap.pop(), cost = heap.lastKey; owner[c] = 1; count++;
      const x = c % GW, y = (c / GW) | 0;
      for (const [dx, dy] of NB8) {
        const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= GW || b >= GH) continue;
        const j = b * GW + a; if (seen[j] || isSea[j]) continue;
        seen[j] = 1; heap.push(cost + (dx && dy ? 1.4142 : 1) * (1 + 40 * Math.abs(e[j] - e[c]) + 1.6 * hash2(a, b, 5) + 9 * nz2.fbm(a / GH * 3.2 + 7, b / GH * 3.2 + 3, 3)), j);
      }
    }
  }
  const rest = new Uint8Array(GN); for (let i = 0; i < GN; i++) rest[i] = !isSea[i] && !owner[i] ? 1 : 0;
  const comp = components(rest);
  const neighbours = [];
  const cells = []; for (let i = 0; i < GN; i++) if (rest[i] && comp.sizes[comp.lab[i]] >= 30) cells.push(i);
  if (cells.length) {
    const want = Math.min(3, 1 + Math.floor(cells.length / 1800) + (cells.length > 700 ? 1 : 0));
    const seeds = [];
    let first = cells[0], fd = -1;
    for (const c of cells) { const d = (c % GW - tcx) * (c % GW - tcx) + (((c / GW) | 0) - tcy) * (((c / GW) | 0) - tcy); if (d > fd) { fd = d; first = c; } }
    seeds.push(first);
    while (seeds.length < want) {
      let best = -1, bestD = -1;
      for (const c of cells) { let md = 1e12; for (const s of seeds) { const d = (c % GW - s % GW) ** 2 + (((c / GW) | 0) - ((s / GW) | 0)) ** 2; if (d < md) md = d; } if (md > bestD) { bestD = md; best = c; } }
      seeds.push(best);
    }
    const heap = new Heap(), got = new Int16Array(GN).fill(-1);
    seeds.forEach((s, k) => { got[s] = k; heap.push(0, s); });
    while (heap.size) {
      const c = heap.pop(), k = got[c], cost = heap.lastKey, x = c % GW, y = (c / GW) | 0;
      for (const [dx, dy] of NB8) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= GW || b >= GH) continue; const j = b * GW + a; if (rest[j] && got[j] < 0 && comp.sizes[comp.lab[j]] >= 30) { got[j] = k; heap.push(cost + (dx && dy ? 1.4142 : 1) * (1 + 30 * Math.abs(e[j] - e[c]) + hash2(a, b, 9)), j); } }
    }
    for (let i = 0; i < GN; i++) if (got[i] >= 0) owner[i] = 2 + got[i];
    for (let k = 0; k < seeds.length; k++) neighbours.push({ id: 2 + k, cells: 0 });
    for (let i = 0; i < GN; i++) if (owner[i] >= 2) neighbours[owner[i] - 2].cells++;
  }
  return { owner, count, neighbours, tcx, tcy };
}

/* Drainage by priority-flood: every land cell gets a downhill path to the sea; flow accumulation gives rivers. */
function drainage(rng, T, dist) {
  const { e, isSea } = T;
  { const nzR = makeNoise(rng.seed32()); for (let i = 0; i < GN; i++) if (!isSea[i]) e[i] += (nzR.fbm((i % GW) / 5, ((i / GW) | 0) / 5, 3) - 0.5) * 0.014; }   // small bumps so rivers meander
  const filled = new Float32Array(GN), flowTo = new Int32Array(GN).fill(-1), done = new Uint8Array(GN), heap = new Heap(), popped = [];
  for (let i = 0; i < GN; i++) if (isSea[i]) { done[i] = 1; filled[i] = e[i]; heap.push(e[i], i); }
  while (heap.size) {
    const c = heap.pop(), x = c % GW, y = (c / GW) | 0; popped.push(c);
    for (const [dx, dy] of NB8) {
      const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= GW || b >= GH) continue;
      const j = b * GW + a; if (done[j]) continue;
      done[j] = 1; filled[j] = Math.max(e[j], filled[c] + 0.000001 * (dx && dy ? 1.4 : 1)); flowTo[j] = c; heap.push(filled[j] + 0.0009 * hash2(a, b, 3), j);
    }
  }
  // moisture: wetter near the sea and where noise says so
  const nzM = makeNoise(rng.seed32()), moist = new Float32Array(GN);
  for (let i = 0; i < GN; i++) { const x = i % GW, y = (i / GW) | 0; moist[i] = clamp(0.55 * nzM.fbm(x / GH * 2.2, y / GH * 2.2, 4) + 0.55 / (1 + dist.toSea[i] / 14), 0, 1); }
  const acc = new Float32Array(GN);
  const order = []; for (let i = 0; i < GN; i++) if (!isSea[i]) { order.push(i); acc[i] = 0.5 + 1.0 * moist[i]; }
  { const pos = new Int32Array(GN); popped.forEach((c, k) => { pos[c] = k; }); order.sort((p, q) => pos[q] - pos[p]); }   // children before parents
  for (const c of order) { const t = flowTo[c]; if (t >= 0 && !isSea[t]) acc[t] += acc[c]; else if (t >= 0) acc[t] += acc[c] * 0; }
  const lake = new Uint8Array(GN);
  for (const c of order) if (filled[c] - e[c] > 0.004) lake[c] = 1;
  { // very large basins become plains (their floor rises to the spill level); tiny pits are dropped
    const lc = components(lake, NB4), nzF = makeNoise(rng.seed32());
    for (let i = 0; i < GN; i++) if (lake[i]) { const sz = lc.sizes[lc.lab[i]]; if (sz > 110 || sz < 4) { lake[i] = 0; e[i] = filled[i] + 0.004 * nzF.fbm((i % GW) / 6, ((i / GW) | 0) / 6, 2); } }
  }
  return { filled, flowTo, acc, moist, lake, order };
}

function classifyBiomes(rng, T, D, dist) {
  const { e, seaLevel, isSea } = T, biome = new Uint8Array(GN), le = new Float32Array(GN);
  const latBase = rng.range(0.3, 0.8), nzT = makeNoise(rng.seed32()), flip = rng.chance(0.5) ? 1 : -1;
  const temp = new Float32Array(GN);
  const lv = []; for (let i = 0; i < GN; i++) if (!isSea[i]) lv.push(e[i]);
  lv.sort((a, b) => a - b);
  const q = (p) => lv[Math.min(lv.length - 1, Math.floor(p * lv.length))];
  const qHills = q(0.62), qMount = q(0.9), qPeak = q(0.985);
  for (let i = 0; i < GN; i++) {
    if (isSea[i]) continue;
    le[i] = (e[i] - seaLevel) / (1 - seaLevel);
    const x = i % GW, y = (i / GW) | 0;
    temp[i] = latBase + flip * (y / GH - 0.5) * 0.35 + 0.08 * (nzT.fbm(x / GH * 2, y / GH * 2, 3) - 0.5) - le[i] * 0.5;
    const m = D.moist[i], t = temp[i];
    let b = BIOME.PLAINS;
    if (e[i] > qPeak) b = BIOME.PEAK; else if (e[i] > qMount) b = BIOME.MOUNTAIN; else if (e[i] > qHills) b = BIOME.HILLS;
    else if (t < 0.05) b = BIOME.TUNDRA; else if (m < 0.36 && t > 0.42) b = BIOME.DESERT;
    else if (m > 0.58) b = BIOME.FOREST; else if (m > 0.44 && le[i] < 0.1 && D.acc[i] > 3) b = BIOME.MARSH;
    if (D.lake[i]) b = BIOME.LAKE;
    biome[i] = b;
  }
  return { biome, le, temp, latBase };
}
