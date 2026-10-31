/*!
 * Worldscape engine: deterministic imaginary countries. One file, browser and Node (with @napi-rs/canvas).
 * Same seed => same country. MIT License. Generated from src/*.js by scripts/build-engine.js. Do not edit by hand.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Worldscape = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
/* ═══ 00-core.js ═══ */
/* ───────────────────────── Core: seeded randomness, noise, helpers ─────────────────────────
   Everything that decides *what a country is* uses only integer maths and + − × ÷ √, so the
   same seed gives the same country in every browser and in Node. Trigonometry is used only
   for drawing. */
const VERSION = 1;

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function makeRng(str) {
  const next = mulberry32(xmur3(str)());
  const r = {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted: (items) => { let t = 0; for (const it of items) t += it[1]; let x = next() * t; for (const it of items) { x -= it[1]; if (x <= 0) return it[0]; } return items[items.length - 1][0]; },
    shuffle: (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
    sample: (arr, n) => r.shuffle(arr).slice(0, n),
    seed32: () => Math.floor(next() * 2147483647),
  };
  return r;
}
/* Independent streams per feature: changing the history never changes the flag, and so on. */
const sub = (seed, tag) => makeRng(`${seed}|${tag}|v${VERSION}`);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/* integer-hash value noise (no trig) */
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function makeNoise(seedInt) {
  const base = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = smooth(xf), v = smooth(yf);
    const a = hash2(xi, yi, seedInt), b = hash2(xi + 1, yi, seedInt), c = hash2(xi, yi + 1, seedInt), d = hash2(xi + 1, yi + 1, seedInt);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, oct = 4) => { let s = 0, amp = 1, tot = 0, f = 1; for (let o = 0; o < oct; o++) { s += base(x * f + o * 31.7, y * f + o * 17.3) * amp; tot += amp; amp *= 0.5; f *= 2; } return s / tot; };
  const ridged = (x, y, oct = 4) => { let s = 0, amp = 1, tot = 0, f = 1; for (let o = 0; o < oct; o++) { const n = 1 - Math.abs(2 * base(x * f + o * 13.1, y * f + o * 7.9) - 1); s += n * n * amp; tot += amp; amp *= 0.5; f *= 2; } return s / tot; };
  return { base, fbm, ridged };
}

/* binary min-heap keyed by number */
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], topK = k[0], lastK = k.pop(), lastV = v.pop(), n = k.length;
    if (n > 0) {
      let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lastK) break; k[i] = k[c]; v[i] = v[c]; i = c; }
      k[i] = lastK; v[i] = lastV;
    }
    this.lastKey = topK; return top;
  }
}

