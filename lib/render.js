'use strict';
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const Worldscape = require('../public/engine.js');

/* Fonts are registered once per process. Family names match the CSS @font-face rules used by the web app. */
const FONT_DIR = path.join(__dirname, '..', 'public', 'fonts');
let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  const reg = (file, family) => GlobalFonts.registerFromPath(path.join(FONT_DIR, file), family);
  reg('cinzel-latin-wght-normal.woff2', 'Cinzel');
  reg('eb-garamond-latin-wght-normal.woff2', 'EB Garamond');
  reg('eb-garamond-latin-wght-italic.woff2', 'EB Garamond');
  reg('inter-latin-wght-normal.woff2', 'Inter');
  reg('noto-music-music.woff2', 'Noto Music');
  reg('jetbrains-mono-latin-wght-normal.woff2', 'JetBrains Mono');
  fontsReady = true;
}

/** Hard limits that keep a serverless render quick and the response under Vercel's 4.5 MB cap. */
const LIMITS = {
  seedMax: 200,
  poster: { min: 480, max: 2480, def: 1240 },
  map: { min: 320, max: 3200, def: 1600 },
  flag: { min: 64, max: 2000, def: 900 },
  arms: { min: 64, max: 2000, def: 800 },
  sheet: { min: 600, max: 2400, def: 1600 },
  mapPixels: 7_000_000,
};
const STYLES = ['parchment', 'atlas', 'night'];
const FORMATS = {
  png: { mime: 'image/png', encode: (c) => c.encode('png') },
  jpeg: { mime: 'image/jpeg', encode: (c, q) => c.encode('jpeg', q) },
  webp: { mime: 'image/webp', encode: (c, q) => c.encode('webp', q) },
};
const KINDS = ['poster', 'map', 'flag', 'arms', 'sheet'];
const first = (v) => (Array.isArray(v) ? v[0] : v);

function cleanQuery(query) { const q = {}; for (const k of Object.keys(query || {})) q[k] = first(query[k]); return q; }

/** Reads the seed. Returns { seed, deterministic }. A missing seed means “surprise me”. */
function readSeed(q) {
  const raw = q.seed === undefined ? '' : String(q.seed).trim();
  if (raw.length > LIMITS.seedMax) throw new Error(`"seed" can be at most ${LIMITS.seedMax} characters`);
  if (!raw) return { seed: Worldscape.randomSeed(), deterministic: false };
  return { seed: raw, deterministic: true };
}
function readInt(q, name, { min, max, def }) {
  if (q[name] === undefined || q[name] === '') return def;
  const n = Number(q[name]);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`"${name}" must be an integer between ${min} and ${max}`);
  return n;
}
function readFormat(q, def) {
  const f = String(q.format || def).toLowerCase().replace('jpg', 'jpeg');
  if (!FORMATS[f]) throw new Error(`"format" must be one of: ${Object.keys(FORMATS).join(', ')}`);
  return f;
}
function readQuality(q) {
  if (q.quality === undefined || q.quality === '') return 90;
  const n = Number(q.quality);
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('"quality" must be an integer between 1 and 100');
  return n;
}

