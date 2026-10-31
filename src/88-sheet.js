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