/* colour helpers (used by flags, arms, maps) */
const hexToRgb = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const rgbCss = (c, a) => (a === undefined || a === 1 ? `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})` : `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`);
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const lumin = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrastRatio = (a, b) => { const x = lumin(a), y = lumin(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/* ═══ 10-tongue.js ═══ */
/* ───────────────────────── Tongues: invented languages with a real vocabulary ─────────────────────────
   Each country speaks a tongue with its own sounds. We invent a root word for ~70 concepts, then build
   place names by compounding roots, so "Orvathel" really does mean "White Harbor" and the glossary can say so. */

const NOUN_EN = { water: 'water', river: 'river', sea: 'sea', harbor: 'harbor', mountain: 'mountain', hill: 'hill', valley: 'valley', forest: 'forest', stone: 'stone', salt: 'salt', gold: 'gold', iron: 'iron', wheat: 'wheat', wine: 'wine', fish: 'fish', wolf: 'wolf', bear: 'bear', eagle: 'eagle', sun: 'sun', moon: 'moon', star: 'star', king: 'king', bridge: 'bridge', tower: 'tower', fort: 'fort', ford: 'ford', lake: 'lake', island: 'island', cape: 'cape', spring: 'spring', field: 'field', fire: 'fire', wind: 'wind', night: 'night', dawn: 'dawn', home: 'home', crown: 'crown', oak: 'oak', pine: 'pine', horse: 'horse', stag: 'stag', rose: 'rose', swan: 'swan', bell: 'bell', glass: 'glass', amber: 'amber', silver: 'silver', copper: 'copper', hearth: 'hearth', peak: 'peak', bay: 'bay', gate: 'gate', market: 'market', mill: 'mill', cliff: 'cliff' };
const ADJ_EN = { red: 'red', white: 'white', black: 'black', green: 'green', blue: 'blue', old: 'old', new: 'new', high: 'high', great: 'great', little: 'little', holy: 'holy', long: 'long', hidden: 'hidden', bright: 'bright', silent: 'silent', bitter: 'bitter', sweet: 'sweet', wild: 'wild', free: 'free', proud: 'proud' };
const CONCEPT_EN = Object.assign({}, NOUN_EN, ADJ_EN);
const IS_ADJ = (k) => Object.prototype.hasOwnProperty.call(ADJ_EN, k);
const MOD_NOUNS = ['wolf', 'bear', 'eagle', 'stag', 'swan', 'salt', 'gold', 'iron', 'stone', 'amber', 'silver', 'copper', 'wheat', 'wine', 'fish', 'rose', 'sun', 'moon', 'star', 'bell', 'glass', 'oak', 'pine', 'horse', 'fire', 'wind', 'dawn', 'night'];
const MOD_ADJS = Object.keys(ADJ_EN);

/* phonologies. C = consonants/onsets, V = vowels, K = codas, T = syllable templates (C onset, V vowel, K coda) */
const TONGUES = [
  { id: 'silvern', feel: 'flowing', C: ['l', 'r', 'n', 'm', 's', 'v', 'th', 'f', 'l', 'r'], V: ['a', 'e', 'i', 'o', 'ae', 'ia', 'a', 'e'], K: ['n', 'l', 'r', 's', 'th'], T: ['CV', 'CV', 'CVK', 'V'], link: 'e', countryEnds: ['ia', 'ar', 'eth', 'anor', 'ien'], cityEnds: ['ia', 'en', 'eth', 'or'], personEnds: ['iel', 'wen', 'ion', 'ara', 'eth'], adjFirst: true, sep: 0.03 },
  { id: 'hardic', feel: 'stony', C: ['k', 'g', 'd', 'r', 'z', 'kh', 't', 'b', 'gh', 'kr', 'dr', 'gr'], V: ['a', 'o', 'u', 'e'], K: ['k', 'r', 'n', 'g', 'd', 'z'], T: ['CVK', 'CVK', 'CV', 'CVK'], link: 'a', countryEnds: ['ak', 'or', 'un', 'ar', 'ok'], cityEnds: ['ak', 'un', 'ar', 'dun'], personEnds: ['ak', 'ur', 'og', 'ar'], adjFirst: false, sep: 0.07 },
  { id: 'solaric', feel: 'melodic', C: ['l', 'r', 's', 't', 'n', 'v', 'm', 'c', 'p', 'd', 'b'], V: ['a', 'e', 'i', 'o', 'u'], K: ['n', 's', 'r', 'l'], T: ['CV', 'CV', 'CVK', 'V'], link: 'o', countryEnds: ['ia', 'ara', 'onia', 'essa', 'ino'], cityEnds: ['ia', 'o', 'a', 'ino', 'essa'], personEnds: ['ino', 'ara', 'elo', 'ia', 'ora'], adjFirst: false, sep: 0 },
  { id: 'norvic', feel: 'wind-worn', C: ['v', 'k', 's', 'th', 'r', 'd', 'g', 'h', 'b', 'f', 'y'], V: ['a', 'o', 'i', 'y', 'u', 'e'], K: ['r', 'n', 'd', 'k', 't', 's', 'g'], T: ['CVK', 'CV', 'CVK'], link: 'a', countryEnds: ['mar', 'dal', 'gar', 'holm', 'vald'], cityEnds: ['vik', 'dal', 'sund', 'vald', 'holm'], personEnds: ['ar', 'vald', 'rik', 'dis', 'gerd'], adjFirst: true, sep: 0 },
  { id: 'kheshic', feel: 'hushed', C: ['kh', 'sh', 'z', 'q', 'h', 's', 'm', 'n', 'r', 'l', 't', 'b'], V: ['a', 'i', 'u', 'a', 'i'], K: ['r', 'n', 'm', 'sh', 'l'], T: ['CVK', 'CV', 'CVK'], link: 'a', countryEnds: ['ar', 'esh', 'im', 'an', 'ur'], cityEnds: ['ar', 'im', 'esh', 'an'], personEnds: ['im', 'ar', 'esh', 'ah'], adjFirst: false, sep: 0.18 },
  { id: 'tuvian', feel: 'open', C: ['t', 'k', 'm', 'n', 'h', 'l', 'p', 'w', 'v'], V: ['a', 'e', 'i', 'o', 'u', 'a', 'o'], K: [], T: ['CV', 'CV', 'CV', 'CV'], link: '', countryEnds: ['a', 'i', 'u', 'ani', 'ua'], cityEnds: ['a', 'ua', 'i', 'ani'], personEnds: ['a', 'i', 'ua', 'ani'], adjFirst: true, sep: 0.02 },
  { id: 'ostrian', feel: 'rolling', C: ['st', 'sk', 'tr', 'pr', 'br', 'v', 'z', 'd', 'm', 'n', 'l', 's', 'j'], V: ['a', 'e', 'o', 'i', 'y'], K: ['n', 'r', 's', 'k', 'v', 'l', 't'], T: ['CVK', 'CV', 'CVK', 'CV'], link: 'o', countryEnds: ['ova', 'ia', 'ev', 'ika', 'avia'], cityEnds: ['ov', 'ia', 'ika', 'ava', 'insk'], personEnds: ['ov', 'ek', 'ika', 'an'], adjFirst: true, sep: 0 },
  { id: 'lunaric', feel: 'soft', C: ['l', 'll', 'n', 'nn', 's', 'ss', 'm', 'r', 'd', 'v'], V: ['a', 'e', 'i', 'o', 'u', 'ia'], K: ['n', 'l', 's', 'r'], T: ['CV', 'CVK', 'CV', 'CV'], link: 'e', countryEnds: ['ella', 'anna', 'enne', 'ora', 'illa'], cityEnds: ['ella', 'enne', 'ia', 'inna'], personEnds: ['ella', 'anne', 'ora', 'iel'], adjFirst: false, sep: 0 },
  { id: 'rhunic', feel: 'breathy', C: ['r', 'h', 'dh', 'gw', 'n', 'm', 'l', 'th', 's'], V: ['a', 'e', 'o', 'u', 'i', 'a', 'e', 'ae'], K: ['n', 'r', 'dh', 'th'], T: ['CV', 'CVK', 'CV', 'CVK'], link: 'e', countryEnds: ['ion', 'wyn', 'ar', 'ael', 'nor'], cityEnds: ['wyn', 'ael', 'ion', 'nor'], personEnds: ['wyn', 'ael', 'ion', 'ar'], adjFirst: true, sep: 0.04 },
  { id: 'zephyric', feel: 'airy', C: ['z', 'f', 'v', 's', 'l', 'n', 'r', 'th'], V: ['a', 'e', 'i', 'o', 'a', 'e', 'i'], K: ['s', 'n', 'l'], T: ['CV', 'CV', 'CVK', 'VK'], link: 'e', countryEnds: ['ae', 'is', 'os', 'ea', 'ia'], cityEnds: ['ae', 'is', 'os', 'ea'], personEnds: ['ae', 'is', 'ea', 'os'], adjFirst: false, sep: 0 },
];

/* An instance of a tongue for one country: a lexicon plus generators for words, names and phrases. */
function makeLanguage(rng, tongueId) {
  const T = TONGUES.find((t) => t.id === tongueId) || rng.pick(TONGUES);
  const used = new Set();
  const syl = () => {
    const tpl = rng.pick(T.T); let s = '';
    for (const ch of tpl) s += ch === 'C' ? rng.pick(T.C) : ch === 'V' ? rng.pick(T.V) : rng.pick(T.K.length ? T.K : ['']);
    return s;
  };
  const vgroups = (w) => (w.match(/[aeiouy]+/g) || []).length;
  const makeRoot = () => {
    for (let tries = 0; tries < 60; tries++) {
      let w = syl(); if (rng.chance(0.12)) w += syl();
      if (w.length >= 2 && w.length <= 5 && vgroups(w) <= 2 && !used.has(w)) { used.add(w); return w; }
    }
    const w = syl() + syl() + syl(); used.add(w); return w;
  };
  const lex = {};
  for (const k of Object.keys(CONCEPT_EN)) lex[k] = makeRoot();

  const isV = (c) => 'aeiouy'.includes(c);
  const join = (a, b) => {
    const la = a[a.length - 1], fb = b[0];
    if (isV(la) && isV(fb)) return a.slice(0, -1) + b;
    if (!isV(la) && !isV(fb)) return T.link ? a + T.link + b : a + b;
    return a + b;
  };
  const sepJoin = (a, b) => (rng.chance(T.sep) ? a + "'" + b : join(a, b));
  const fmt = (s) => s.split("'").map(cap).join("'");

  /* compound(modifier, head): native word and its English gloss */
  const compound = (mod, head, ending) => {
    const modAdj = IS_ADJ(mod);
    const first = modAdj ? T.adjFirst : rng.chance(0.5);
    let text = first ? sepJoin(lex[mod], lex[head]) : sepJoin(lex[head], lex[mod]);
    if (ending) text = join(text, ending);
    return { text: fmt(text), en: `${cap(CONCEPT_EN[mod])} ${cap(CONCEPT_EN[head])}`, parts: [mod, head] };
  };
  const tooLong = (n) => n.text.length > 9 || vgroups(n.text.toLowerCase()) > 3 || /[aeiouy]{3,}/.test(n.text.toLowerCase());
  const unique = new Set();
  const place = (heads, mods = [...MOD_ADJS, ...MOD_NOUNS], withEnd = 0.15) => {
    for (let tries = 0; tries < 40; tries++) {
      const mod = rng.pick(mods), head = rng.pick(heads);
      const n = compound(mod, head, rng.chance(withEnd) ? rng.pick(T.cityEnds) : '');
      if (!tooLong(n) && !unique.has(n.text)) { unique.add(n.text); return n; }
    }
    let n; for (let i = 0; i < 40; i++) { n = compound(rng.pick(MOD_ADJS), rng.pick(heads), ''); if (n.text.length <= 12) break; } unique.add(n.text); return n;
  };
  const person = () => {
    let s = syl(); if (rng.chance(0.6)) s += syl();
    return cap(rng.chance(0.55) ? join(s, rng.pick(T.personEnds)) : s);
  };
  const phrase = (concepts) => ({ text: concepts.map((c) => cap(lex[c])).join(' '), en: concepts.map((c) => cap(CONCEPT_EN[c])).join(' ') });
  return { id: T.id, feel: T.feel, T, lex, compound, place, person, phrase, join, fmt, syl, rng };
}

const SITE_HEADS = {
  coast: ['harbor', 'bay', 'cape', 'harbor'],
  river: ['ford', 'bridge', 'mill', 'ford'],
  mountain: ['peak', 'cliff', 'gate', 'fort'],
  plains: ['field', 'market', 'mill', 'hearth', 'home'],
  forest: ['oak', 'pine', 'spring', 'hearth'],
  general: ['tower', 'fort', 'stone', 'crown', 'bell'],
};

/* ═══ 20-terrain.js ═══ */
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

/* ═══ 30-places.js ═══ */
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

/* ═══ 40-heraldry.js ═══ */
/* ───────────────────────── Heraldry: flag and coat of arms as plain data ─────────────────────────
   The renderers draw these specs; nothing here touches a canvas. Tinctures follow the rule of tincture
   (metal never touches metal, colour never touches colour, except on purpose). */

const TINCT = { or: '#e2b13c', argent: '#f4efe3', gules: '#c4262e', azure: '#1f4f9e', vert: '#2f7a46', sable: '#1b1b1f', purpure: '#6b2e7e', tenne: '#d97a26' };
const METALS = ['or', 'argent'], COLOURS = ['gules', 'azure', 'vert', 'sable', 'purpure'];
const TINCT_EN = { or: 'gold', argent: 'silver-white', gules: 'red', azure: 'blue', vert: 'green', sable: 'black', purpure: 'purple', tenne: 'orange' };
const CHARGES = {
  star: 'the guiding star', sun: 'the sun', crescent: 'the crescent moon', tower: 'the watchtower', mountains: 'the mountains', pine: 'the pine',
  oak: 'the old oak', waves: 'the waters', wheat: 'the harvest', rose: 'the rose', fleur: 'the lily', crown: 'the crown', key: 'the key', sword: 'the sword',
  anchor: 'the anchor', fish: 'the fish', bell: 'the bell', eagle: 'the eagle',
};
const GENERIC_CHARGES = ['star', 'sun', 'crescent', 'tower', 'rose', 'fleur', 'crown', 'key', 'sword', 'bell', 'eagle', 'star'];
const FLAG_LAYOUTS = [['hbands3', 3], ['vbands3', 3], ['hbands2', 1.2], ['nordic', 2], ['saltire', 1.4], ['diag', 1.2], ['triangle', 2], ['canton', 1.5], ['quarters', 1], ['chevron', 1.1], ['pale', 1.4]];
const ARMS_DIVISIONS = [['plain', 3], ['pale', 1.4], ['fess', 1.4], ['bend', 1.2], ['chevron', 1], ['quarterly', 1.2], ['saltire', 0.8]];
const ARMS_ORDINARIES = [[null, 3], ['chief', 1.3], ['fess', 1.3], ['pale', 1], ['bend', 1], ['chevron', 1.5], ['cross', 1.3], ['saltire', 1], ['bordure', 1.6]];
const SHIELDS = ['heater', 'heater', 'french', 'round', 'swiss', 'iberian'];

/* the 'two-tincture' rule: pairs that may sit side by side */
function legalPair(a, b) { return a !== b && (METALS.includes(a) !== METALS.includes(b)); }

function makePalette(rng, g) {
  const own = g.ownCount, bc = g.biomeCount;
  const share = (...codes) => codes.reduce((s, c) => s + (bc[c] || 0), 0) / own;
  const wc = { gules: 1.4, azure: 1.4, vert: 1, sable: 0.6, purpure: 0.5 };
  const maritime = g.type === 'island' || g.type === 'archipelago' ? 1 : 0;
  wc.azure += maritime * 2.2 + g.cities.filter((c) => c.port).length * 0.12;
  wc.vert += share(BIOME.FOREST, BIOME.PLAINS) * 3;
  wc.sable += share(BIOME.MOUNTAIN, BIOME.PEAK) * 5;
  wc.gules += g.neighbours.length * 0.4;
  const main = rng.weighted(Object.entries(wc));
  const rest = Object.entries(wc).filter(([k]) => k !== main);
  const second = rng.weighted(rest.map(([k, w]) => [k, w * (k === 'sable' || k === 'purpure' ? 0.6 : 1)]));
  const m1 = rng.weighted([['or', share(BIOME.PLAINS, BIOME.DESERT) * 3 + 1.4], ['argent', share(BIOME.MOUNTAIN, BIOME.PEAK, BIOME.TUNDRA) * 4 + 1.4]]);
  const m2 = m1 === 'or' ? 'argent' : 'or';
  return { main, second, metal: m1, metal2: m2 };
}

function pickCharge(rng, g) {
  const own = g.ownCount, bc = g.biomeCount, share = (...c) => c.reduce((s, k) => s + (bc[k] || 0), 0) / own;
  const w = [];
  GENERIC_CHARGES.forEach((c) => w.push([c, 1]));
  if (g.type === 'island' || g.type === 'archipelago') { w.push(['anchor', 3], ['fish', 1.8], ['waves', 2.2]); }
  if (g.cities.filter((c) => c.port).length >= 4) w.push(['anchor', 1.2], ['fish', 1]);
  w.push(['mountains', 0.4 + share(BIOME.MOUNTAIN, BIOME.PEAK, BIOME.HILLS) * 9]);
  w.push(['pine', share(BIOME.FOREST) * 8], ['oak', share(BIOME.FOREST) * 6]);
  w.push(['wheat', share(BIOME.PLAINS) * 9]);
  if (g.rivers.length >= 2) w.push(['waves', 1]);
  return rng.weighted(w.filter((x) => x[1] > 0));
}

function makeFlag(rng, g, pal, charge) {
  const ratio = rng.weighted([[[3, 2], 5], [[2, 1], 2], [[5, 3], 2], [[1, 1], 0.4]]);
  const layout = rng.weighted(FLAG_LAYOUTS);
  const cols = [pal.main, pal.second, pal.metal, pal.metal2];
  const A = pal.main, B = pal.metal, C = rng.chance(0.5) ? pal.second : pal.metal2;
  let colors, chargeAt = [0.5, 0.5], chargeScale = 0.46, chargeColor, params = {};
  const metalOf = (c) => (legalPair(c, B) ? B : legalPair(c, pal.metal2) ? pal.metal2 : B);
  switch (layout) {
    case 'hbands3': { const mid = rng.chance(0.55) ? B : C === A ? pal.second : C; colors = [A, legalPair(A, mid) || rng.chance(0.3) ? mid : B, rng.chance(0.6) ? A : (legalPair(mid, pal.second) ? pal.second : B)]; if (colors[1] === colors[2]) colors[2] = A; params.weights = rng.chance(0.5) ? [1, 1, 1] : [1, 2, 1]; chargeAt = rng.chance(0.4) ? [0.5, 0.5] : [0.36, 0.5]; chargeColor = legalPair(colors[1], pal.metal) ? pal.metal : (METALS.includes(colors[1]) ? A : pal.metal); break; }
    case 'vbands3': { const mid = rng.chance(0.55) ? B : pal.metal2 === B ? pal.second : pal.metal2; colors = [A, mid, rng.chance(0.6) ? A : pal.second]; if (colors[1] === colors[0]) colors[1] = B; if (colors[2] === colors[1]) colors[2] = A; params.weights = rng.chance(0.5) ? [1, 1, 1] : [1, 2, 1]; chargeAt = [0.5, 0.5]; chargeColor = METALS.includes(colors[1]) ? A : pal.metal; chargeScale = 0.4; break; }
    case 'hbands2': colors = [A, B]; chargeAt = [0.3, 0.5]; chargeColor = pal.metal2 === B ? pal.second : pal.metal2; if (chargeColor === A) chargeColor = pal.metal2; chargeScale = 0.4; break;
    case 'nordic': colors = [A, B, rng.chance(0.5) ? pal.second : A]; params.inner = colors[2] !== A && colors[2] !== B; chargeAt = [0.37, 0.5]; chargeColor = null; chargeScale = 0; break;
    case 'saltire': colors = [A, B]; chargeColor = null; chargeScale = 0; break;
    case 'diag': colors = [A, rng.chance(0.5) ? B : pal.second === A ? pal.metal2 : pal.second]; if (colors[0] === colors[1]) colors[1] = B; params.dir = rng.chance(0.5) ? 'down' : 'up'; chargeAt = [0.5, 0.5]; chargeColor = pal.metal; chargeScale = 0.3; break;
    case 'triangle': { const base = rng.chance(0.5) ? [A, B] : [A, B, A]; colors = [...base, rng.chance(0.5) ? pal.second : pal.metal2]; if (colors[colors.length - 1] === colors[0] || colors[colors.length - 1] === colors[1]) colors[colors.length - 1] = METALS.includes(colors[0]) ? pal.second : pal.metal; params.bands = base.length; params.depth = rng.pick([0.4, 0.5, 0.5]); chargeAt = [params.depth * 0.33, 0.5]; chargeColor = METALS.includes(colors[colors.length - 1]) ? A : pal.metal; chargeScale = 0.26; break; }
    case 'canton': colors = [A, B, rng.chance(0.5) ? pal.second : A]; if (colors[2] === colors[0]) colors[2] = pal.second === A ? pal.metal2 : pal.second; params.bands = rng.pick([2, 3, 5]); chargeAt = [0.2, 0.25]; chargeColor = pal.metal; chargeScale = 0.2; break;
    case 'quarters': colors = [A, B]; chargeAt = [0.5, 0.5]; chargeColor = pal.second === A ? pal.metal2 : pal.second; chargeScale = 0.3; break;
    case 'chevron': colors = [A, B, rng.chance(0.5) ? pal.second : pal.metal2]; if (colors[2] === A || colors[2] === B) colors[2] = METALS.includes(A) ? pal.second : pal.metal2; chargeAt = [0.17, 0.5]; chargeColor = null; chargeScale = 0; break;
    default: { colors = [A, B, A]; params.weights = [1, 1.4, 1]; chargeAt = [0.5, 0.5]; chargeColor = pal.metal === B ? pal.metal2 : pal.metal; chargeScale = 0.3; colors = [A, B, C === B ? pal.second : C]; if (colors[2] === colors[1]) colors[2] = A; }
  }
  const under = { hbands3: colors[1], vbands3: colors[1], hbands2: colors[0], pale: colors[1], diag: colors[0], triangle: colors[colors.length - 1], canton: colors[2] || colors[0] }[layout];
  if (chargeColor && under) chargeColor = METALS.includes(under) ? (pal.main === under ? pal.second : pal.main) : (pal.metal === under ? pal.metal2 : pal.metal);
  if (chargeColor && layout === 'quarters') chargeColor = [pal.main, pal.second, pal.metal, pal.metal2].find((x) => !colors.includes(x)) || pal.second;
  const hasCharge = chargeColor && chargeScale > 0 && rng.chance(layout === 'hbands3' || layout === 'vbands3' ? 0.65 : 0.8);
  return { layout, ratio, colors, params, charge: hasCharge ? { type: charge, color: chargeColor, at: chargeAt, scale: chargeScale } : null };
}

function makeArms(rng, g, pal, charge) {
  const division = rng.weighted(ARMS_DIVISIONS);
  const ordinary = rng.weighted(ARMS_ORDINARIES);
  const fieldA = rng.chance(0.62) ? pal.main : pal.second;
  const fieldB = legalPair(fieldA, pal.metal) ? pal.metal : pal.metal2;
  const colorOnField = (f) => (METALS.includes(f) ? (f === pal.metal ? pal.main : pal.second) : pal.metal);
  const field = division === 'plain' ? [fieldA] : [fieldA, fieldB];
  let ordColor = ordinary ? colorOnField(field[division === 'plain' ? 0 : 0]) : null;
  if (ordinary && division !== 'plain' && ordColor === field[1]) ordColor = field[1] === pal.metal ? pal.metal2 : pal.metal;
  const second = rng.pick(GENERIC_CHARGES.filter((c) => c !== charge));
  const centre = !ordinary || ordinary === 'bordure' || ordinary === 'chief' ? 1 : 0;
  const chargeColor = division === 'plain' || ordinary === 'bordure' ? (ordinary === 'bordure' ? colorOnField(field[0]) : colorOnField(field[0])) : (METALS.includes(field[0]) ? pal.main : pal.metal);
  const crest = rng.weighted([['crown', 3], ['helm', 2], ['star', 1], ['none', 1]]);
  const supporters = rng.weighted([['none', 3], ['laurel', 2], ['wheat', 1], ['wings', 1]]);
  const arrangement = rng.weighted([[1, 5], [2, 1.4], [3, 2]]);
  return { shape: rng.pick(SHIELDS), division, tinctures: field, ordinary, ordinaryColor: ordColor, charge: { type: charge, color: chargeColor, count: centre ? (division === 'quarterly' ? 1 : arrangement) : (ordinary === 'chevron' || ordinary === 'fess' || ordinary === 'bend' || ordinary === 'pale' ? 3 : 1), arrangement: arrangement }, secondCharge: division === 'quarterly' ? { type: second, color: METALS.includes(field[1]) ? pal.main : pal.metal } : null, crest, supporters, crownColor: 'or', outline: pal.metal === 'or' ? 'sable' : 'sable' };
}

function makeHeraldry(rng, g) {
  const pal = makePalette(rng, g);
  const charge = pickCharge(rng, g);
  const flag = makeFlag(rng, g, pal, charge);
  const arms = makeArms(rng, g, pal, charge);
  /* a short, honest account of what the symbols stand for */
  const means = [];
  const sea = g.seas[0], river = g.rivers[0], range = g.ranges[0];
  const meaning = { azure: sea ? `the ${sea.name} (“${sea.en}”) that washes the coast` : 'the rivers and the sky', vert: 'the forests and meadows', or: 'the grain and the sun', argent: range ? `the snows of the ${range.name} (“${range.en}”)` : 'peace and the snows', gules: 'the blood spilled at the founding', sable: 'the iron beneath the hills', purpure: 'the old royal house', tenne: 'the autumn fields' };
  const seen = new Set(); [...flag.colors, flag.charge && flag.charge.color].filter(Boolean).forEach((c) => { if (!seen.has(c) && meaning[c]) { seen.add(c); means.push(`${cap(TINCT_EN[c])}: ${meaning[c]}.`); } });
  if (flag.charge || arms.charge) means.push(`The charge, ${CHARGES[charge]}, is the nation's old emblem.`);
  return { palette: pal, charge, flag, arms, meaning: means };
}

/* ═══ 45-state.js ═══ */
/* ───────────────────────── The state: government, money, symbols, fact sheet ───────────────────────── */

const GOVERNMENTS = [
  { form: 'Kingdom', adj: 'monarchy', ruler: ['King', 'Queen'], region: ['Duchy', 'County', 'March', 'Shire'], w: 4, assembly: 'the Royal Council' },
  { form: 'Grand Duchy', adj: 'grand duchy', ruler: ['Grand Duke', 'Grand Duchess'], region: ['County', 'Barony', 'Parish'], w: 1.2, assembly: 'the Ducal Diet' },
  { form: 'Principality', adj: 'principality', ruler: ['Prince', 'Princess'], region: ['Parish', 'County', 'Vale'], w: 1.2, assembly: 'the Princely Estates' },
  { form: 'Republic', adj: 'republic', ruler: ['President', 'President'], region: ['Province', 'Canton', 'Department'], w: 3, assembly: 'the Senate' },
  { form: 'Free State', adj: 'free state', ruler: ['Chancellor', 'Chancellor'], region: ['District', 'Canton', 'Land'], w: 1.2, assembly: 'the Free Assembly' },
  { form: 'Confederation', adj: 'confederation', ruler: ['Speaker', 'Speaker'], region: ['Canton', 'Commune', 'Member State'], w: 1, assembly: 'the Council of Cantons' },
  { form: 'Empire', adj: 'empire', ruler: ['Emperor', 'Empress'], region: ['Province', 'Satrapy', 'Marches'], w: 0.7, assembly: 'the Imperial Court' },
  { form: 'Sultanate', adj: 'sultanate', ruler: ['Sultan', 'Sultana'], region: ['Emirate', 'Province', 'Vilayet'], w: 0.5, assembly: 'the Divan' },
];
const TONGUE_GOV_BIAS = { kheshic: { Sultanate: 5, Empire: 1.5 }, norvic: { Confederation: 2, Kingdom: 1.5 }, solaric: { Republic: 1.8 }, hardic: { Kingdom: 1.4, 'Grand Duchy': 1.4 }, tuvian: { Confederation: 2, 'Free State': 2 }, ostrian: { Empire: 2, 'Grand Duchy': 1.4 } };
const CLIMATES = [
  [(b) => (b[BIOME.TUNDRA] || 0) > 0.25, 'cold, windy and mostly treeless in the north'],
  [(b) => (b[BIOME.DESERT] || 0) > 0.25, 'hot and dry, with a green fringe along the rivers'],
  [(b) => (b[BIOME.FOREST] || 0) > 0.35, 'damp and temperate, wrapped in forest'],
  [(b) => (b[BIOME.PLAINS] || 0) > 0.35, 'mild, with long summers over open farmland'],
  [() => true, 'changeable and temperate, shifting with the hills'],
];
const pluralize = (w) => (w === 'March' ? 'Marches' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : /(s|x|ch|sh)$/.test(w) ? w + 'es' : w + 's');
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ANIMALS = ['wolf', 'bear', 'eagle', 'stag', 'swan', 'horse', 'fish'];
const COMMODITIES = { forest: ['timber', 'resin', 'honey'], plains: ['wheat', 'barley', 'wool'], hills: ['wool', 'cheese', 'copper'], mountain: ['iron', 'silver', 'granite'], coast: ['salted fish', 'sea salt', 'ship timber'], desert: ['glass', 'spice', 'dates'], marsh: ['peat', 'reeds', 'eels'], tundra: ['furs', 'amber', 'whale oil'], lake: ['freshwater pearls', 'smoked trout'], wine: ['wine', 'olive oil'] };

function makeState(rng, g, heraldry) {
  const lang = g.lang, bias = TONGUE_GOV_BIAS[g.tongue] || {};
  const gov = rng.weighted(GOVERNMENTS.map((x) => [x, x.w * (bias[x.form] || 1)]));
  const female = rng.chance(0.5);
  const rulerTitle = gov.ruler[female ? 1 : 0];
  const rulerName = lang.person();
  const regnal = gov.adj === 'republic' || gov.adj === 'free state' || gov.adj === 'confederation' ? '' : ROMAN[rng.int(0, 5)];
  const regionTitle = rng.pick(gov.region);

  const bc = g.biomeCount, own = g.ownCount, share = {}; for (const k of Object.keys(bc)) share[k] = bc[k] / own;
  const climate = CLIMATES.find(([f]) => f(share))[1];
  const names = ['plains', 'forest', 'hills', 'mountain', 'peak', 'desert', 'marsh', 'tundra', 'lake'];
  const landscape = names.map((n, k) => [n, share[[BIOME.PLAINS, BIOME.FOREST, BIOME.HILLS, BIOME.MOUNTAIN, BIOME.PEAK, BIOME.DESERT, BIOME.MARSH, BIOME.TUNDRA, BIOME.LAKE][k]] || 0]).filter((x) => x[1] > 0.06).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
  const sc = (k) => share[k] || 0;
  const goods = [];
  const add = (key, n) => { for (const w of COMMODITIES[key].slice(0, n)) if (!goods.includes(w)) goods.push(w); };
  if (sc(BIOME.FOREST) > 0.12) add('forest', 1); if (sc(BIOME.PLAINS) > 0.15) add('plains', 2); if (sc(BIOME.HILLS) > 0.1) add('hills', 1);
  if (sc(BIOME.MOUNTAIN) + sc(BIOME.PEAK) > 0.05) add('mountain', 2); if (g.cities.some((c) => c.port)) add('coast', 2);
  if (sc(BIOME.DESERT) > 0.08) add('desert', 1); if (sc(BIOME.MARSH) > 0.05) add('marsh', 1); if (sc(BIOME.TUNDRA) > 0.1) add('tundra', 1); if (sc(BIOME.LAKE) > 0.01) add('lake', 1);
  if (sc(BIOME.PLAINS) + sc(BIOME.HILLS) > 0.3 && rng.chance(0.4)) add('wine', 1);
  const exports = rng.sample(goods.length ? goods : ['timber'], Math.min(4, goods.length || 1));

  /* money */
  const unit = lang.fmt(lang.join(lang.syl(), rng.pick(lang.T.countryEnds.concat(lang.T.cityEnds)).slice(0, 3)));
  const sub = lang.fmt(lang.syl() + (lang.T.K.length ? rng.pick(lang.T.K) : ''));
  const currency = { name: unit, sub, per: rng.pick([10, 12, 20, 100]) };

  /* animal & tree */
  const animal = ANIMALS.filter((a) => lang.lex[a]); const nat = rng.pick(animal.length ? animal : ['wolf']);
  const nationalAnimal = { native: lang.fmt(lang.lex[nat] || 'wolf'), en: nat };
  const treeCand = ['oak', 'pine', 'rose'].filter((a) => lang.lex[a]); const tr = rng.pick(treeCand.length ? treeCand : ['oak']);
  const nationalTree = { native: lang.fmt(lang.lex[tr] || tr), en: tr === 'rose' ? 'rose' : tr + ' tree' };

  /* national day */
  const m = rng.int(0, 11), d = rng.int(1, MDAYS[m]);

  /* motto in the national tongue, with its gloss */
  const mAdj = rng.pick(['free', 'proud', 'bright', 'old', 'great', 'holy', 'wild', 'silent']);
  const mNoun = rng.pick(['stone', 'sun', 'sea', 'star', 'wind', 'fire', 'mountain', 'river', 'wolf', 'eagle', 'water', 'oak', 'bell'].filter((n) => lang.lex[n]));
  const motto = lang.phrase([mAdj, mNoun]);

  const capital = g.cities[0];
  const largest = g.cities.reduce((a, b) => (b.pop > a.pop ? b : a));
  const peak = g.peaks[0], river = g.rivers.slice().sort((a, b) => b.length - a.length)[0];
  const density = Math.round(g.population / g.area * 10) / 10;
  const gdp = Math.round(g.population * rng.int(3, 28) / 1000) / 1000;

  const facts = [
    ['Government', `${gov.form}, led by ${rulerTitle} ${rulerName}${regnal ? ' ' + regnal : ''}`],
    ['Capital', `${capital.name} (“${capital.en}”)`],
    ['Language', `${g.demonym} (a ${lang.feel} tongue)`],
    ['Area', `${g.area.toLocaleString('en-US')} km²`],
    ['Population', `${g.population.toLocaleString('en-US')} (${density} per km²)`],
    ['Divisions', `${g.regions.length} ${pluralize(regionTitle)}`],
    ['Highest point', peak ? `${peak.name} (“${peak.en}”), ${peak.alt.toLocaleString('en-US')} m` : 'none to speak of'],
    ['Longest river', river ? `${river.name} (“${river.en}”), ${river.length} km` : 'none of note'],
    ['Coastline', `${g.coastKm.toLocaleString('en-US')} km`],
    ['Currency', `${currency.name} (1 = ${currency.per} ${currency.sub})`],
    ['Exports', exports.join(', ')],
    ['Climate', climate],
    ['National animal', `${nationalAnimal.native} (“${nationalAnimal.en}”)`],
    ['National day', `${MONTHS[m]} ${d}`],
  ];
  return { government: gov.form, governmentAdj: gov.adj, assembly: gov.assembly, rulerTitle, rulerName, regnal, rulerFull: `${rulerTitle} ${rulerName}${regnal ? ' ' + regnal : ''}`, regionTitle, regionPlural: pluralize(regionTitle), climate, landscape, exports, currency, nationalAnimal, nationalTree, nationalDay: { month: m, day: d, text: `${MONTHS[m]} ${d}` }, motto, capital: capital.id, largest: largest.id, density, gdpBillions: gdp, facts };
}

/* ═══ 50-history.js ═══ */
/* ───────────────────────── History: a chronicle assembled from the country's own geography ─────────────────────────
   Events are templates filled with real places, rivers, peaks and neighbours from this country, then
   placed in order on a timeline. */

const EPITHETS = ['the Bold', 'the Wise', 'the Red', 'the Fair', 'the Old', 'the Builder', 'the Patient', 'the Stern', 'the Generous', 'Ironhand', 'the Lame', 'the Pious'];
const PLAGUES = ['Grey Sickness', 'Weeping Fever', 'Pale Death', 'Sleeping Plague', 'Red Cough'];
const WARS = ['Salt', 'Two Crowns', 'Bitter Winter', 'Broken Bridge', 'Three Rivers', 'Hollow Harvest', 'Border Stones', 'Silver Road'];

function makeHistory(rng, g, st, her) {
  const lang = g.lang, cities = g.cities, cap = cities[0];
  const now = rng.int(1180, 1980);
  const monarchy = !['republic', 'free state', 'confederation'].includes(st.governmentAdj);
  const ports = cities.filter((c) => c.port), inland = cities.filter((c) => !c.port && c.id !== 0);
  const anyCity = () => rng.pick(cities.slice(1).length ? cities.slice(1) : cities);
  const anyPort = () => (ports.length ? rng.pick(ports) : anyCity());
  const river = g.rivers[0], range = g.ranges[0], peak = g.peaks[0], sea = g.seas[0];
  const nb = g.neighbours.length ? rng.pick(g.neighbours) : null;
  const nbName = nb ? nb.name : null;
  const p = () => lang.person();
  const founder = `${p()} ${rng.pick(EPITHETS)}`;
  const people = g.demonym;
  const ev = [];
  const E = (order, kind, title, text, refs) => ev.push({ order, kind, title, text, refs: refs || {} });

  const where = cap.site === 'coast' ? `on the shore at ${cap.name}` : cap.site === 'river' ? `beside the ${river ? river.name : 'river'}, at ${cap.name}` : cap.site === 'mountain' ? `under the mountains at ${cap.name}` : `on the open ground at ${cap.name}`;
  const origin = rng.pick([
    [`The first ${people} arrive`, `${cap.site === 'coast' ? `Seafaring clans land from across the ${sea ? sea.name : 'water'}` : `Herding clans cross ${range ? `the passes of the ${range.name}` : 'the hills'}`} and settle ${where}.`],
    [`Clans gather at ${cap.name}`, `Scattered ${lang.feel} clans begin to winter together ${where}, and a common tongue starts to form.`],
  ]);
  E(0, 'origin', origin[0], origin[1], { city: cap.id });
  E(0.06, 'founding', `${cap.name} is founded`, `A palisade and a market rise ${where}. The name “${cap.name}” means “${cap.en.toLowerCase()}” in the old speech.`, { city: cap.id });

  if (monarchy) E(0.13, 'unification', `${founder} unites the clans`, `After a generation of feuds, ${founder} is acclaimed ${st.rulerTitle === 'Queen' ? 'Queen' : 'king'} at ${cap.name} and swears the first oath of the ${g.name} crown.`, { city: cap.id });
  else E(0.13, 'unification', `The Compact of ${cap.name}`, `The clan-heads of ${g.name} meet at ${cap.name}, put down their spears and sign a compact to rule by common vote under ${founder}.`, { city: cap.id });

  const prov = rng.sample(g.regions.filter((r) => r.id !== g.regionOf[cap.cell]), Math.min(2, g.regions.length - 1));
  prov.forEach((r, k) => E(0.2 + k * 0.05, 'province', `${r.name} is brought into the realm`, `${r.name} (“${r.en}”) joins ${g.name} ${rng.pick(['by marriage', 'after a short campaign', 'by treaty', 'when its lords seek protection from raiders'])} and becomes a ${st.regionTitle.toLowerCase()}.`, { region: r.id }));

  if (ports.length) { const t = anyPort(); E(0.27, 'trade', `${t.name} opens its harbor`, `Merchants from beyond the ${sea ? sea.name : 'sea'} start calling at ${t.name} (“${t.en}”) for ${rng.pick(st.exports)}, and the town doubles within a lifetime.`, { city: t.id }); }
  else { const t = anyCity(); E(0.27, 'trade', `${t.name} becomes a market town`, `Caravans meet at ${t.name} (“${t.en}”) to trade ${rng.pick(st.exports)}; its fair becomes the largest in the country.`, { city: t.id }); }

  if (river) { const near = cities.filter((c) => c.site === 'river'); const t = near.length ? rng.pick(near) : anyCity(); E(0.34, 'flood', `The Great Flood of the ${river.name}`, `Spring meltwater sends the ${river.name} (“${river.en}”) over its banks. ${t.name} is swept away and rebuilt on higher ground; a chronicler counts the dead in the thousands.`, { river: 0, city: t.id }); }
  if (peak && range) E(0.42, 'mountain', `${peak.name} wakes`, `Rockfalls and ash from ${peak.name} (“${peak.en}”), the highest summit in the ${range.name}, bury the upland pastures for three summers. A road is cut through the pass afterwards.`, { peak: 0 });

  E(0.48, 'plague', `The ${rng.pick(PLAGUES)}`, `Brought by ${ports.length ? `ships at ${anyPort().name}` : 'caravans from the border'}, the sickness kills one ${st.regionTitle.toLowerCase()} dweller in ${rng.int(4, 7)}. Orchards go unpicked, and whole villages are never resettled.`, {});

  if (nb) E(0.55, 'war', `The ${rng.pick(WARS)} War`, `${nbName} (a ${nb.tongue} people to the ${nb.cx > g.centroid[0] ? 'east' : 'west'}) contests the border. After ${rng.int(3, 14)} years of raids, the Treaty of ${anyCity().name} fixes the frontier where it still runs.`, { neighbour: nb.id });
  else E(0.55, 'war', 'Raiders from the sea', `Ships out of the ${sea ? sea.name : 'fog'} burn ${anyPort().name} three summers running. The towns respond with towers and a standing fleet.`, {});

  E(0.62, 'golden', 'A golden age', `Under ${p()} ${rng.pick(EPITHETS)}, ${g.name} enjoys fifty years of peace. Trade in ${rng.pick(st.exports)} fills the ports, ${cities[1] ? cities[1].name : cap.name} gets its first stone walls, and the ${lang.feel} poets are written down for the first time.`, {});

  if (monarchy) { const [a, b] = [p(), p()]; E(0.7, 'civil', `The War of the Two Cousins`, `${st.rulerTitle === 'Queen' ? 'A queen' : 'A king'} dies without an heir. The houses of ${a} and ${b} fight for the crown until ${cities.length > 4 ? cities[3].name : cap.name} is besieged for a winter. ${b} is crowned in the spring.`, {}); }
  else E(0.7, 'civil', `The Winter Dissolution`, `A hard year of failed harvests splits the assembly. For eleven months two rival councils sit in ${cap.name} and in ${cities[1] ? cities[1].name : cap.name}, until a general strike forces a new settlement.`, {});

  const ch = anyCity();
  E(0.8, 'reform', monarchy ? `The Charter of ${ch.name}` : `The Constitution of ${ch.name}`, monarchy ? `Nobles and townsmen force the crown to accept ${st.assembly}, which must approve new taxes. The charter is read aloud in every market square each ${st.nationalDay.text.split(' ')[0]}.` : `Delegates from all ${g.regions.length} ${st.regionPlural.toLowerCase()} agree a constitution, creating ${st.assembly} and a ${st.rulerTitle.toLowerCase()} elected for a fixed term.`, { city: ch.id });
  if (g.rivers.length > 1 || g.roads.length) E(0.88, 'works', 'The great road is finished', `A paved road links ${cap.name} to ${cities[cities.length - 1].name}, the last link opening the whole of ${g.name} to a single market.`, {});
  E(0.94, 'national', 'The national day is proclaimed', `${st.nationalDay.text} is set aside to mark the founding of the state; flags, bells and ${st.nationalAnimal.en} banners fill the streets for the first time.`, {});
  E(1, 'present', `${st.rulerFull} takes office`, `${g.name} today is a ${st.governmentAdj} of ${g.population.toLocaleString('en-US')} people in ${g.regions.length} ${st.regionPlural.toLowerCase()}, led by ${st.rulerFull} from ${cap.name}.`, {});

  ev.sort((a, b) => a.order - b.order);
  let last = 0;
  const events = ev.map((e) => { let y = Math.round(e.order * now + (e.order > 0 && e.order < 1 ? (rng.next() - 0.5) * 30 : 0)); if (y <= last) y = last + rng.int(3, 12); if (e.order === 1) y = Math.max(y, now); last = y; return { year: y, kind: e.kind, title: e.title, text: e.text, refs: e.refs }; });
  const tail = events[events.length - 1]; tail.year = now;
  const houses = []; { let y = events[2] ? events[2].year : 100; const n = monarchy ? rng.int(2, 4) : rng.int(2, 3); for (let k = 0; k < n; k++) { const to = k === n - 1 ? now : Math.round(y + (now - y) / (n - k) * (0.7 + rng.next() * 0.6)); houses.push({ name: monarchy ? `House of ${lang.person()}` : `${lang.person()} Party`, from: y, to: Math.min(to, now) }); y = Math.min(to, now); } }
  return { now, era: 'R.', eraName: 'the Reckoning', events, houses, founder, foundingYear: events[2] ? events[2].year : 0 };
}

/* ═══ 60-anthem.js ═══ */
/* ───────────────────────── Anthem: lyrics in the national tongue, a melody that fits them, MIDI ─────────────────────────
   Lyrics are built first from the country's own vocabulary; the melody is then fitted to their syllables.
   Everything is diatonic in a key signature, so the sheet music needs no accidentals. */

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_SEMI = [0, 2, 4, 5, 7, 9, 11];
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6], FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];
const MODE_LIST = [['major', 0, 3], ['dorian', 1, 2], ['mixolydian', 4, 1.4], ['minor', 5, 3], ['lydian', 3, 0.7]];
const MODE_BY_FEEL = { stony: { minor: 2.2, dorian: 1.5 }, hushed: { minor: 2, dorian: 1.5 }, 'wind-worn': { dorian: 2, mixolydian: 1.5 }, melodic: { major: 2 }, open: { major: 2, mixolydian: 1.3 }, soft: { major: 1.4, lydian: 2 }, flowing: { lydian: 1.8, dorian: 1.4 }, airy: { lydian: 2, major: 1.3 }, breathy: { dorian: 2, minor: 1.3 }, rolling: { mixolydian: 1.7, minor: 1.3 } };
const RHYTHMS = {
  4: { 2: [[4, 4], [6, 2]], 3: [[4, 2, 2], [2, 2, 4], [2, 4, 2]], 4: [[2, 2, 2, 2], [4, 2, 1, 1], [1, 1, 2, 4]], 5: [[2, 2, 2, 1, 1], [1, 1, 2, 2, 2], [2, 1, 1, 2, 2]], 6: [[2, 2, 1, 1, 1, 1], [1, 1, 1, 1, 2, 2], [2, 1, 1, 1, 1, 2]], 7: [[2, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 2], [1, 1, 2, 1, 1, 1, 1]], 8: [[1, 1, 1, 1, 1, 1, 1, 1]] },
  3: { 2: [[4, 2], [2, 4]], 3: [[2, 2, 2]], 4: [[2, 2, 1, 1], [1, 1, 2, 2], [2, 1, 1, 2]], 5: [[2, 1, 1, 1, 1], [1, 1, 1, 1, 2], [1, 1, 2, 1, 1]], 6: [[1, 1, 1, 1, 1, 1]] },
};

