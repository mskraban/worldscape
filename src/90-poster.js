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