/** Turns query parameters into an encoded image. Throws an Error with a user-safe message on bad input. */
async function renderImage(kind, query) {
  if (!KINDS.includes(kind)) throw new Error(`unknown image kind "${kind}"`);
  ensureFonts();
  const q = cleanQuery(query), { seed, deterministic } = readSeed(q);
  const format = readFormat(q, kind === 'poster' || kind === 'map' ? 'jpeg' : 'png'), quality = readQuality(q);
  const country = Worldscape.generateCountry(seed);
  let canvas, ctx, w, h;
  if (kind === 'poster') {
    w = readInt(q, 'width', LIMITS.poster); h = Math.round(w * 1.4142);
    const style = q.style === undefined || q.style === '' ? 'parchment' : String(q.style);
    if (!STYLES.includes(style)) throw new Error(`"style" must be one of: ${STYLES.join(', ')}`);
    canvas = createCanvas(w, h); ctx = canvas.getContext('2d'); Worldscape.drawPoster(ctx, country, w, h, { style });
  } else if (kind === 'map') {
    let size = q.size && !q.width && !q.height ? /^(\d+)x(\d+)$/i.exec(String(q.size)) : null;
    if (q.size && !size && !q.width && !q.height) throw new Error('"size" must look like 1600x1000');
    w = size ? +size[1] : readInt(q, 'width', LIMITS.map); h = size ? +size[2] : readInt(q, 'height', { ...LIMITS.map, def: Math.round(w * 0.66) });
    if (w < LIMITS.map.min || h < LIMITS.map.min || w > LIMITS.map.max || h > LIMITS.map.max) throw new Error(`width and height must be between ${LIMITS.map.min} and ${LIMITS.map.max}`);
    if (w * h > LIMITS.mapPixels) throw new Error(`a map can have at most ${(LIMITS.mapPixels / 1e6).toFixed(0)} megapixels`);
    const style = q.style === undefined || q.style === '' ? 'parchment' : String(q.style);
    if (!STYLES.includes(style)) throw new Error(`"style" must be one of: ${STYLES.join(', ')}`);
    const flags = (name, def) => (q[name] === undefined ? def : !['0', 'false', 'no', 'off'].includes(String(q[name]).toLowerCase()));
    canvas = createCanvas(w, h); ctx = canvas.getContext('2d');
    Worldscape.drawMap(ctx, country, 0, 0, w, h, { style, labels: flags('labels', true), roads: flags('roads', true), borders: flags('borders', true), title: flags('title', true) ? { main: country.geo.name, sub: `a ${country.state.governmentAdj}` } : undefined });
  } else if (kind === 'flag') {
    w = readInt(q, 'width', LIMITS.flag); const r = country.heraldry.flag.ratio; h = Math.round(w * r[1] / r[0]);
    canvas = createCanvas(w, h); ctx = canvas.getContext('2d'); Worldscape.drawFlag(ctx, country.heraldry.flag, 0, 0, w, h, { border: false });
  } else if (kind === 'arms') {
    w = readInt(q, 'width', LIMITS.arms); h = Math.round(w * 1.18);
    canvas = createCanvas(w, h); ctx = canvas.getContext('2d'); Worldscape.drawArms(ctx, country.heraldry.arms, w / 2, h * 0.56, w * 0.62);
  } else {
    w = readInt(q, 'width', LIMITS.sheet); const sp = w / 74, sysH = sp * 14.8; h = Math.round(sysH * 4 + sp * 9);
    canvas = createCanvas(w, h); ctx = canvas.getContext('2d');
    if (q.background !== '0') { ctx.fillStyle = '#f3ead2'; ctx.fillRect(0, 0, w, h); }
    ctx.fillStyle = '#2a1d10'; ctx.font = `700 ${sp * 2.4}px ${Worldscape.FONTS.display}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(country.anthem.title.text, sp * 2, sp * 3.4);
    ctx.font = `italic ${sp * 1.5}px ${Worldscape.FONTS.body}`; ctx.fillStyle = 'rgba(42,29,16,.7)'; ctx.fillText(`${country.anthem.title.en} · ${country.anthem.tonic} ${country.anthem.mode} · ${country.anthem.meter}/4 · ${country.anthem.tempo} bpm`, sp * 2, sp * 5.4);
    Worldscape.drawSheet(ctx, country.anthem, sp * 2, sp * 2.2, w - sp * 4, { sp });
  }
  const buffer = await FORMATS[format].encode(canvas, quality);
  return { buffer, mime: FORMATS[format].mime, seed, deterministic, format, width: w, height: h, country };
}

/** Everything a client needs to know about the API; docs and tests read from here so they cannot drift. */
function describe() { return { limits: LIMITS, styles: STYLES, formats: Object.keys(FORMATS), kinds: KINDS, countryTypes: ['continental', 'peninsula', 'island', 'archipelago'], tongues: Worldscape.TONGUES.map((t) => ({ id: t.id, feel: t.feel })), version: Worldscape.VERSION }; }

function links(seed, base = '') {
  const s = encodeURIComponent(seed);
  return { app: `${base}/app?seed=${s}`, country: `${base}/api/country?seed=${s}`, poster: `${base}/api/poster?seed=${s}`, map: `${base}/api/map?seed=${s}`, flag: `${base}/api/flag?seed=${s}`, arms: `${base}/api/arms?seed=${s}`, anthemMidi: `${base}/api/anthem?seed=${s}`, anthemSheet: `${base}/api/anthem?seed=${s}&format=png` };
}

module.exports = { renderImage, describe, links, ensureFonts, readSeed, LIMITS, STYLES, FORMATS, Worldscape };