function syllabify(w) {
  const lw = w.toLowerCase(), parts = lw.match(/[aeiouy]+|[^aeiouy]+/g) || [lw];
  const out = []; let cur = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i], isV = /^[aeiouy]/.test(p);
    if (isV) { cur += p; if (i === parts.length - 1) { out.push(cur); cur = ''; } continue; }
    if (!cur) { cur = p; continue; }                       // leading consonants belong to the first syllable
    if (i === parts.length - 1) { out.push(cur + p); cur = ''; continue; }   // trailing consonants close the last one
    const units = p.match(/sh|th|kh|gh|dh|ch|ph|gw|[^]/g), keep = Math.floor(units.length / 2);   // split a medial cluster in two, keeping digraphs whole
    out.push(cur + units.slice(0, keep).join('')); cur = units.slice(keep).join('');
  }
  if (cur) out.push(cur);
  return out.length ? out : [lw];
}
const stepAlter = (fifths, letter) => (fifths > 0 ? (SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0) : fifths < 0 ? (FLAT_ORDER.slice(0, -fifths).includes(letter) ? -1 : 0) : 0);
const stepMidi = (fifths, step) => { const l = ((step % 7) + 7) % 7, o = Math.floor(step / 7); return 12 * (o + 1) + LETTER_SEMI[l] + stepAlter(fifths, l); };
const noteLabel = (fifths, step) => { const l = ((step % 7) + 7) % 7, a = stepAlter(fifths, l); return LETTERS[l] + (a > 0 ? '♯' : a < 0 ? '♭' : ''); };

function makeLyrics(rng, g, st) {
  const lang = g.lang;
  const W = {}; // particle words invented for this tongue
  const mk = (en) => { const t = lang.fmt(lang.syl() + (rng.chance(0.4) ? lang.syl() : '')).toLowerCase(); return { t, en }; };
  const P = { O: mk('O'), of: mk('of the'), and: mk('and'), our: mk('our'), rise: mk('rises'), stand: mk('stands'), sing: mk('sings'), ever: mk('forever'), bless: mk('keep') };
  const NOUNS = ['stone', 'sun', 'sea', 'star', 'wind', 'fire', 'mountain', 'river', 'wolf', 'eagle', 'water', 'oak', 'bell', 'moon', 'gold', 'iron', 'salt', 'wheat', 'harbor', 'forest', 'tower', 'bridge', 'king', 'island', 'valley'].filter((n) => lang.lex[n]);
  const ADJS = ['red', 'white', 'black', 'green', 'blue', 'old', 'high', 'great', 'holy', 'bright', 'silent', 'wild', 'free', 'proud', 'sweet', 'long'].filter((n) => lang.lex[n]);
  const nm = g.name.toLowerCase();
  const syl = (s) => syllabify(s).length;
  const T = [
    () => [[P.O.t, 'O'], [nm, g.name], [lang.lex[rng.pick(ADJS)], null], [lang.lex[rng.pick(NOUNS)], null]],
    () => [[lang.lex[rng.pick(NOUNS)], null], [P.and.t, 'and'], [lang.lex[rng.pick(NOUNS)], null], [P.stand.t, 'stands']],
    () => [[lang.lex[rng.pick(ADJS)], null], [lang.lex[rng.pick(NOUNS)], null], [P.sing.t, 'sings']],
    () => [[P.our.t, 'our'], [nm, g.name], [P.ever.t, 'forever']],
    () => [[lang.lex[rng.pick(NOUNS)], null], [P.of.t, 'of the'], [lang.lex[rng.pick(NOUNS)], null]],
    () => [[lang.lex[rng.pick(ADJS)], null], [lang.lex[rng.pick(NOUNS)], null], [P.rise.t, 'rises']],
    () => [[P.bless.t, 'keep'], [P.our.t, 'our'], [lang.lex[rng.pick(NOUNS)], null]],
    () => [[P.O.t, 'O'], [lang.lex[rng.pick(ADJS)], null], [lang.lex[rng.pick(NOUNS)], null], [P.of.t, 'of the'], [lang.lex[rng.pick(NOUNS)], null]],
  ];
  const enOf = (w) => { for (const k of Object.keys(CONCEPT_EN)) if (lang.lex[k] === w) return CONCEPT_EN[k]; return w; };
  const seen = new Set();
  const line = (target, tries = 400) => {
    let best = null;
    for (let i = 0; i < tries; i++) {
      const toks = rng.pick(T)(); const words = toks.map((t) => t[0]); const n = words.reduce((s, w) => s + syl(w), 0);
      if (seen.has(words.join(' '))) continue;
      const d = Math.abs(n - target); if (!best || d < best.d) best = { d, toks, words, n };
      if (d === 0) break;
    }
    const toks = best.toks; seen.add(toks.map((t) => t[0]).join(' '));
    const text = toks.map((t, k) => { const w = t[0]; return k === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : (t[1] && t[1] === g.name ? w.charAt(0).toUpperCase() + w.slice(1) : w); }).join(' ');
    const en = toks.map((t) => (t[1] ? t[1] : enOf(t[0]))).join(' ').replace(/^./, (c) => c.toUpperCase());
    const syllables = toks.flatMap((t, k) => { const parts = syllabify(t[0]); const capital = k === 0 || (t[1] && t[1] === g.name); return parts.map((x, j) => { const y = j === 0 && capital ? x.charAt(0).toUpperCase() + x.slice(1) : x; return j < parts.length - 1 ? y + '-' : y; }); });
    return { text, en, syllables, n: best.n };
  };
  return { line, P };
}

