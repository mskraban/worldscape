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
