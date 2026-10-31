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