function makeAnthem(rng, g, st) {
  const lang = g.lang;
  const feel = MODE_BY_FEEL[lang.feel] || {};
  const mode = rng.weighted(MODE_LIST.map((m) => [m, m[2] * (feel[m[0]] || 1)]));
  const fifths = rng.pick([-3, -2, -1, 0, 1, 2, 3, 4]);
  const majorLetter = (((fifths * 4) % 7) + 7) % 7;
  const tonicLetter = (majorLetter + mode[1]) % 7, tonicStep = 28 + tonicLetter;
  const meter = rng.chance(0.72) ? 4 : 3, barLen = meter * 2;
  const tempo = meter === 4 ? rng.int(76, 112) : rng.int(84, 120);
  const { line: mkLine } = makeLyrics(rng, g, st);
  const n0 = rng.pick([7, 8, 8, 9]);
  const lines = [mkLine(n0), mkLine(n0), mkLine(rng.pick([n0 - 1, n0, n0 + 1])), mkLine(n0)];
  const verse2 = [mkLine(n0), mkLine(n0), mkLine(lines[2].n), mkLine(n0)].map((l) => ({ text: l.text, en: l.en }));

  /* rhythm per line: lines with the same syllable count share a rhythm, which makes the tune feel repeated */
  const rhythmFor = {};
  const rhythm = (n) => {
    if (rhythmFor[n]) return rhythmFor[n];
    const k1 = Math.ceil(n / 2), k2 = n - k1, tab = RHYTHMS[meter];
    const pick = (k) => rng.pick(tab[Math.max(2, Math.min(Math.max(...Object.keys(tab).map(Number)), k))]);
    return (rhythmFor[n] = [pick(k1), pick(k2)]);
  };
  const ends = rng.pick([[4, 2, 1, 0], [2, 4, 3, 0], [2, 1, 4, 0], [4, 4, 1, 0], [4, 2, 4, 0]]);
  const peaks = [rng.int(3, 5), rng.int(3, 6), rng.int(5, 8), rng.int(4, 6)];
  const starts = [rng.pick([0, 0, 4]), rng.pick([0, 2, 4]), rng.pick([2, 4, 4]), rng.pick([0, 2])];
  const progSets = [[0, 3], [0, 5], [0, 4], [3, 4], [1, 4], [5, 3]];
  const degOf = (d) => tonicStep + d;
  const outLines = lines.map((L, li) => {
    let rh = rhythm(L.n);
    if (li === 3) { const tab = RHYTHMS[meter], k2 = rh[1].length, all = (tab[Math.max(2, Math.min(Math.max(...Object.keys(tab).map(Number)), k2))] || []).filter((q) => q.length === k2); let long = all.filter((q) => q[q.length - 1] >= 4); if (!long.length) long = all.filter((q) => q[q.length - 1] >= 2); if (long.length) rh = [rh[0], rng.pick(long)]; }
    const flat = rh.flat(), m = flat.length;
    const s = starts[li], e = ends[li], p = Math.max(peaks[li], Math.max(s, e) + 1);
    const degs = [];
    for (let k = 0; k < m; k++) {
      const t = m === 1 ? 1 : k / (m - 1);
      let base = t < 0.55 ? s + (p - s) * (t / 0.55) : p + (e - p) * ((t - 0.55) / 0.45);
      base = Math.round(base + (k > 0 && k < m - 1 ? rng.pick([-2, -1, -1, 0, 0, 1, 1, 2]) : 0));
      degs.push(Math.max(-2, Math.min(9, base)));
    }
    degs[0] = s; degs[m - 1] = e;
    if (m > 2 && Math.abs(degs[m - 2] - e) > 2) degs[m - 2] = e + (degs[m - 2] > e ? 1 : -1);
    if (m > 2 && degs[m - 2] === e && li === 3) degs[m - 2] = e + 1;
    for (let k = 1; k < m; k++) { if (Math.abs(degs[k] - degs[k - 1]) > 4 && k !== m - 1) degs[k] = degs[k - 1] + (degs[k] > degs[k - 1] ? 3 : -3); }
    const notes = flat.map((dur, k) => { const step = degOf(degs[k]); return { step, deg: degs[k], dur, midi: stepMidi(fifths, step), syl: L.syllables[k] || '' }; });
    // bars
    const bars = [notes.slice(0, rh[0].length), notes.slice(rh[0].length)];
    // harmony: one chord per bar, chosen so it contains the strong notes
    const inTriad = (root, d) => { const x = ((d - root) % 7 + 7) % 7; return x === 0 || x === 2 || x === 4; };
    const roots = (li === 3 ? [rng.pick([4, 3]), 0] : [0, 3, 4, 5, 1]);
    const first = degs[0], last = degs[m - 1];
    let r1 = li === 3 ? roots[0] : ([0, 3, 4, 5].find((r) => inTriad(r, first)) ?? 0), r2;
    if (li === 3) r2 = 0; else { const pref = li === 0 ? [4, 0, 3] : li === 1 ? [0, 4, 5] : [3, 4, 1]; r2 = pref.find((r) => inTriad(r, last)) ?? [0, 3, 4, 5, 1].find((r) => inTriad(r, last)) ?? 4; }
    const chords = [r1, r2].map((r) => ({ root: r, steps: [degOf(r) - 7, degOf(r + 2) - 7, degOf(r + 4) - 7] }));
    return { text: L.text, en: L.en, notes, bars, chords, rhythm: rh };
  });
  const title = lang.phrase([rng.pick(['free', 'proud', 'bright', 'great', 'holy', 'old', 'high'].filter((a) => lang.lex[a])), rng.pick(['star', 'sun', 'stone', 'mountain', 'sea', 'wind', 'river', 'wolf', 'bell', 'king'].filter((a) => lang.lex[a]))]);
  return { title, fifths, mode: mode[0], tonic: noteLabel(fifths, tonicStep), tonicStep, meter, barLen, tempo, lines: outLines, verse2, composer: lang.person() };
}

/* flat schedule of notes in beats (quarter = 1), played twice: used by WebAudio and the MIDI writer */
function anthemSchedule(a, repeats = 2) {
  const out = []; let t = 0; const bar = a.barLen / 2;
  for (let r = 0; r < repeats; r++) {
    for (const L of a.lines) {
      let tb = t;
      L.bars.forEach((notes, bi) => {
        let x = tb;
        for (const n of notes) { out.push({ t: x, d: n.dur / 2, midi: n.midi, v: 0 }); x += n.dur / 2; }
        const ch = L.chords[bi];
        ch.steps.forEach((s, k) => out.push({ t: tb, d: bar, midi: stepMidi(a.fifths, s) - (k === 0 ? 12 : 0), v: k === 0 ? 1 : 2 }));
        tb += bar;
      });
      t += bar * 2;
    }
    t += bar; // breath between verses
  }
  return { notes: out, beats: t };
}

function vlq(n) { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; }
function anthemMidi(a) {
  const TPQ = 480, sch = anthemSchedule(a, 2);
  const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255], u16 = (n) => [(n >> 8) & 255, n & 255];
  const trk = (events) => { events.sort((x, y) => x.at - y.at || x.ord - y.ord); const bytes = []; let last = 0; for (const e of events) { bytes.push(...vlq(e.at - last), ...e.data); last = e.at; } bytes.push(0, 0xff, 0x2f, 0); return [0x4d, 0x54, 0x72, 0x6b, ...u32(bytes.length), ...bytes]; };
  const meta = [{ at: 0, ord: 0, data: [0xff, 0x51, 3, ...u32(Math.round(60000000 / a.tempo)).slice(1)] }, { at: 0, ord: 0, data: [0xff, 0x58, 4, a.meter, 2, 24, 8] }, { at: 0, ord: 0, data: [0xff, 0x59, 2, a.fifths & 255, a.mode === 'minor' ? 1 : 0] }, { at: 0, ord: 0, data: [0xff, 0x03, a.title.en.length, ...Array.from(a.title.en).map((c) => c.charCodeAt(0) & 127)] }];
  const voice = (v, ch, prog, vel) => { const ev = [{ at: 0, ord: 0, data: [0xc0 | ch, prog] }]; for (const n of sch.notes) if (n.v === v || (v === 1 && n.v === 2)) { const on = Math.round(n.t * TPQ), off = Math.round((n.t + n.d * 0.97) * TPQ); ev.push({ at: on, ord: 2, data: [0x90 | ch, n.midi, vel] }, { at: off, ord: 1, data: [0x80 | ch, n.midi, 0] }); } return trk(ev); };
  const header = [0x4d, 0x54, 0x68, 0x64, ...u32(6), ...u16(1), ...u16(3), ...u16(TPQ)];
  return Uint8Array.from([...header, ...trk(meta), ...voice(0, 0, 56, 96), ...voice(1, 1, 48, 62)]);
}

/* ═══ 70-country.js ═══ */
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

/* ═══ 80-heraldry-draw.js ═══ */
/* ───────────────────────── Drawing: charges, flags, shields, coats of arms ─────────────────────────
   Works on any 2D canvas context (browser or @napi-rs/canvas). All shapes are drawn in a unit square. */

const INK = '#1e1912';
const FONTS = { display: 'Cinzel, "Trajan Pro", Georgia, serif', body: '"EB Garamond", Georgia, serif', music: '"Noto Music", "Segoe UI Symbol", serif', ui: 'Inter, system-ui, sans-serif' };
function setFonts(f) { Object.assign(FONTS, f || {}); }
const tc = (name) => TINCT[name] || name;

function FS(c, lw) { c.lineWidth = lw || 0.06; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.fill(); c.stroke(); }
function blob(c, lw) { c.lineWidth = (lw || 0.06) * 2; c.lineJoin = 'round'; c.strokeStyle = INK; c.stroke(); c.fill(); }
function poly(c, pts) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); }

const CHG = {
  star(c) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.42 : 1; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); FS(c); },
  sun(c) { c.beginPath(); for (let i = 0; i < 32; i++) { const a = i * Math.PI / 16 - Math.PI / 2, r = i % 2 ? 0.55 : (i % 4 === 0 ? 1 : 0.78); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); FS(c, 0.05); c.beginPath(); c.arc(0, 0, 0.36, 0, 7); FS(c, 0.05); },
  crescent(c) { const R = 0.92, r = 0.74, d = 0.32, x = (d * d + R * R - r * r) / (2 * d), y = Math.sqrt(R * R - x * x), a = Math.atan2(y, x), b = Math.atan2(y, x - d); c.beginPath(); c.arc(0, 0, R, a, -a, false); c.arc(d, 0, r, -b, b, true); c.closePath(); FS(c); },
  tower(c) { poly(c, [[-0.55, 0.92], [-0.55, -0.62], [-0.33, -0.62], [-0.33, -0.44], [-0.11, -0.44], [-0.11, -0.62], [0.11, -0.62], [0.11, -0.44], [0.33, -0.44], [0.33, -0.62], [0.55, -0.62], [0.55, 0.92]]); FS(c); c.fillStyle = INK; c.beginPath(); c.moveTo(-0.17, 0.92); c.lineTo(-0.17, 0.4); c.arc(0, 0.4, 0.17, Math.PI, 0); c.lineTo(0.17, 0.92); c.closePath(); c.fill(); c.fillRect(-0.04, -0.2, 0.08, 0.3); },
  mountains(c) { poly(c, [[-1, 0.7], [-0.52, -0.3], [-0.22, 0.1], [0.12, -0.72], [0.5, -0.05], [0.68, -0.28], [1, 0.7]]); FS(c); c.beginPath(); c.moveTo(0.12, -0.72); c.lineTo(-0.02, -0.15); c.lineTo(0.1, 0.1); c.lineTo(0.02, 0.7); c.moveTo(-0.52, -0.3); c.lineTo(-0.58, 0.1); c.lineTo(-0.5, 0.7); c.lineWidth = 0.04; c.strokeStyle = INK; c.stroke(); },
  pine(c) { [[[0, -0.98], [-0.46, -0.32], [0.46, -0.32]], [[0, -0.62], [-0.64, 0.12], [0.64, 0.12]], [[0, -0.2], [-0.84, 0.62], [0.84, 0.62]]].forEach((t) => { poly(c, t); FS(c, 0.055); }); c.beginPath(); c.rect(-0.1, 0.62, 0.2, 0.34); FS(c, 0.05); },
  oak(c) { c.beginPath(); c.rect(-0.12, 0.1, 0.24, 0.86); c.moveTo(-0.24, 0.96); c.lineTo(0.24, 0.96); FS(c, 0.05); c.beginPath(); [[-0.42, -0.05, 0.46], [0.42, -0.05, 0.46], [0, -0.5, 0.52], [0, 0.0, 0.5]].forEach(([x, y, r]) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, 7); }); blob(c, 0.05); },
  waves(c) { const ink = INK, col = c.fillStyle; for (let k = -1; k <= 1; k++) { c.beginPath(); for (let i = 0; i <= 24; i++) { const x = -1 + i / 12, y = k * 0.52 + Math.sin(i / 12 * Math.PI * 2 * 1.5) * 0.14; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.lineCap = 'round'; c.lineWidth = 0.25; c.strokeStyle = ink; c.stroke(); c.lineWidth = 0.15; c.strokeStyle = col; c.stroke(); } },
  wheat(c) { c.beginPath(); c.moveTo(0, 0.98); c.lineTo(0, -0.6); c.lineWidth = 0.07; c.strokeStyle = INK; c.stroke(); for (let k = 0; k < 5; k++) for (const s of [-1, 1]) { c.save(); c.translate(s * 0.2, -0.45 + k * 0.28); c.rotate(s * 0.55); c.beginPath(); c.ellipse(0, 0, 0.12, 0.27, 0, 0, 7); FS(c, 0.04); c.restore(); } c.beginPath(); c.ellipse(0, -0.78, 0.12, 0.26, 0, 0, 7); FS(c, 0.04); },
  rose(c) { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; c.beginPath(); c.arc(Math.cos(a) * 0.56, Math.sin(a) * 0.56, 0.42, 0, 7); FS(c, 0.05); } c.beginPath(); c.arc(0, 0, 0.38, 0, 7); FS(c, 0.05); const f = c.fillStyle; c.fillStyle = INK; c.beginPath(); c.arc(0, 0, 0.14, 0, 7); c.fill(); c.fillStyle = f; },
  fleur(c) { const half = (s) => { c.beginPath(); c.moveTo(0.04 * s, 0.12); c.bezierCurveTo(0.3 * s, -0.4, 0.92 * s, -0.5, 0.9 * s, -0.04); c.bezierCurveTo(0.88 * s, 0.34, 0.48 * s, 0.42, 0.22 * s, 0.26); c.lineTo(0.12 * s, 0.3); c.closePath(); FS(c, 0.05); }; half(1); half(-1); c.beginPath(); c.moveTo(0, -1); c.bezierCurveTo(0.34, -0.62, 0.34, -0.12, 0, 0.3); c.bezierCurveTo(-0.34, -0.12, -0.34, -0.62, 0, -1); FS(c, 0.05); c.beginPath(); c.rect(-0.4, 0.3, 0.8, 0.17); FS(c, 0.05); c.beginPath(); c.moveTo(-0.22, 0.47); c.bezierCurveTo(-0.12, 0.7, -0.06, 0.8, 0, 1); c.bezierCurveTo(0.06, 0.8, 0.12, 0.7, 0.22, 0.47); c.closePath(); FS(c, 0.05); },
  crown(c) { poly(c, [[-0.82, 0.38], [-0.88, -0.42], [-0.42, 0.04], [0, -0.62], [0.42, 0.04], [0.88, -0.42], [0.82, 0.38]]); FS(c, 0.055); c.beginPath(); c.rect(-0.84, 0.38, 1.68, 0.38); FS(c, 0.055); [[-0.88, -0.5], [0, -0.72], [0.88, -0.5]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 0.11, 0, 7); FS(c, 0.04); }); const f = c.fillStyle; c.fillStyle = INK; [-0.5, 0, 0.5].forEach((x) => { c.beginPath(); c.arc(x, 0.57, 0.07, 0, 7); c.fill(); }); c.fillStyle = f; },
  key(c) { c.beginPath(); c.arc(0, -0.58, 0.36, 0, 7); c.arc(0, -0.58, 0.16, 0, 7, true); c.lineWidth = 0.06; c.strokeStyle = INK; c.fill('evenodd'); c.stroke(); c.beginPath(); c.rect(-0.08, -0.25, 0.16, 1.2); FS(c, 0.05); c.beginPath(); c.rect(0.08, 0.55, 0.34, 0.15); FS(c, 0.05); c.beginPath(); c.rect(0.08, 0.78, 0.24, 0.15); FS(c, 0.05); },
  sword(c) { poly(c, [[0, -1], [0.13, -0.55], [0.13, 0.36], [-0.13, 0.36], [-0.13, -0.55]]); FS(c, 0.05); c.beginPath(); c.rect(-0.42, 0.36, 0.84, 0.13); FS(c, 0.05); c.beginPath(); c.rect(-0.065, 0.49, 0.13, 0.33); FS(c, 0.05); c.beginPath(); c.arc(0, 0.9, 0.1, 0, 7); FS(c, 0.05); c.beginPath(); c.moveTo(0, -0.9); c.lineTo(0, 0.3); c.lineWidth = 0.03; c.strokeStyle = INK; c.stroke(); },
  anchor(c) { const col = c.fillStyle, st = (w, f) => { c.lineCap = 'round'; c.lineWidth = w; c.strokeStyle = f; c.stroke(); }; const path = () => { c.beginPath(); c.moveTo(0, -0.62); c.lineTo(0, 0.82); c.moveTo(-0.38, -0.42); c.lineTo(0.38, -0.42); c.moveTo(-0.78, 0.18); c.arc(0, 0.12, 0.78, Math.PI * 0.99 - 0.8 + 0.8, 0, true); }; c.beginPath(); c.arc(0, -0.8, 0.17, 0, 7); st(0.2, INK); c.beginPath(); c.arc(0, -0.8, 0.17, 0, 7); st(0.1, col); c.beginPath(); c.moveTo(0, -0.62); c.lineTo(0, 0.84); c.moveTo(-0.38, -0.4); c.lineTo(0.38, -0.4); st(0.2, INK); c.beginPath(); c.arc(0, 0.1, 0.8, 0.02 * Math.PI, 0.98 * Math.PI); st(0.2, INK); c.beginPath(); c.moveTo(0, -0.62); c.lineTo(0, 0.84); c.moveTo(-0.38, -0.4); c.lineTo(0.38, -0.4); st(0.1, col); c.beginPath(); c.arc(0, 0.1, 0.8, 0.02 * Math.PI, 0.98 * Math.PI); st(0.1, col); [[0.8, 0.1], [-0.8, 0.1]].forEach(([x, y]) => { poly(c, [[x * 1.0, y - 0.06], [x * 1.0 + (x > 0 ? 0.06 : -0.06) - (x > 0 ? 0.3 : -0.3), y - 0.38], [x - (x > 0 ? 0.0 : 0.0) + (x > 0 ? 0.16 : -0.16), y - 0.3]]); FS(c, 0.04); }); },
  fish(c) { c.beginPath(); c.moveTo(-0.95, 0); c.bezierCurveTo(-0.55, -0.55, 0.35, -0.55, 0.6, 0); c.bezierCurveTo(0.35, 0.55, -0.55, 0.55, -0.95, 0); c.closePath(); FS(c, 0.05); poly(c, [[0.5, 0], [1, -0.42], [0.92, 0], [1, 0.42]]); FS(c, 0.05); c.beginPath(); c.moveTo(-0.1, -0.38); c.lineTo(0.1, -0.7); c.lineTo(0.3, -0.34); FS(c, 0.04); const f = c.fillStyle; c.fillStyle = INK; c.beginPath(); c.arc(-0.6, -0.08, 0.07, 0, 7); c.fill(); c.fillStyle = f; c.beginPath(); c.moveTo(-0.38, -0.3); c.quadraticCurveTo(-0.28, 0, -0.38, 0.3); c.lineWidth = 0.04; c.strokeStyle = INK; c.stroke(); },
  bell(c) { c.beginPath(); c.moveTo(-0.84, 0.56); c.bezierCurveTo(-0.72, 0.46, -0.6, 0.4, -0.56, -0.05); c.bezierCurveTo(-0.5, -0.55, -0.2, -0.76, 0, -0.76); c.bezierCurveTo(0.2, -0.76, 0.5, -0.55, 0.56, -0.05); c.bezierCurveTo(0.6, 0.4, 0.72, 0.46, 0.84, 0.56); c.closePath(); FS(c, 0.055); c.beginPath(); c.arc(0, 0.72, 0.13, 0, 7); FS(c, 0.05); c.beginPath(); c.arc(0, -0.86, 0.09, 0, 7); FS(c, 0.04); c.beginPath(); c.moveTo(-0.6, 0.3); c.quadraticCurveTo(0, 0.4, 0.6, 0.3); c.lineWidth = 0.04; c.strokeStyle = INK; c.stroke(); },
  eagle(c) { const wing = (s) => { c.beginPath(); c.moveTo(0.12 * s, -0.12); c.bezierCurveTo(0.35 * s, -0.55, 0.72 * s, -0.86, 0.98 * s, -0.8); c.lineTo(0.88 * s, -0.58); c.lineTo(0.98 * s, -0.46); c.lineTo(0.84 * s, -0.32); c.lineTo(0.92 * s, -0.16); c.lineTo(0.74 * s, -0.04); c.lineTo(0.78 * s, 0.12); c.lineTo(0.5 * s, 0.14); c.lineTo(0.26 * s, 0.34); c.closePath(); FS(c, 0.05); }; wing(1); wing(-1); c.beginPath(); c.moveTo(0, -0.58); c.bezierCurveTo(0.24, -0.42, 0.28, 0, 0.2, 0.28); c.lineTo(0.34, 0.92); c.lineTo(0.14, 0.8); c.lineTo(0, 0.98); c.lineTo(-0.14, 0.8); c.lineTo(-0.34, 0.92); c.lineTo(-0.2, 0.28); c.bezierCurveTo(-0.28, 0, -0.24, -0.42, 0, -0.58); c.closePath(); FS(c, 0.05); c.beginPath(); c.arc(0, -0.68, 0.17, 0, 7); FS(c, 0.05); poly(c, [[0.08, -0.74], [0.34, -0.62], [0.08, -0.54]]); FS(c, 0.04); const f = c.fillStyle; c.fillStyle = INK; c.beginPath(); c.arc(-0.02, -0.7, 0.03, 0, 7); c.fill(); c.fillStyle = f; c.beginPath(); c.moveTo(0, 0.1); c.lineTo(0, 0.7); c.lineWidth = 0.035; c.strokeStyle = INK; c.stroke(); },
};
function drawCharge(c, type, cx, cy, size, fill) {
  const f = CHG[type] || CHG.star; c.save(); c.translate(cx, cy); c.scale(size / 2, size / 2); c.fillStyle = tc(fill); f(c); c.restore();
}

