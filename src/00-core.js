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
