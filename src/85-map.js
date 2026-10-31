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