/* ── flag ── */
function drawFlag(c, spec, x, y, w, h, opts = {}) {
  const col = spec.colors.map(tc), P = spec.params || {};
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y);
  const rect = (a, b, cw, ch, fill) => { c.fillStyle = fill; c.fillRect(a, b, cw, ch); };
  const bands = (n, vertical, weights) => { const ws = weights || Array(n).fill(1), tot = ws.reduce((s, v) => s + v, 0); let p = 0; ws.forEach((wt, i) => { const len = (vertical ? w : h) * wt / tot; vertical ? rect(p, 0, len + 0.6, h, col[i % col.length]) : rect(0, p, w, len + 0.6, col[i % col.length]); p += len; }); };
  switch (spec.layout) {
    case 'hbands3': bands(3, false, P.weights); break;
    case 'vbands3': bands(3, true, P.weights); break;
    case 'hbands2': bands(2, false); break;
    case 'pale': bands(3, true, P.weights); break;
    case 'nordic': { rect(0, 0, w, h, col[0]); const cx = w * 0.36, t = h * 0.2; rect(0, h / 2 - t / 2, w, t, col[1]); rect(cx - t / 2, 0, t, h, col[1]); if (P.inner) { const u = t * 0.45; rect(0, h / 2 - u / 2, w, u, col[2]); rect(cx - u / 2, 0, u, h, col[2]); } break; }
    case 'saltire': { rect(0, 0, w, h, col[0]); c.strokeStyle = col[1]; c.lineWidth = h * 0.22; c.beginPath(); c.moveTo(-5, -5); c.lineTo(w + 5, h + 5); c.moveTo(w + 5, -5); c.lineTo(-5, h + 5); c.stroke(); break; }
    case 'diag': { rect(0, 0, w, h, col[0]); c.fillStyle = col[1]; c.beginPath(); if (P.dir === 'up') { c.moveTo(0, h); c.lineTo(w, 0); c.lineTo(w, h); } else { c.moveTo(0, 0); c.lineTo(w, h); c.lineTo(0, h); } c.closePath(); c.fill(); break; }
    case 'triangle': { const n = P.bands || 2; bands(n, false); c.fillStyle = col[col.length - 1]; c.beginPath(); c.moveTo(0, 0); c.lineTo(w * (P.depth || 0.45), h / 2); c.lineTo(0, h); c.closePath(); c.fill(); break; }
    case 'canton': { const n = P.bands || 3; const ws = Array(n).fill(1); bands(n, false, ws); rect(0, 0, w * 0.42, h * (n >= 3 ? 0.6 : 0.5), col[2] || col[0]); break; }
    case 'quarters': { rect(0, 0, w, h, col[0]); c.fillStyle = col[1]; c.fillRect(w / 2, 0, w / 2, h / 2); c.fillRect(0, h / 2, w / 2, h / 2); break; }
    case 'chevron': { rect(0, 0, w, h, col[0]); c.fillStyle = col[1]; c.beginPath(); c.moveTo(0, 0); c.lineTo(w * 0.5, h / 2); c.lineTo(0, h); c.closePath(); c.fill(); c.fillStyle = col[2]; c.beginPath(); c.moveTo(0, h * 0.2); c.lineTo(w * 0.3, h / 2); c.lineTo(0, h * 0.8); c.closePath(); c.fill(); break; }
    default: rect(0, 0, w, h, col[0]);
  }
  if (spec.charge) { const ch = spec.charge; drawCharge(c, ch.type, ch.at[0] * w, ch.at[1] * h, ch.scale * h * (spec.layout === 'canton' ? 1.25 : 1.15), ch.color); }
  if (opts.sheen) { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.14)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
  c.restore();
  if (opts.border !== false) { c.save(); c.strokeStyle = 'rgba(30,25,18,.85)'; c.lineWidth = Math.max(1, w / 220); c.strokeRect(x, y, w, h); c.restore(); }
}

/* ── shield shapes: unit box, x ∈ [-1,1], y ∈ [-1.1,1.1] ── */
function shieldPath(c, shape) {
  c.beginPath();
  switch (shape) {
    case 'round': c.arc(0, 0, 1, 0, 7); break;
    case 'french': c.moveTo(-1, -1); c.lineTo(1, -1); c.lineTo(1, 0.15); c.bezierCurveTo(1, 0.72, 0.5, 1.0, 0, 1.1); c.bezierCurveTo(-0.5, 1.0, -1, 0.72, -1, 0.15); c.closePath(); break;
    case 'swiss': c.moveTo(-1, -1); c.lineTo(1, -1); c.lineTo(1, 0.3); c.quadraticCurveTo(1, 1.1, 0, 1.1); c.quadraticCurveTo(-1, 1.1, -1, 0.3); c.closePath(); break;
    case 'iberian': c.moveTo(-1, -1); c.lineTo(1, -1); c.lineTo(1, 0); c.arc(0, 0, 1, 0, Math.PI); c.closePath(); break;
    default: c.moveTo(-1, -1); c.lineTo(1, -1); c.lineTo(1, -0.05); c.bezierCurveTo(1, 0.6, 0.45, 0.92, 0, 1.12); c.bezierCurveTo(-0.45, 0.92, -1, 0.6, -1, -0.05); c.closePath();
  }
}

function divisionFill(c, a, d, f1) {
  c.fillStyle = f1;
  const L = -1.2, R = 1.2, T = -1.2, B = 1.3;
  c.beginPath();
  switch (d) {
    case 'pale': c.rect(0, T, R, B - T); break;
    case 'fess': c.rect(L, -0.02, R - L, B); break;
    case 'bend': c.moveTo(L, T); c.lineTo(R, B * 1.1); c.lineTo(L, B * 1.1); c.closePath(); break;
    case 'chevron': c.moveTo(L, 0.5); c.lineTo(0, -0.5); c.lineTo(R, 0.5); c.lineTo(R, B); c.lineTo(L, B); c.closePath(); break;
    case 'quarterly': c.rect(0, T, R, 1.2); c.rect(L, 0, 1.2, B); break;
    case 'saltire': c.moveTo(L, T); c.lineTo(0, 0); c.lineTo(L, B); c.closePath(); c.moveTo(R, T); c.lineTo(0, 0); c.lineTo(R, B); c.closePath(); break;
    default: return;
  }
  c.fill();
}
function drawOrdinary(c, kind, fill) {
  c.fillStyle = fill; c.strokeStyle = INK; c.lineWidth = 0.035; c.lineJoin = 'miter';
  const pathOf = {
    chief: () => c.rect(-1.2, -1.2, 2.4, 1.0),
    fess: () => c.rect(-1.2, -0.28, 2.4, 0.5),
    pale: () => c.rect(-0.25, -1.2, 0.5, 2.6),
    bend: () => { c.moveTo(-1.2, -0.85); c.lineTo(-0.85, -1.2); c.lineTo(1.2, 0.85); c.lineTo(0.85, 1.2); c.closePath(); },
    chevron: () => { c.moveTo(-1.2, 0.85); c.lineTo(0, -0.1); c.lineTo(1.2, 0.85); c.lineTo(1.2, 1.35); c.lineTo(0, 0.45); c.lineTo(-1.2, 1.35); c.closePath(); },
    cross: () => { c.rect(-0.2, -1.2, 0.4, 2.6); c.rect(-1.2, -0.45, 2.4, 0.4); },
    saltire: () => { c.moveTo(-1.2, -0.95); c.lineTo(-0.95, -1.2); c.lineTo(1.2, 0.95); c.lineTo(0.95, 1.2); c.closePath(); c.moveTo(1.2, -0.95); c.lineTo(0.95, -1.2); c.lineTo(-1.2, 0.95); c.lineTo(-0.95, 1.2); c.closePath(); },
  };
  if (kind === 'bordure') return;
  c.beginPath(); (pathOf[kind] || (() => {}))(); c.fill(); c.stroke();
}
function chargePositions(count, arrangement, centre) {
  const [cx, cy] = centre;
  if (count === 1) return [[cx, cy, 1]];
  if (count === 2) return [[cx - 0.4, cy, 0.62], [cx + 0.4, cy, 0.62]];
  return [[cx - 0.42, cy - 0.28, 0.5], [cx + 0.42, cy - 0.28, 0.5], [cx, cy + 0.42, 0.5]];
}

/* full coat of arms in a box centred at (cx, cy) with width w; returns nothing */
function drawArms(c, arms, cx, cy, w, opts = {}) {
  const s = w / 2.4;
  c.save(); c.translate(cx, cy); c.scale(s, s);
  const f = arms.tinctures.map(tc), outline = INK;
  // supporters (behind)
  if (arms.supporters === 'laurel' || arms.supporters === 'wheat' || arms.supporters === 'wings') {
    for (const side of [-1, 1]) {
      c.save(); c.scale(side, 1);
      if (arms.supporters === 'laurel') { for (let i = 0; i < 9; i++) { const t = i / 8, a = 0.2 + t * 2.4; const px = 1.25 + Math.sin(t * 2.6) * 0.1, py = 1.0 - t * 2.2; c.save(); c.translate(px, py); c.rotate(-0.5 + t * 0.9); c.fillStyle = '#3f7a45'; c.strokeStyle = INK; c.lineWidth = 0.03; c.beginPath(); c.ellipse(0, 0, 0.09, 0.2, 0.5, 0, 7); c.fill(); c.stroke(); c.restore(); } }
      else if (arms.supporters === 'wheat') { c.save(); c.translate(1.3, 0.2); c.rotate(0.12); c.fillStyle = '#e2b13c'; CHG.wheat(c); c.restore(); }
      else { c.save(); c.translate(1.35, -0.1); c.scale(0.7, 0.7); c.fillStyle = '#f4efe3'; c.beginPath(); c.moveTo(0, 0.9); c.bezierCurveTo(0.4, 0.5, 0.5, -0.6, 0.1, -1.2); c.bezierCurveTo(0.7, -0.7, 1.0, -0.2, 0.9, 0.3); c.bezierCurveTo(0.7, 0.2, 0.55, 0.6, 0.2, 0.9); c.closePath(); c.lineWidth = 0.06; c.strokeStyle = INK; c.fill(); c.stroke(); c.restore(); }
      c.restore();
    }
  }
  // crest
  if (arms.crest === 'crown') drawCharge(c, 'crown', 0, -1.42, 0.78, 'or');
  else if (arms.crest === 'star') drawCharge(c, 'star', 0, -1.38, 0.5, 'or');
  else if (arms.crest === 'helm') { c.save(); c.translate(0, -1.4); c.fillStyle = '#9aa3ad'; c.strokeStyle = INK; c.lineWidth = 0.05; c.beginPath(); c.moveTo(-0.38, 0.28); c.lineTo(-0.38, -0.12); c.quadraticCurveTo(-0.38, -0.46, 0, -0.46); c.quadraticCurveTo(0.38, -0.46, 0.38, -0.12); c.lineTo(0.38, 0.28); c.closePath(); c.fill(); c.stroke(); c.fillStyle = INK; c.fillRect(-0.3, -0.12, 0.6, 0.06); c.fillRect(-0.04, -0.12, 0.08, 0.3); c.restore(); }
  // shield
  c.save(); shieldPath(c, arms.shape); c.fillStyle = f[0]; c.fill(); c.clip();
  if (arms.division !== 'plain') divisionFill(c, f[0], arms.division, f[1]);
  if (arms.ordinary && arms.ordinary !== 'bordure') drawOrdinary(c, arms.ordinary, tc(arms.ordinaryColor));
  // charges
  const ch = arms.charge, ctr = arms.ordinary === 'chief' ? [0, 0.28] : arms.ordinary === 'chevron' ? [0, -0.5] : [0, arms.division === 'quarterly' ? 0 : 0.0];
  if (arms.division === 'quarterly') {
    [[-0.5, -0.45], [0.5, 0.35]].forEach(([x, y]) => drawCharge(c, ch.type, x, y, 0.62, ch.color));
    const sc = arms.secondCharge || { type: ch.type, color: ch.color };
    [[0.5, -0.45], [-0.5, 0.35]].forEach(([x, y]) => drawCharge(c, sc.type, x, y, 0.62, sc.color));
  } else if (arms.ordinary === 'chevron' || arms.ordinary === 'fess' || arms.ordinary === 'bend' || arms.ordinary === 'pale') {
    const pos = arms.ordinary === 'fess' ? [[0, -0.7, 0.5], [-0.5, 0.65, 0.42], [0.5, 0.65, 0.42]] : arms.ordinary === 'chevron' ? [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0, 0.78, 0.5]] : arms.ordinary === 'pale' ? [[-0.62, -0.1, 0.56], [0.62, -0.1, 0.56]] : [[0.5, -0.55, 0.5], [-0.5, 0.55, 0.5]];
    pos.forEach(([x, y, z]) => drawCharge(c, ch.type, x, y, z, ch.color));
  } else if (arms.ordinary === 'cross' || arms.ordinary === 'saltire') {
    [[-0.62, -0.7], [0.62, -0.7], [-0.62, 0.5], [0.62, 0.5]].forEach(([x, y]) => drawCharge(c, ch.type, x, y, 0.42, ch.color));
  } else {
    const n = arms.ordinary === 'chief' ? Math.min(ch.count, 2) : ch.count;
    chargePositions(n, ch.arrangement, ctr).forEach(([x, y, z]) => drawCharge(c, ch.type, x, y, (arms.ordinary === 'chief' ? 1.0 : 1.3) * z, ch.color));
  }
  if (arms.ordinary === 'bordure') { shieldPath(c, arms.shape); c.strokeStyle = tc(arms.ordinaryColor); c.lineWidth = 0.34; c.stroke(); shieldPath(c, arms.shape); c.scale(0.84, 0.84); c.strokeStyle = INK; c.lineWidth = 0.03 / 0.84; c.stroke(); }
  c.restore();
  shieldPath(c, arms.shape); c.lineWidth = 0.07; c.strokeStyle = outline; c.lineJoin = 'round'; c.stroke();
  if (opts.gloss !== false) { c.save(); shieldPath(c, arms.shape); c.clip(); const g = c.createLinearGradient(-1, -1, 1, 1.2); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); c.fillStyle = g; c.fillRect(-1.3, -1.3, 2.6, 2.7); c.restore(); }
  c.restore();
}

/* ═══ 85-map.js ═══ */
/* ───────────────────────── Map renderer: parchment and atlas styles ─────────────────────────
   One per-pixel pass paints sea, relief, borders and paper; vectors (rivers, roads, glyphs, labels) go on top. */

const MAP_STYLES = {
  parchment: {
    paper: [237, 224, 192], sea: [[150, 181, 190], [193, 210, 203]], ink: [72, 50, 33], rip: [96, 132, 148], label: '#3d2a1a', seaLabel: '#46657a', regionLabel: 'rgba(84,54,28,.8)', river: '#5d8aa0', lake: [166, 198, 205], roadInk: '#6d4a2c',
    biome: [[0, 0, 0], [233, 222, 182], [196, 203, 148], [214, 196, 152], [193, 175, 141], [226, 221, 208], [237, 215, 152], [186, 201, 168], [224, 225, 214], [166, 198, 205]], relief: 1.0, grain: 0.05, vignette: 0.28, fog: 0.5, display: 'display', body: 'body',
  },
  atlas: {
    paper: [250, 247, 240], sea: [[96, 150, 196], [170, 214, 236]], ink: [52, 52, 60], rip: [255, 255, 255], label: '#22242c', seaLabel: '#1f4f7a', regionLabel: 'rgba(40,50,70,.62)', river: '#3f86c4', lake: [150, 205, 235], roadInk: '#8b3a2e',
    biome: [[0, 0, 0], [176, 210, 134], [118, 170, 100], [204, 198, 128], [176, 148, 116], [241, 241, 241], [240, 218, 146], [136, 180, 154], [218, 228, 228], [150, 205, 235]], relief: 0.8, grain: 0.015, vignette: 0.06, fog: 0.62, display: 'ui', body: 'ui',
  },
  night: {
    paper: [20, 28, 44], sea: [[16, 30, 56], [30, 56, 92]], ink: [210, 220, 235], rip: [90, 130, 190], label: '#d9e2f2', seaLabel: '#7fa6d8', regionLabel: 'rgba(214,226,246,.85)', river: '#6ea6e8', lake: [40, 76, 120], roadInk: '#e0b25a',
    biome: [[0, 0, 0], [62, 86, 78], [44, 78, 66], [78, 90, 78], [96, 96, 98], [190, 196, 206], [102, 94, 70], [52, 82, 82], [118, 128, 138], [40, 76, 120]], relief: 1.1, grain: 0.02, vignette: 0.4, fog: 0.55, display: 'display', body: 'body',
  },
};

const smoothstepf = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function box3(src, W, H) { const out = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < W && b < H) { s += src[b * W + a]; n++; } } out[y * W + x] = s / n; } return out; }

/* the grid fields the pixel pass samples, built once per country and cached on the object */
function mapFields(C) {
  if (C._mf) return C._mf;
  const g = C.geo, T = g.T, B = g.B, nReg = g.regions.length;
  const lake = new Float32Array(GN), own = new Float32Array(GN), nb = new Float32Array(GN);
  for (let i = 0; i < GN; i++) { if (B.biome[i] === BIOME.LAKE) lake[i] = 1; if (g.own[i] === 1) own[i] = 1; else if (g.own[i] >= 2) nb[i] = 1; }
  const reg = []; for (let k = 0; k < nReg; k++) { const f = new Float32Array(GN); for (let i = 0; i < GN; i++) if (g.regionOf[i] === k) f[i] = 1; reg.push(box3(f, GW, GH)); }
  const toLand = new Float32Array(GN); for (let i = 0; i < GN; i++) toLand[i] = T.isSea[i] ? Math.min(40, g.dist.toLand[i] < 1e8 ? g.dist.toLand[i] : 40) : 0;
  const rgb = [new Float32Array(GN), new Float32Array(GN), new Float32Array(GN)];
  return (C._mf = { lake: box3(lake, GW, GH), lakeRaw: lake, own: box3(box3(own, GW, GH), GW, GH), nb: box3(box3(nb, GW, GH), GW, GH), reg, toLand, rgb, E: T.e, sea: T.seaLevel });
}


/* biome colours, blurred over land only so cell edges melt into a watercolour wash */
function landColors(C, style) {
  const key = '_lc_' + style.paper.join('-'); if (C[key]) return C[key];
  const g = C.geo, T = g.T, B = g.B, R = new Float32Array(GN), G = new Float32Array(GN), Bl = new Float32Array(GN), Wt = new Float32Array(GN);
  for (let i = 0; i < GN; i++) if (!T.isSea[i]) { const b = B.biome[i], c = style.biome[b === BIOME.LAKE ? BIOME.PLAINS : b]; R[i] = c[0]; G[i] = c[1]; Bl[i] = c[2]; Wt[i] = 1; }
  const blur = (A, W) => { const o = new Float32Array(GN); for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < GW && b < GH) { const k = b * GW + a; s += A[k]; n += W ? W[k] : 1; } } o[y * GW + x] = s; } return o; };
  let r = R, gg = G, b = Bl, w = Wt;
  for (let pass = 0; pass < 2; pass++) { r = blur(r); gg = blur(gg); b = blur(b); w = blur(w); }
  for (let i = 0; i < GN; i++) { if (w[i] > 0) { r[i] /= w[i]; gg[i] /= w[i]; b[i] /= w[i]; } else { r[i] = style.paper[0]; gg[i] = style.paper[1]; b[i] = style.paper[2]; } }
  return (C[key] = { r, g: gg, b });
}

function chaikin(pts, n) { for (let k = 0; k < n; k++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(pts[pts.length - 1]); pts = o; } return pts; }

function textAlong(c, text, pts, spacing, start) {
  const seg = []; let len = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); len += d; }
  const widths = Array.from(text).map((ch) => c.measureText(ch).width + spacing), tw = widths.reduce((s, v) => s + v, 0) - spacing;
  if (tw > len * 0.98) return false;
  let pos = start === undefined ? (len - tw) / 2 : start;
  const at = (d) => { let acc = 0; for (let i = 0; i < seg.length; i++) { if (acc + seg[i] >= d) { const t = (d - acc) / seg[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0])]; } acc += seg[i]; } const l = pts.length; return [pts[l - 1][0], pts[l - 1][1], 0]; };
  const a0 = at(pos), a1 = at(pos + tw); const flip = Math.cos(Math.atan2(a1[1] - a0[1], a1[0] - a0[0])) < 0;
  const chars = Array.from(text); if (flip) { chars.reverse(); widths.reverse(); }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  let d = pos;
  chars.forEach((ch, i) => { const w = widths[i] - spacing, p = at(d + w / 2); c.save(); c.translate(p[0], p[1]); c.rotate(flip ? p[2] + Math.PI : p[2]); if (c._halo) c.strokeText(ch, 0, 0); c.fillText(ch, 0, 0); c.restore(); d += widths[i]; });
  return true;
}

function drawMap(c, C, x, y, w, h, opts = {}) {
  const style = MAP_STYLES[opts.style] || MAP_STYLES.parchment;
  const g = C.geo, T = g.T, B = g.B, F = mapFields(C), inset = opts.frame === false ? 0 : Math.round(Math.min(w, h) * 0.034); x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const iw = Math.floor(w - inset * 2), ih = Math.floor(h - inset * 2), ix = Math.round(x + inset), iy = Math.round(y + inset);
  const css = (a, al) => rgbCss(a, al), rnd = sub(C.seed, 'mapart'), nz = makeNoise(rnd.seed32());

  /* view: frame the country with room for the sea and neighbours */
  const [bx0, by0, bx1, by1] = g.bbox; const m = opts.margin === undefined ? 0.13 : opts.margin;
  let vw = (bx1 - bx0 + 1) * (1 + 2 * m), vh = (by1 - by0 + 1) * (1 + 2 * m);
  if (vw / vh < iw / ih) vw = vh * iw / ih; else vh = vw * ih / iw;
  let vx = (bx0 + bx1 + 1) / 2 - vw / 2, vy = (by0 + by1 + 1) / 2 - vh / 2;
  if (vw <= GW) vx = Math.max(0, Math.min(GW - vw, vx)); if (vh <= GH) vy = Math.max(0, Math.min(GH - vh, vy));
  const ppc = iw / vw;
  const X = (cx) => (cx - vx) * ppc, Y = (cy) => (cy - vy) * ppc;      // cell coords → pixels inside the inner window
  const cellP = (i) => [X(i % GW + 0.5), Y(((i / GW) | 0) + 0.5)];
  const E = F.E, SEA = F.sea;

  const bil = (A, gx, gy) => { gx -= 0.5; gy -= 0.5; if (gx < 0) gx = 0; else if (gx > GW - 1.001) gx = GW - 1.001; if (gy < 0) gy = 0; else if (gy > GH - 1.001) gy = GH - 1.001; const x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0, i = y0 * GW + x0; return (A[i] * (1 - fx) + A[i + 1] * fx) * (1 - fy) + (A[i + GW] * (1 - fx) + A[i + GW + 1] * fx) * fy; };

  /* ── per-pixel layer ── */
  const img = c.createImageData(iw, ih), D = img.data, nReg = g.regions.length, regArg = new Uint8Array(iw * ih), landM = new Uint8Array(iw * ih);
  const borderOwn = new Float32Array(iw * ih), seed = 91;
  const LC = landColors(C, style), rel = style.relief, sea0 = style.sea[0], sea1 = style.sea[1];
  const jit = 0.016, ripple = [0.85, 1.9, 3.3];
  for (let py = 0; py < ih; py++) {
    for (let px = 0; px < iw; px++) {
      const gx = vx + (px + 0.5) / ppc, gy = vy + (py + 0.5) / ppc, o = (py * iw + px) * 4, pi = py * iw + px;
      const isOut = gx < 0 || gy < 0 || gx > GW || gy > GH;
      let paperOut = false; if (isOut) paperOut = !T.isSea[Math.min(GH - 1, Math.max(0, gy | 0)) * GW + Math.min(GW - 1, Math.max(0, gx | 0))];
      const e0 = isOut ? SEA - 0.3 : bil(E, gx, gy), lk = isOut ? 0 : bil(F.lake, gx, gy);
      const ex = isOut ? 0 : bil(E, gx + 0.55, gy) - bil(E, gx - 0.55, gy), ey = isOut ? 0 : bil(E, gx, gy + 0.55) - bil(E, gx, gy - 0.55), gm = Math.max(0.004, Math.sqrt(ex * ex + ey * ey) / 1.1);
      const j = (nz.fbm(gx * 2.2, gy * 2.2, 3) - 0.5) * Math.min(jit, gm * 0.5), e = e0 + j;
      const grain = (hash2(px, py, seed) - 0.5) * style.grain * 2 + (nz.fbm(gx * 7, gy * 7, 2) - 0.5) * style.grain * 3;
      let r, gcol, b;
      const land = e > SEA, ownF = isOut ? 0 : bil(F.own, gx, gy), nbF = isOut ? 0 : bil(F.nb, gx, gy);
      if (land) {
        landM[pi] = 1;
        let col = [bil(LC.r, gx, gy), bil(LC.g, gx, gy), bil(LC.b, gx, gy)];
        const lev = Math.max(0, (e0 - SEA) / (1 - SEA));
        const shade = (-(ex + ey) * 14 * rel) * (0.6 + lev * 2.2) + (lev - 0.35) * 0.12 * rel;
        let k = 1 + Math.max(-0.38, Math.min(0.38, shade)) + grain;
        r = col[0] * k; gcol = col[1] * k; b = col[2] * k;
        // neighbouring lands fade towards the paper
        if (ownF < 0.5) { const f = style.fog * smoothstepf(0.5, 0.15, ownF) * (nbF > 0.05 ? 1 : 0.35); r += (style.paper[0] - r) * f; gcol += (style.paper[1] - gcol) * f; b += (style.paper[2] - b) * f; }
        // lakes
        const lkf = smoothstepf(0.42, 0.58, lk);
        if (lkf > 0) { r += (style.lake[0] - r) * lkf; gcol += (style.lake[1] - gcol) * lkf; b += (style.lake[2] - b) * lkf; const edge = 1 - smoothstepf(0.0, 0.1, Math.abs(lk - 0.5)); r += (style.ink[0] - r) * edge * 0.45; gcol += (style.ink[1] - gcol) * edge * 0.45; b += (style.ink[2] - b) * edge * 0.45; }
        // coastline ink
        const dpx = Math.abs(e - SEA) / gm * ppc;
        const ca = 1 - smoothstepf(0.35, 1.25, dpx);
        if (ca > 0) { const a = ca * 0.85; r += (style.ink[0] - r) * a; gcol += (style.ink[1] - gcol) * a; b += (style.ink[2] - b) * a; }
        // international border
        if (ownF > 0.18 && nbF > 0.18 && opts.borders !== false) { const dd = Math.abs(ownF - nbF) * ppc * 0.5; const ba = 1 - smoothstepf(0.4, 1.6, dd); borderOwn[pi] = ba * (((px + py) >> 2) % 3 === 2 ? 0.3 : 1); }
        // province argmax
        if (ownF > 0.5) { let best = -1, bv = 0.0; for (let k2 = 0; k2 < nReg; k2++) { const v = bil(F.reg[k2], gx, gy); if (v > bv) { bv = v; best = k2; } } regArg[pi] = best + 1; }
      } else {
        // sea: lighter near the shore, with ripple lines that echo the coast
        const dl = isOut ? 40 : bil(F.toLand, gx, gy), t = Math.exp(-Math.max(0, dl - 0.4) * 0.22);
        let k = 1 + grain * 0.6;
        r = (sea0[0] + (sea1[0] - sea0[0]) * t) * k; gcol = (sea0[1] + (sea1[1] - sea0[1]) * t) * k; b = (sea0[2] + (sea1[2] - sea0[2]) * t) * k;
        for (let q = 0; q < ripple.length; q++) { const d = Math.abs(dl - ripple[q] - (nz.fbm(gx * 1.3, gy * 1.3, 2) - 0.5) * 0.35) * ppc; const a = (1 - smoothstepf(0.2, 1.1, d)) * (0.5 - q * 0.12); if (a > 0) { r += (style.rip[0] - r) * a; gcol += (style.rip[1] - gcol) * a; b += (style.rip[2] - b) * a; } }
        const dpx = Math.abs(e - SEA) / gm * ppc, ca = 1 - smoothstepf(0.35, 1.25, dpx); if (ca > 0) { const a = ca * 0.85; r += (style.ink[0] - r) * a; gcol += (style.ink[1] - gcol) * a; b += (style.ink[2] - b) * a; }
      }
      if (paperOut) { r = style.paper[0]; gcol = style.paper[1]; b = style.paper[2]; }
      // vignette & paper edge burn
      const vxr = (px / iw - 0.5) * 2, vyr = (py / ih - 0.5) * 2, vg = smoothstepf(0.55, 1.45, Math.sqrt(vxr * vxr * 0.9 + vyr * vyr)) * style.vignette;
      const dark = style.paper[0] < 100 ? 1 : 0;
      r *= 1 - vg * (dark ? 0.8 : 0.55); gcol *= 1 - vg * (dark ? 0.8 : 0.6); b *= 1 - vg * (dark ? 0.8 : 0.7);
      D[o] = r; D[o + 1] = gcol; D[o + 2] = b; D[o + 3] = 255;
    }
  }
  // province borders from the argmax map
  if (opts.borders !== false) {
    const bAlpha = new Float32Array(iw * ih);
    for (let py = 0; py < ih - 1; py++) for (let px = 0; px < iw - 1; px++) { const i = py * iw + px, a = regArg[i]; if (!a) continue; const b1 = regArg[i + 1], b2 = regArg[i + iw]; if ((b1 && b1 !== a) || (b2 && b2 !== a)) bAlpha[i] = (((px + py) >> 2) % 4 === 3) ? 0.25 : 0.8; }
    for (let py = 1; py < ih - 1; py++) for (let px = 1; px < iw - 1; px++) { const i = py * iw + px; let a = bAlpha[i] * 0.5 + (bAlpha[i - 1] + bAlpha[i + 1] + bAlpha[i - iw] + bAlpha[i + iw]) * 0.125; a = Math.min(0.85, a * 1.4) + borderOwn[i] * 0.95; if (a > 0.01) { a = Math.min(0.95, a); const o = i * 4, ink = a > 0.8 && borderOwn[i] > 0.5 ? [150, 40, 40] : style.ink; D[o] += (ink[0] - D[o]) * a; D[o + 1] += (ink[1] - D[o + 1]) * a; D[o + 2] += (ink[2] - D[o + 2]) * a; } }
  }
  c.save(); c.beginPath(); c.rect(ix, iy, iw, ih); c.clip();
  { const tm = c.getTransform ? c.getTransform() : { e: 0, f: 0 }; c.putImageData(img, Math.round(ix + tm.e), Math.round(iy + tm.f)); }   // putImageData ignores transforms, so add the translation by hand
  c.translate(ix, iy);

  /* ── vectors ── */
  const base = Math.max(9, Math.min(22, ppc * 2.1)), inkCss = css(style.ink), halo = css(style.paper, 0.82);
  const placed = []; const hit = (r) => placed.some((p) => !(r[2] < p[0] || r[0] > p[2] || r[3] < p[1] || r[1] > p[3]));
  const reserve = (r) => placed.push(r);
  const fnt = (kind, size, wt = '', it = '') => `${it ? it + ' ' : ''}${wt ? wt + ' ' : ''}${size}px ${FONTS[kind === 'display' ? style.display : style.body]}`;
  const inView = (px, py, pad = 0) => px > -pad && py > -pad && px < iw + pad && py < ih + pad;

  // glyphs for relief and vegetation
  if (opts.glyphs !== false) {
    const gl = [];
    for (let i = 0; i < GN; i++) {
      if (T.isSea[i]) continue; const b = B.biome[i]; if (b === BIOME.PLAINS || b === BIOME.LAKE) continue;
      const cx = i % GW, cy = (i / GW) | 0; const [px, py] = cellP(i); if (!inView(px, py, 12)) continue;
      if (g.dist.toSea[i] >= 0 && g.dist.toSea[i] < 1.5 && b !== BIOME.MOUNTAIN && b !== BIOME.PEAK) continue;
      if (F.nb[i] > 0.9 && opts.glyphsNeighbours === false) continue;
      const hv = hash2(cx, cy, 211), p = b === BIOME.MOUNTAIN || b === BIOME.PEAK ? 0.34 : b === BIOME.HILLS ? 0.16 : b === BIOME.FOREST ? 0.22 : b === BIOME.MARSH ? 0.12 : b === BIOME.DESERT ? 0.1 : 0.08;
      if (hv > p * Math.min(1.4, 6 / Math.max(3, ppc))) continue;
      gl.push([py + (hash2(cx, cy, 5) - 0.5) * ppc * 0.8, px + (hash2(cx, cy, 6) - 0.5) * ppc * 0.8, b, F.nb[i] > 0.5 ? 0.55 : 1]);
    }
    gl.sort((a, b) => a[0] - b[0]);
    const s = Math.max(3.4, ppc * 0.62);
    for (const [py, px, b, al] of gl) {
      c.globalAlpha = al; c.lineWidth = Math.max(0.8, s * 0.12); c.strokeStyle = inkCss; c.lineJoin = 'round'; c.lineCap = 'round';
      if (b === BIOME.MOUNTAIN || b === BIOME.PEAK) { const k = b === BIOME.PEAK ? 1.35 : 1; c.fillStyle = css(style.paper, 0.9); c.beginPath(); c.moveTo(px - s * k, py); c.lineTo(px - s * 0.1 * k, py - s * 1.45 * k); c.lineTo(px + s * k, py); c.closePath(); c.fill(); c.stroke(); c.fillStyle = css(style.ink, 0.38); c.beginPath(); c.moveTo(px - s * 0.1 * k, py - s * 1.45 * k); c.lineTo(px + s * k, py); c.lineTo(px + s * 0.15 * k, py); c.closePath(); c.fill(); }
      else if (b === BIOME.HILLS) { c.beginPath(); c.arc(px, py, s * 0.8, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }
      else if (b === BIOME.FOREST) { c.fillStyle = style.paper[0] < 100 ? 'rgba(90,150,110,.8)' : 'rgba(86,120,70,.75)'; c.beginPath(); c.moveTo(px, py - s * 1.35); c.lineTo(px - s * 0.62, py); c.lineTo(px + s * 0.62, py); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(px, py); c.lineTo(px, py + s * 0.35); c.stroke(); }
      else if (b === BIOME.MARSH) { c.beginPath(); c.moveTo(px - s * 0.7, py); c.lineTo(px + s * 0.7, py); c.moveTo(px - s * 0.3, py); c.lineTo(px - s * 0.4, py - s * 0.6); c.moveTo(px, py); c.lineTo(px, py - s * 0.8); c.moveTo(px + s * 0.3, py); c.lineTo(px + s * 0.4, py - s * 0.6); c.stroke(); }
      else if (b === BIOME.DESERT) { c.fillStyle = inkCss; for (let q = 0; q < 3; q++) { c.beginPath(); c.arc(px + (q - 1) * s * 0.6, py + (q % 2) * s * 0.4, Math.max(0.7, s * 0.09), 0, 7); c.fill(); } }
      else if (b === BIOME.TUNDRA) { c.beginPath(); c.moveTo(px - s * 0.5, py); c.lineTo(px - s * 0.1, py); c.moveTo(px + s * 0.1, py + s * 0.35); c.lineTo(px + s * 0.5, py + s * 0.35); c.stroke(); }
    }
    c.globalAlpha = 1;
  }

  // rivers: follow each chain downstream and draw smooth, widening strokes
  { const seen = new Uint8Array(GN), has = new Uint8Array(GN); for (let i = 0; i < GN; i++) if (g.riverMask[i]) { const f = g.D.flowTo[i]; if (f >= 0 && g.riverMask[f]) has[f] = 1; }
    const sources = []; for (let i = 0; i < GN; i++) if (g.riverMask[i] && !has[i]) sources.push(i);
    sources.sort((a, b) => a - b);
    c.strokeStyle = style.river; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of sources) {
      const chain = []; let cur = s, guard = 0;
      while (cur >= 0 && guard++ < 600) { chain.push(cur); if (seen[cur]) break; seen[cur] = 1; const f = g.D.flowTo[cur]; if (f < 0) break; if (T.isSea[f] || B.biome[f] === BIOME.LAKE) { chain.push(f); break; } cur = f; }
      if (chain.length < 3) continue;
      const pts = chain.map((cc, qi) => { const p = cellP(cc), last = qi === chain.length - 1 || qi === 0; return last ? p : [p[0] + (nz.fbm(p[0] / 23, p[1] / 23, 2) - 0.5) * ppc * 1.3, p[1] + (nz.fbm(p[0] / 23 + 40, p[1] / 23 + 9, 2) - 0.5) * ppc * 1.3]; }); if (!pts.some((p) => inView(p[0], p[1], 40))) continue;
      for (let k = 1; k < pts.length - 1; k++) {
        const a = pts[k - 1], b = pts[k], d = pts[k + 1], m1 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m2 = [(b[0] + d[0]) / 2, (b[1] + d[1]) / 2], acc = g.D.acc[chain[k]];
        c.lineWidth = Math.max(0.9, (0.55 + 0.085 * Math.sqrt(acc)) * ppc / 5.2); c.beginPath(); c.moveTo(k === 1 ? a[0] : m1[0], k === 1 ? a[1] : m1[1]); c.quadraticCurveTo(b[0], b[1], k === pts.length - 2 ? d[0] : m2[0], k === pts.length - 2 ? d[1] : m2[1]); c.stroke();
      }
    } }

  // roads
  if (opts.roads !== false) for (const rd of g.roads) {
    const pts = chaikin(rd.cells.filter((_, k) => k % 2 === 0 || k === rd.cells.length - 1).map(cellP), 2); c.beginPath(); pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.strokeStyle = style.paper[0] < 100 ? 'rgba(20,28,44,.7)' : css(style.paper, 0.7); c.lineWidth = Math.max(2, ppc * (rd.kind === 'main' ? 0.5 : 0.36)); c.setLineDash([]); c.stroke();
    c.strokeStyle = style.roadInk; c.lineWidth = Math.max(1, ppc * (rd.kind === 'main' ? 0.26 : 0.18)); c.setLineDash(rd.kind === 'main' ? [ppc * 1.6, ppc * 0.7] : [ppc * 0.5, ppc * 0.8]); c.stroke(); c.setLineDash([]);
  }

  const cR = Math.max(26, Math.min(iw, ih) * 0.075), ccx = iw - cR * 1.5, ccy = ih - cR * 1.55;
  if (opts.decor !== false) { reserve([ccx - cR * 1.4, ccy - cR * 1.7, ccx + cR * 1.4, ccy + cR * 1.4]); reserve([0, ih - cR * 2.3, iw * 0.25, ih]); }
  if (opts.title) reserve([0, 0, Math.min(iw * 0.34, base * 22), base * 6.6]);
  // city markers go down first so that labels route around them
  const order = g.cities.slice().sort((a, b) => b.rank - a.rank);
  if (opts.cities !== false) for (const ct of order) {
    const px = X(ct.x + 0.5), py = Y(ct.y + 0.5); const r = [0, 2.3, 2.9, 3.6, 5.2][ct.rank] * Math.max(0.75, ppc / 6);
    c.fillStyle = css(style.paper); c.strokeStyle = inkCss; c.lineWidth = Math.max(1, r * 0.34);
    if (ct.capital) { c.beginPath(); c.arc(px, py, r * 1.25, 0, 7); c.fill(); c.stroke(); c.fillStyle = inkCss; c.beginPath(); for (let q = 0; q < 10; q++) { const a = -Math.PI / 2 + q * Math.PI / 5, rr = q % 2 ? r * 0.38 : r * 0.9; c.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } c.closePath(); c.fill(); }
    else { c.beginPath(); c.arc(px, py, r, 0, 7); c.fill(); c.stroke(); c.fillStyle = inkCss; c.beginPath(); c.arc(px, py, r * 0.42, 0, 7); c.fill(); }
    reserve([px - r * 1.5, py - r * 1.5, px + r * 1.5, py + r * 1.5]);
  }

  /* labels */
  c.textBaseline = 'middle'; c.textAlign = 'center'; c.lineJoin = 'round'; c.strokeStyle = halo;
  const label = (txt, px, py, font, fill, opt = {}) => {
    c.font = font; const sp = opt.spacing || 0; const t = opt.upper ? txt.toUpperCase() : txt; c.letterSpacing = sp ? sp + 'px' : '0px';
    const wd = c.measureText(t).width, hh = parseInt(font.match(/(\d+(?:\.\d+)?)px/)[1], 10), rect = [px - wd / 2 - 2, py - hh / 2 - 1, px + wd / 2 + 2, py + hh / 2 + 1];
    if (!opt.force && (hit(rect) || rect[0] < 4 || rect[2] > iw - 4 || rect[1] < 4 || rect[3] > ih - 4)) { c.letterSpacing = '0px'; return false; }
    c.lineWidth = opt.halo || 3.2; c.strokeStyle = opt.haloColor || halo; c.fillStyle = fill; c.textAlign = 'center'; c.strokeText(t, px, py); c.fillText(t, px, py); reserve(rect); c.letterSpacing = '0px'; return true;
  };
  // neighbour names, region names, seas
  if (opts.labels !== false) {
    for (const n of g.neighbours) { const px = X(n.cx), py = Y(n.cy); if (inView(px, py, -20)) label(n.name, px, py, fnt('display', base * 1.25, '600'), style.regionLabel, { spacing: base * 0.35, upper: true, halo: 4 }); }
    for (const r of g.regions) {
      const px = X(r.cx), py = Y(r.cy), f = fnt('display', base * 1.18, '600'), o = { spacing: base * 0.28, upper: true, halo: 4 };
      const offs = [[0, 0], [0, -base * 1.7], [0, base * 1.7], [base * 3.5, 0], [-base * 3.5, 0], [base * 3.5, -base * 1.7], [-base * 3.5, -base * 1.7], [base * 3.5, base * 1.7], [-base * 3.5, base * 1.7], [0, -base * 3.4], [0, base * 3.4]];
      if (!offs.some(([ox, oy]) => label(r.name, px + ox, py + oy, f, style.regionLabel, o))) label(r.name, px, py, f, style.regionLabel, { ...o, force: true });
    }
    for (const s of g.seas) { const px = X(s.x + 0.5), py = Y(s.y + 0.5); if (inView(px, py, -30)) label(s.name + ' Sea', px, py, fnt('body', base * 1.2, '', 'italic'), style.seaLabel, { spacing: base * 0.4, upper: true, halo: 0.01, haloColor: 'rgba(0,0,0,0)' }); }
  }
  // ranges
  if (opts.labels !== false) for (const r of g.ranges.slice(0, 3)) {
    const px = X(r.cx + 0.5), py = Y(r.cy + 0.5); if (!inView(px, py, -10)) continue; const ang = Math.atan2(r.vy, r.vx), ca = Math.max(-0.7, Math.min(0.7, ang));
    c.save(); c.translate(px, py); c.rotate(ca); c.font = fnt('display', base * 0.95, '600', 'italic'); c.letterSpacing = base * 0.3 + 'px'; c.fillStyle = style.paper[0] < 100 ? 'rgba(220,226,240,.85)' : 'rgba(58,40,28,.85)'; c.strokeStyle = halo; c.lineWidth = 3; c.textAlign = 'center'; const t = (r.name + ' Mts.').toUpperCase(), wd = c.measureText(t).width; const rect = [px - wd / 2, py - base, px + wd / 2, py + base]; if (!hit(rect)) { c.strokeText(t, 0, 0); c.fillText(t, 0, 0); reserve(rect); } c.letterSpacing = '0px'; c.restore();
  }
  // rivers & lakes
  if (opts.labels !== false) {
    for (const rv of g.rivers.slice(0, 3)) { const pts = chaikin(rv.cells.filter((_, k) => k % 2 === 0).map(cellP), 2); if (pts.length < 8) continue; const n = pts.length, seg = pts.slice(Math.floor(n * 0.3), Math.floor(n * 0.8)); c.font = fnt('body', base * 0.95, '', 'italic'); c.fillStyle = style.seaLabel; c.strokeStyle = halo; c.lineWidth = 2.6; c._halo = true; textAlong(c, rv.name, seg, base * 0.14); c._halo = false; }
    for (const lk of g.lakes.slice(0, 2)) { const px = X(lk.cx + 0.5), py = Y(lk.cy + 0.5); if (inView(px, py, -10)) label(lk.name, px, py, fnt('body', base * 0.82, '', 'italic'), style.seaLabel, {}); }
  }
  // cities (drawn over region/river names), peaks
  const cityFont = (rk) => [null, fnt('body', base * 0.86, '500'), fnt('body', base * 0.98, '500'), fnt('display', base * 0.95, '600'), fnt('display', base * 1.18, '700')][rk];
  if (opts.cities !== false) {
    if (opts.labels !== false) for (const ct of order) {
      const px = X(ct.x + 0.5), py = Y(ct.y + 0.5), r = [0, 2.3, 2.9, 3.6, 5.2][ct.rank] * Math.max(0.75, ppc / 6), font = cityFont(ct.rank), fs = parseInt(font.match(/(\d+(?:\.\d+)?)px/)[1], 10);
      c.font = font; c.letterSpacing = ct.capital ? base * 0.12 + 'px' : '0px'; const wd = c.measureText(ct.capital ? ct.name.toUpperCase() : ct.name).width; c.letterSpacing = '0px';
      const dx = r * 1.6 + wd / 2 + 2, dy = r * 1.5 + fs * 0.62;
      const spots = [[dx, -fs * 0.1], [-dx, -fs * 0.1], [0, -dy], [0, dy], [dx * 0.7, -dy * 0.8], [-dx * 0.7, -dy * 0.8], [dx * 0.7, dy * 0.8], [-dx * 0.7, dy * 0.8]];
      for (const [ox, oy] of spots) { if (label(ct.name, px + ox, py + oy, font, style.label, { upper: ct.capital, spacing: ct.capital ? base * 0.12 : 0, force: ct.capital && ox === spots[0][0] })) break; }
    }
    // peaks
    if (opts.labels !== false) for (const pk of g.peaks.slice(0, 2)) { const px = X(pk.x + 0.5), py = Y(pk.y + 0.5); c.fillStyle = inkCss; c.beginPath(); c.moveTo(px, py - 4); c.lineTo(px - 3.4, py + 2.4); c.lineTo(px + 3.4, py + 2.4); c.closePath(); c.fill(); label(`${pk.name}  ${pk.alt.toLocaleString('en-US')} m`, px, py + 11, fnt('body', base * 0.78, '', 'italic'), style.label, {}); }
  }

  /* compass rose and scale bar */
  const kmPx = g.kmPerCell / ppc;                                       // km per pixel
  if (opts.decor !== false) {
    const R = cR, cx = ccx, cy = ccy;
    c.save(); c.translate(cx, cy); c.globalAlpha = 0.95; c.fillStyle = css(style.paper, 0.55); c.beginPath(); c.arc(0, 0, R * 1.18, 0, 7); c.fill(); c.strokeStyle = inkCss; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, R * 1.0, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, R * 0.78, 0, 7); c.stroke();
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8 - Math.PI / 2, major = k % 4 === 0, mid = k % 2 === 0, len = major ? R * 1.0 : mid ? R * 0.62 : R * 0.42, wd = major ? 0.17 : 0.1; c.fillStyle = k % 4 === 0 ? inkCss : css(style.ink, 0.5); c.beginPath(); c.moveTo(Math.cos(a - wd) * R * 0.14, Math.sin(a - wd) * R * 0.14); c.lineTo(Math.cos(a) * len, Math.sin(a) * len); c.lineTo(Math.cos(a + wd) * R * 0.14, Math.sin(a + wd) * R * 0.14); c.closePath(); c.fill(); }
    c.fillStyle = inkCss; c.font = fnt('display', R * 0.32, '700'); c.textAlign = 'center'; c.fillText('N', 0, -R * 1.34); c.restore();
    const nice = [5, 10, 20, 25, 50, 100, 200, 250, 500]; const target = iw * 0.16 * kmPx; let len = nice[0]; for (const n of nice) if (n <= target) len = n;
    const bw = len / kmPx, sx = R * 0.5, sy = ih - R * 0.9; const bh = Math.max(4, ppc * 0.7);
    c.fillStyle = css(style.paper, 0.6); c.fillRect(sx - 8, sy - bh - base * 1.5, bw + 16 + base * 3, bh * 2 + base * 2.5);
    for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? css(style.paper) : inkCss; c.fillRect(sx + bw / 4 * k, sy - bh, bw / 4, bh); } c.strokeStyle = inkCss; c.lineWidth = 1; c.strokeRect(sx, sy - bh, bw, bh);
    c.fillStyle = inkCss; c.font = fnt('body', base * 0.9); c.textAlign = 'left'; c.fillText('0', sx - 2, sy + base * 0.85); c.textAlign = 'right'; c.fillText(`${len} km`, sx + bw + 4, sy + base * 0.85);
  }
  if (opts.title) {
    const t = opts.title, fs = base * 1.55; c.font = fnt('display', fs, '700'); c.letterSpacing = base * 0.12 + 'px'; const w1 = c.measureText(t.main.toUpperCase()).width; c.letterSpacing = '0px'; c.font = fnt('body', base * 0.95, '', 'italic'); const w2 = t.sub ? c.measureText(t.sub).width : 0; const wd = Math.max(w1, w2) + base * 3; c.font = fnt('display', fs, '700');
    const bx = base * 1.2, by = base * 1.2; c.fillStyle = css(style.paper, 0.85); c.strokeStyle = inkCss; c.lineWidth = 1.5; c.beginPath(); c.rect(bx, by, wd, fs * 2.5 + (t.sub ? base * 1.1 : 0)); c.fill(); c.stroke(); c.lineWidth = 0.7; c.strokeRect(bx + 3, by + 3, wd - 6, fs * 2.5 + (t.sub ? base * 1.1 : 0) - 6);
    c.fillStyle = inkCss; c.textAlign = 'center'; c.letterSpacing = base * 0.12 + 'px'; c.fillText(t.main.toUpperCase(), bx + wd / 2, by + fs * 1.35); c.letterSpacing = '0px'; if (t.sub) { c.font = fnt('body', base * 0.95, '', 'italic'); c.fillText(t.sub, bx + wd / 2, by + fs * 2.15); }
  }
  c.restore();
  if (inset) { // neatline frame
    c.save(); c.strokeStyle = css(style.ink); c.lineWidth = Math.max(1.2, inset * 0.06); c.strokeRect(ix - 0.5, iy - 0.5, iw + 1, ih + 1);
    c.lineWidth = 0.8; c.strokeRect(x + inset * 0.38, y + inset * 0.38, w - inset * 0.76, h - inset * 0.76);
    // graticule ticks
    const step = Math.max(1, Math.round(60 / ppc)); c.lineWidth = 1; c.beginPath(); for (let q = Math.ceil(vx / step) * step; q < vx + vw; q += step) { const px = ix + X(q); c.moveTo(px, iy - inset * 0.28); c.lineTo(px, iy); c.moveTo(px, iy + ih); c.lineTo(px, iy + ih + inset * 0.28); } for (let q = Math.ceil(vy / step) * step; q < vy + vh; q += step) { const py = iy + Y(q); c.moveTo(ix - inset * 0.28, py); c.lineTo(ix, py); c.moveTo(ix + iw, py); c.lineTo(ix + iw + inset * 0.28, py); } c.stroke(); c.restore();
  }
  return { ppc, view: [vx, vy, vw, vh], inner: [ix, iy, iw, ih] };
}

/* ═══ 88-sheet.js ═══ */
/* ───────────────────────── Sheet music: the anthem engraved on a treble staff ───────────────────────── */

const SHARP_STEPS = [38, 35, 39, 36, 33, 37, 34], FLAT_STEPS = [34, 37, 33, 36, 32, 35, 31];

function drawSharp(c, x, y, sp) { c.save(); c.translate(x, y); c.lineCap = 'butt'; c.lineWidth = sp * 0.11; c.beginPath(); c.moveTo(-sp * 0.2, -sp * 1.05); c.lineTo(-sp * 0.2, sp * 1.05); c.moveTo(sp * 0.2, -sp * 1.2); c.lineTo(sp * 0.2, sp * 0.95); c.stroke(); c.lineWidth = sp * 0.3; c.beginPath(); c.moveTo(-sp * 0.42, sp * 0.22); c.lineTo(sp * 0.42, -sp * 0.14); c.moveTo(-sp * 0.42, -sp * 0.4); c.lineTo(sp * 0.42, -sp * 0.76); c.stroke(); c.restore(); }
function drawFlat(c, x, y, sp) { c.save(); c.translate(x, y); c.lineWidth = sp * 0.11; c.beginPath(); c.moveTo(-sp * 0.22, -sp * 1.55); c.lineTo(-sp * 0.22, sp * 0.42); c.stroke(); c.beginPath(); c.moveTo(-sp * 0.22, sp * 0.42); c.bezierCurveTo(sp * 0.5, sp * 0.1, sp * 0.62, -sp * 0.62, -sp * 0.2, -sp * 0.32); c.lineWidth = sp * 0.17; c.stroke(); c.restore(); }

/* Draws the whole anthem (one system per line). Returns the height it used. */
function drawSheet(c, a, x, y, w, opts = {}) {
  const sp = opts.sp || Math.max(8, w / 78), ink = opts.ink || INK, lyricSize = sp * 1.5;
  const nAcc = Math.abs(a.fifths), accSteps = a.fifths > 0 ? SHARP_STEPS.slice(0, nAcc) : FLAT_STEPS.slice(0, nAcc);
  const stepY = (top, step) => top + 4 * sp - (step - 30) * sp / 2;        // E4 sits on the bottom line
  const sysH = sp * 14.8, sysTop = sp * 5.6;
  let cy = y;
  c.save(); c.fillStyle = ink; c.strokeStyle = ink; c.lineCap = 'round';
  a.lines.forEach((L, li) => {
    const top = cy + sysTop, bottom = top + 4 * sp;
    // staff
    c.lineWidth = Math.max(0.8, sp * 0.075); c.beginPath(); for (let k = 0; k < 5; k++) { c.moveTo(x, top + k * sp); c.lineTo(x + w, top + k * sp); } c.stroke();
    c.lineWidth = Math.max(1, sp * 0.14); c.beginPath(); c.moveTo(x, top); c.lineTo(x, bottom); c.stroke();
    // clef, key, time
    c.font = `${sp * 4.5}px ${FONTS.music}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText('\u{1D11E}', x + sp * 0.6, stepY(top, 32) + sp * 1.35);
    let px = x + sp * 3.9;
    accSteps.forEach((st) => { (a.fifths > 0 ? drawSharp : drawFlat)(c, px, stepY(top, st), sp); px += sp * 1.05; });
    if (li === 0) { c.font = `700 ${sp * 2.5}px ${FONTS.display}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(a.meter), px + sp * 0.9, top + sp); c.fillText('4', px + sp * 0.9, top + sp * 3); px += sp * 2.2; }
    px += sp * 0.9;
    // columns: natural width per note from duration and lyric width
    c.font = `${lyricSize}px ${FONTS.body}`;
    const cols = []; L.bars.forEach((bar, bi) => bar.forEach((n, k) => { const sw = c.measureText(n.syl).width + sp * 0.8; cols.push({ n, bi, first: k === 0, last: k === bar.length - 1, nat: Math.max(sw, sp * (1.5 + n.dur * 0.62)) }); }));
    const barPad = sp * 1.25, avail = x + w - px - barPad * 1.3 - sp * 0.6, nat = cols.reduce((s, q) => s + q.nat, 0) + barPad * 1, extra = Math.max(0, avail - nat) / Math.max(1, cols.length);
    let cx = px, xs = []; const barXs = [];
    cols.forEach((q, k) => { if (q.first && q.bi > 0) { barXs.push(cx + barPad * 0.5 - sp * 0.3); cx += barPad; } const wq = q.nat + extra; xs.push(cx + Math.min(wq, sp * 2.2) * 0.35 + sp * 0.5); cx += wq; });
    const endX = x + w - sp * 0.5;
    // barlines
    c.lineWidth = Math.max(1, sp * 0.1); barXs.forEach((bx) => { c.beginPath(); c.moveTo(bx, top); c.lineTo(bx, bottom); c.stroke(); });
    c.beginPath(); c.moveTo(endX, top); c.lineTo(endX, bottom); c.stroke(); if (li === a.lines.length - 1) { c.lineWidth = sp * 0.42; c.beginPath(); c.moveTo(endX + sp * 0.4, top); c.lineTo(endX + sp * 0.4, bottom); c.stroke(); }
    // notes
    const rx = sp * 0.64, ry = sp * 0.46, notes = cols.map((q, k) => ({ ...q.n, x: xs[k], y: stepY(top, q.n.step), first: q.first, bi: q.bi }));
    const up = (n) => n.step < 34;
    // beam groups: consecutive eighths inside a bar, in pairs
    const groups = []; let run = [];
    const flush = () => { for (let k = 0; k + 1 < run.length; k += 2) groups.push([run[k], run[k + 1]]); if (run.length % 2) groups.push([run[run.length - 1]]); run = []; };
    notes.forEach((n, k) => { if (n.dur === 1 && (run.length === 0 || notes[k - 1].bi === n.bi)) run.push(k); else { flush(); if (n.dur === 1) run.push(k); } }); flush();
    const grouped = new Map(); groups.forEach((g2) => g2.forEach((k) => grouped.set(k, g2)));
    const stem = sp * 3.4;
    notes.forEach((n, k) => {
      // ledger lines
      c.lineWidth = Math.max(1, sp * 0.09); if (n.step <= 28) for (let s = 28; s >= n.step; s -= 2) { const ly = stepY(top, s); c.beginPath(); c.moveTo(n.x - rx * 1.7, ly); c.lineTo(n.x + rx * 1.7, ly); c.stroke(); }
      if (n.step >= 40) for (let s = 40; s <= n.step; s += 2) { const ly = stepY(top, s); c.beginPath(); c.moveTo(n.x - rx * 1.7, ly); c.lineTo(n.x + rx * 1.7, ly); c.stroke(); }
      // head
      c.save(); c.translate(n.x, n.y); c.rotate(-0.38); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); if (n.dur >= 4) { c.lineWidth = sp * 0.16; c.stroke(); } else c.fill(); c.restore();
      if (n.dur === 3 || n.dur === 6) { c.beginPath(); c.arc(n.x + rx + sp * 0.5, n.y + (n.step % 2 === 0 ? -sp * 0.5 : 0), sp * 0.15, 0, 7); c.fill(); }
      // stem
      if (n.dur >= 8) return;
      const g2 = grouped.get(k), dirUp = g2 ? (g2.reduce((s, kk) => s + notes[kk].step, 0) / g2.length < 34) : up(n), sx = n.x + (dirUp ? rx * 0.93 : -rx * 0.93);
      let endY = dirUp ? n.y - stem : n.y + stem;
      if (g2 && g2.length === 2) { const ys = g2.map((kk) => (dirUp ? notes[kk].y - stem : notes[kk].y + stem)); endY = dirUp ? Math.min(...ys) : Math.max(...ys); }
      c.lineWidth = Math.max(1, sp * 0.11); c.beginPath(); c.moveTo(sx, n.y + (dirUp ? -sp * 0.1 : sp * 0.1)); c.lineTo(sx, endY); c.stroke();
      if (n.dur === 1) {
        if (g2 && g2.length === 2) { if (g2[0] === k) { const n2 = notes[g2[1]], sx2 = n2.x + (dirUp ? rx * 0.93 : -rx * 0.93), bh = sp * 0.5, dy = dirUp ? bh : -bh; c.beginPath(); c.moveTo(sx, endY); c.lineTo(sx2, endY); c.lineTo(sx2, endY + dy); c.lineTo(sx, endY + dy); c.closePath(); c.fill(); } }
        else { c.beginPath(); c.moveTo(sx, endY); c.bezierCurveTo(sx + sp * 0.2, endY + (dirUp ? sp * 1.0 : -sp * 1.0), sx + sp * 1.2, endY + (dirUp ? sp * 1.2 : -sp * 1.2), sx + sp * 0.8, endY + (dirUp ? sp * 2.4 : -sp * 2.4)); c.lineWidth = sp * 0.28; c.stroke(); }
      }
    });
    // lyrics
    c.font = `${lyricSize}px ${FONTS.body}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = ink;
    notes.forEach((n) => c.fillText(n.syl, n.x + (n.syl.endsWith('-') ? sp * 0.25 : 0), bottom + sp * 4.3));
    cy += sysH;
  });
  c.restore();
  return cy - y;
}

/* ═══ 90-poster.js ═══ */
/* ───────────────────────── Poster: the whole country on one printable sheet (A-series proportions) ───────────────────────── */

function wrapLines(c, text, maxW, maxLines) {
  const words = String(text).split(/\s+/), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  if (maxLines && lines.length > maxLines) { const keep = lines.slice(0, maxLines); let last = keep[maxLines - 1]; while (last.length > 1 && c.measureText(last + '…').width > maxW) last = last.slice(0, -1); keep[maxLines - 1] = last.replace(/[ ,;.]+$/, '') + '…'; return keep; }
  return lines;
}
function fitSize(c, text, font, maxW, size, minSize, spacing = 0) { let s = size; for (;;) { c.font = font(s); c.letterSpacing = spacing ? spacing * s + 'px' : '0px'; if (c.measureText(text).width <= maxW || s <= minSize) break; s *= 0.96; } return s; }
function rule(c, x, y, w, u, col) { c.strokeStyle = col; c.lineWidth = Math.max(1, u * 0.1); c.beginPath(); c.moveTo(x + u * 1.1, y); c.lineTo(x + w, y); c.stroke(); c.fillStyle = col; c.beginPath(); c.moveTo(x, y); c.lineTo(x + u * 0.55, y - u * 0.35); c.lineTo(x + u * 1.1, y); c.lineTo(x + u * 0.55, y + u * 0.35); c.closePath(); c.fill(); }
function heading(c, text, x, y, w, u, col) { c.font = `700 ${u * 1.45}px ${FONTS.display}`; c.letterSpacing = u * 0.2 + 'px'; c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(text.toUpperCase(), x, y); c.letterSpacing = '0px'; rule(c, x, y + u * 0.75, w, u, col); return y + u * 2.4; }
function corner(c, x, y, s, sx, sy, col) { c.save(); c.translate(x, y); c.scale(sx, sy); c.strokeStyle = col; c.lineWidth = s * 0.07; c.beginPath(); c.moveTo(0, s); c.lineTo(0, s * 0.35); c.quadraticCurveTo(0, 0, s * 0.35, 0); c.lineTo(s, 0); c.stroke(); c.beginPath(); c.arc(s * 0.2, s * 0.2, s * 0.09, 0, 7); c.fillStyle = col; c.fill(); c.beginPath(); c.moveTo(s * 0.12, s * 0.6); c.quadraticCurveTo(s * 0.12, s * 0.12, s * 0.6, s * 0.12); c.lineWidth = s * 0.035; c.stroke(); c.restore(); }

function pickHistory(h) {
  const prio = ['origin', 'founding', 'unification', 'war', 'plague', 'flood', 'civil', 'reform', 'golden', 'present'];
  const by = {}; h.events.forEach((e) => { (by[e.kind] = by[e.kind] || []).push(e); });
  const chosen = []; for (const k of ['founding', 'unification', 'war', 'flood', 'plague', 'civil', 'golden', 'reform', 'present']) if (by[k]) chosen.push(by[k][0]);
  return chosen.sort((a, b) => a.year - b.year).slice(0, 7);
}

function drawPoster(c, C, W, H, opts = {}) {
  const u = W / 100, g = C.geo, st = C.state, her = C.heraldry, A = C.anthem, Hh = C.history;
  const paper = opts.paper || '#efe4c8', ink = '#3a2817', accent = '#7a2f23', soft = 'rgba(58,40,23,.62)';
  // paper
  c.save(); c.fillStyle = paper; c.fillRect(0, 0, W, H);
  const rn = sub(C.seed, 'poster');
  for (let i = 0; i < 70; i++) { const x = rn.next() * W, y = rn.next() * H, r = (6 + rn.next() * 22) * u, gr = c.createRadialGradient(x, y, 0, x, y, r); const light = rn.chance(0.5); gr.addColorStop(0, light ? 'rgba(255,250,235,.16)' : 'rgba(150,110,60,.07)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); }
  const vg = c.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.78); vg.addColorStop(0, 'rgba(120,80,30,0)'); vg.addColorStop(1, 'rgba(120,80,30,.26)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
  // frame
  c.strokeStyle = ink; c.lineWidth = u * 0.28; c.strokeRect(u * 1.6, u * 1.6, W - u * 3.2, H - u * 3.2); c.lineWidth = u * 0.1; c.strokeRect(u * 2.3, u * 2.3, W - u * 4.6, H - u * 4.6);
  const cs = u * 5.5; corner(c, u * 2.3, u * 2.3, cs, 1, 1, ink); corner(c, W - u * 2.3, u * 2.3, cs, -1, 1, ink); corner(c, u * 2.3, H - u * 2.3, cs, 1, -1, ink); corner(c, W - u * 2.3, H - u * 2.3, cs, -1, -1, ink);

  /* header: arms · title · flag */
  const hx = 5 * u, hw = 90 * u;
  drawArms(c, her.arms, hx + 8.5 * u, 12.6 * u, 10.5 * u);
  const fr = her.flag.ratio, fw = 20 * u, fh = fw * fr[1] / fr[0];
  drawFlag(c, her.flag, W - 5 * u - fw, 8 * u + (14 * u - fh) / 2, fw, fh, { sheen: true });
  const tx = W / 2, tw = 43 * u;
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = soft;
  c.font = `600 ${u * 1.55}px ${FONTS.display}`; c.letterSpacing = u * 0.5 + 'px'; c.fillText(`THE ${st.government.toUpperCase()} OF`, tx, 7.7 * u); c.letterSpacing = '0px';
  const ns = fitSize(c, g.name.toUpperCase(), (s) => `700 ${s}px ${FONTS.display}`, tw, u * 9.4, u * 5, 0.06);
  c.fillStyle = ink; c.font = `700 ${ns}px ${FONTS.display}`; c.letterSpacing = ns * 0.06 + 'px'; c.fillText(g.name.toUpperCase(), tx, 7.7 * u + ns * 1.02); c.letterSpacing = '0px';
  const my = 7.7 * u + ns * 1.02 + u * 2.6;
  c.fillStyle = accent; c.font = `italic ${u * 1.9}px ${FONTS.body}`; c.fillText(`“${st.motto.text}”`, tx, my);
  c.fillStyle = soft; c.font = `${u * 1.35}px ${FONTS.body}`; c.fillText(`${st.motto.en} · capital ${g.cities[0].name} · ${st.rulerFull}`, tx, my + u * 1.9);

  /* map */
  const mx = 4.5 * u, my0 = 22.2 * u, mw = 91 * u, mh = 45.5 * u;
  drawMap(c, C, mx, my0, mw, mh, { style: opts.style || 'parchment', margin: 0.07 });

  /* columns */
  const col = (i) => [5 * u, 38.2 * u, 69.4 * u][i], gap = 2 * u;
  let y0 = 71.6 * u;
  // fact sheet
  { let x = col(0), w = 31 * u, y = heading(c, 'Fact sheet', x, y0, w, u, accent);
    const rows = st.facts.filter(([k]) => k !== 'Climate' && k !== 'Divisions'), rh = 1.95 * u;
    rows.forEach(([k, v], i) => { if (i % 2 === 0) { c.fillStyle = 'rgba(120,80,40,.08)'; c.fillRect(x - u * 0.3, y - rh * 0.72, w + u * 0.6, rh); }
      c.fillStyle = soft; c.font = `600 ${u * 0.98}px ${FONTS.display}`; c.letterSpacing = u * 0.08 + 'px'; c.textAlign = 'left'; c.fillText(k.toUpperCase(), x, y); c.letterSpacing = '0px';
      const vw = w - 11.5 * u, size = fitSize(c, v, (s) => `${s}px ${FONTS.body}`, vw, u * 1.45, u * 0.95); c.font = `${size}px ${FONTS.body}`; c.fillStyle = ink; c.textAlign = 'right'; c.fillText(v.length > 60 ? v.slice(0, 58) + '…' : v, x + w, y); c.textAlign = 'left'; y += rh; }); }
  // gazetteer
  { let x = col(1), w = 29.4 * u, y = heading(c, 'Gazetteer', x, y0, w, u, accent);
    const cities = g.cities.slice().sort((a, b) => b.pop - a.pop).slice(0, 8);
    c.textAlign = 'left'; cities.forEach((ct) => { c.fillStyle = ct.capital ? accent : ink; c.font = `${ct.capital ? '700 ' : '600 '}${u * 1.5}px ${FONTS.body}`; c.fillText(ct.name, x, y); const nw = c.measureText(ct.name).width; c.fillStyle = soft; c.font = `italic ${u * 1.25}px ${FONTS.body}`; c.fillText(` “${ct.en}”`, x + nw, y); c.textAlign = 'right'; c.font = `${u * 1.25}px ${FONTS.body}`; c.fillText(ct.pop >= 100000 ? Math.round(ct.pop / 1000) + 'k' : (ct.pop / 1000).toFixed(1) + 'k', x + w, y); c.textAlign = 'left'; y += u * 1.95; });
    y += u * 0.6; c.fillStyle = accent; c.font = `700 ${u * 1.0}px ${FONTS.display}`; c.letterSpacing = u * 0.12 + 'px'; c.fillText(st.regionPlural.toUpperCase(), x, y); c.letterSpacing = '0px'; y += u * 1.6;
    c.font = `${u * 1.25}px ${FONTS.body}`; c.fillStyle = ink; const half = w / 2; g.regions.forEach((r, i) => { const px = x + (i % 2) * half, py = y + Math.floor(i / 2) * u * 1.7; c.fillStyle = ink; c.font = `600 ${u * 1.25}px ${FONTS.body}`; c.fillText(r.name, px, py); const nw = c.measureText(r.name).width; c.fillStyle = soft; c.font = `italic ${u * 1.05}px ${FONTS.body}`; c.fillText(` ${r.en}`, px + nw, py); }); }
  // heraldry & symbolism
  { let x = col(2), w = 25.6 * u, y = heading(c, 'Symbols', x, y0, w, u, accent);
    c.fillStyle = ink; c.font = `${u * 1.3}px ${FONTS.body}`; c.textAlign = 'left';
    const lines = []; her.meaning.forEach((m) => lines.push(...wrapLines(c, m, w, 3), ''));
    lines.slice(0, 15).forEach((ln) => { if (ln) c.fillText(ln, x, y); y += ln ? u * 1.62 : u * 0.45; });
    y += u * 0.2; c.fillStyle = soft; c.font = `italic ${u * 1.2}px ${FONTS.body}`; wrapLines(c, `Climate: ${st.climate}. Chief exports: ${st.exports.join(', ')}.`, w, 3).forEach((ln) => { c.fillText(ln, x, y); y += u * 1.5; }); }

  /* chronicle + anthem */
  const y1 = 101.9 * u, limit = H - 7.6 * u;
  { let x = 5 * u, w = 34.5 * u, y = heading(c, 'Chronicle', x, y1, w, u, accent); const ev = pickHistory(Hh).slice(0, 5);
    ev.forEach((e) => { c.textAlign = 'left'; c.fillStyle = accent; c.font = `700 ${u * 1.2}px ${FONTS.display}`; c.fillText(`${e.year}`, x, y); c.fillStyle = ink; c.font = `700 ${u * 1.3}px ${FONTS.body}`; c.fillText(e.title, x + u * 4.4, y);
      c.fillStyle = soft; c.font = `${u * 1.1}px ${FONTS.body}`; const ls = wrapLines(c, e.text, w - u * 4.4, 2); ls.forEach((ln, k) => c.fillText(ln, x + u * 4.4, y + u * 1.4 * (k + 1))); y += u * (1.9 + 1.4 * ls.length); });
    c.fillStyle = soft; c.font = `italic ${u * 1.0}px ${FONTS.body}`; c.fillText(`Years are counted from ${Hh.eraName} (${Hh.era})`, x, Math.min(y + u * 0.4, limit)); }
  { let x = 42.2 * u, w = 52.8 * u, y = heading(c, 'National anthem', x, y1, w, u, accent);
    c.textAlign = 'left'; c.fillStyle = ink; c.font = `700 ${u * 1.5}px ${FONTS.body}`; c.fillText(`“${A.title.text}”`, x, y); const tw2 = c.measureText(`“${A.title.text}”`).width; c.fillStyle = soft; c.font = `italic ${u * 1.25}px ${FONTS.body}`; c.fillText(` — ${A.title.en} · ${A.tonic} ${A.mode} · ${A.meter}/4 · ${A.tempo} bpm · music by ${A.composer}`, x + tw2, y);
    const startY = y + u * 0.2, trH = u * 3.6, sp = Math.min(w / 62, (limit - startY - trH) / (4 * 14.8)), hUsed = drawSheet(c, A, x, startY, w, { sp });
    c.fillStyle = soft; c.font = `italic ${u * 1.1}px ${FONTS.body}`; const tr = A.lines.map((l) => l.en).join(' / '); wrapLines(c, 'Translation: ' + tr, w, 2).forEach((ln, k) => c.fillText(ln, x, startY + hUsed + u * (1.1 + k * 1.4))); }

  // footer
  c.textAlign = 'center'; c.fillStyle = soft; c.font = `${u * 1.0}px ${FONTS.body}`; c.letterSpacing = u * 0.12 + 'px';
  c.fillText(`SEED “${C.seed}”  ·  WORLDSCAPE v${C.version}  ·  EVERY DETAIL IS GENERATED FROM THIS ONE WORD`, W / 2, H - 4.2 * u); c.letterSpacing = '0px';
  c.restore();
}

/* ═══ 99-exports.js ═══ */
return { VERSION, TONGUES, makeRng, sub, makeLanguage, generateGeography, generateCountry, countrySummary, randomSeed, anthemSchedule, anthemMidi, CONCEPT_EN, TINCT, TINCT_EN, CHARGES, BIOME, stepMidi, noteLabel, syllabify, drawMap, drawSheet, drawPoster, MAP_STYLES, drawFlag, drawArms, drawCharge, setFonts, FONTS, CHG, _dev: { buildTerrain, claimTerritory, drainage, classifyBiomes, distanceFields, GW, GH, GN, BIOME } };

});
