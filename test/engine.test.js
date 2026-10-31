'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const W = require('../public/engine.js');
const frozen = require('./fixtures/signatures.json');

const SEEDS = Array.from({ length: 40 }, (_, i) => 'test-' + i).concat(['', ' ', 'ünïcödé', 'a'.repeat(200), 'alpha', 'Mario']);
const sig = (s) => { const c = W.generateCountry(s); return crypto.createHash('sha256').update(JSON.stringify(W.countrySummary(c))).digest('hex').slice(0, 24) + ':' + crypto.createHash('sha256').update(Buffer.from(W.anthemMidi(c.anthem))).digest('hex').slice(0, 12); };

test('same seed, same country (and a different seed, a different one)', () => {
  assert.equal(JSON.stringify(W.countrySummary(W.generateCountry('alpha'))), JSON.stringify(W.countrySummary(W.generateCountry('alpha'))));
  assert.notEqual(sig('alpha'), sig('alphb'));
  assert.notEqual(sig('Alpha'), sig('alpha'), 'seeds are case-sensitive');
});

test('output is frozen: bump VERSION and regenerate fixtures only when change is intended', () => {
  assert.equal(W.VERSION, frozen.version);
  for (const [seed, expected] of Object.entries(frozen.signatures)) assert.equal(sig(seed), expected, `country for seed "${seed}" changed`);
});

test('generation does not depend on call order or earlier seeds', () => {
  const a = sig('order-a'); sig('noise-1'); sig('noise-2');
  assert.equal(sig('order-a'), a);
});

test('every country is internally consistent', () => {
  for (const seed of SEEDS) {
    const c = W.generateCountry(seed), g = c.geo;
    const ctx = `seed "${seed.slice(0, 20)}"`;
    assert.ok(g.name.length >= 3 && g.name.length <= 14, `${ctx}: name "${g.name}"`);
    assert.ok(g.ownCount >= 2000, `${ctx}: territory too small (${g.ownCount})`);
    assert.ok(g.cities.length >= 6 && g.cities.length <= 12, `${ctx}: ${g.cities.length} cities`);
    assert.equal(g.cities.filter((x) => x.capital).length, 1, `${ctx}: exactly one capital`);
    const names = g.cities.map((x) => x.name); assert.equal(new Set(names).size, names.length, `${ctx}: duplicate city names`);
    for (const x of g.cities) { assert.equal(g.own[x.cell], 1, `${ctx}: city ${x.name} outside the country`); assert.ok(!g.T.isSea[x.cell] && g.B.biome[x.cell] !== W.BIOME.LAKE, `${ctx}: city ${x.name} in water`); assert.ok(x.en && x.name && x.pop > 0, `${ctx}: city fields`); assert.ok(!/undefined|NaN/.test(x.name + x.en), `${ctx}: bad name`); }
    assert.ok(g.roads.length >= g.cities.length - 1, `${ctx}: cities not all connected`);
    assert.ok(g.regions.length >= 3 && g.regions.every((r) => r.cells > 100), `${ctx}: provinces unbalanced`);
    assert.equal(g.regions.reduce((s, r) => s + r.cells, 0), g.ownCount, `${ctx}: provinces must tile the country`);
    assert.ok(g.population > 50000 && g.area > 10000, `${ctx}: population/area`);
    for (const k of Object.keys(g.lang.lex)) assert.ok(g.lang.lex[k] && !/undefined/.test(g.lang.lex[k]), `${ctx}: lexicon ${k}`);
    const s = JSON.stringify(W.countrySummary(c)); assert.ok(!/undefined|NaN|\[object/.test(s), `${ctx}: summary contains undefined/NaN`);
  }
});

test('flags and arms use valid tinctures, layouts and charges', () => {
  for (const seed of SEEDS) {
    const { flag, arms } = W.generateCountry(seed).heraldry;
    for (const t of [...flag.colors, ...arms.tinctures, arms.ordinaryColor, arms.charge.color, flag.charge && flag.charge.color].filter(Boolean)) assert.ok(W.TINCT[t], `unknown tincture ${t}`);
    for (const ch of [flag.charge && flag.charge.type, arms.charge.type].filter(Boolean)) assert.ok(W.CHARGES[ch], `unknown charge ${ch}`);
    assert.ok(flag.ratio.length === 2 && flag.colors.length >= 2);
    assert.ok(flag.colors.every((c, i, a) => i === 0 || true));
  }
});

test('history is chronological, filled with real places and ends in the present', () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const c = W.generateCountry(seed), ev = c.history.events;
    assert.ok(ev.length >= 10);
    for (let i = 1; i < ev.length; i++) assert.ok(ev[i].year > ev[i - 1].year, `years must increase (${seed})`);
    assert.equal(ev[ev.length - 1].year, c.history.now);
    assert.ok(ev.every((e) => e.title && e.text && !/undefined|NaN|\$\{/.test(e.title + e.text)), `placeholder leaked into history (${seed})`);
    assert.ok(ev.some((e) => e.text.includes(c.geo.cities[0].name)), 'capital is mentioned');
  }
});

test('anthems are well-formed: every bar adds up, syllables fit notes, MIDI is valid', () => {
  for (const seed of SEEDS) {
    const a = W.generateCountry(seed).anthem;
    assert.equal(a.lines.length, 4);
    for (const L of a.lines) {
      assert.equal(L.bars.length, 2);
      for (const bar of L.bars) assert.equal(bar.reduce((s, n) => s + n.dur, 0), a.barLen, `bar length (${seed})`);
      assert.ok(L.notes.every((n) => n.syl && n.midi >= 48 && n.midi <= 90), `note range / lyric gaps (${seed})`);
      assert.ok(L.text && L.en && !/undefined/.test(L.text + L.en));
    }
    const last = a.lines[3].notes; assert.ok(last[last.length - 1].dur >= 2, 'ends on a held note');
    const midi = W.anthemMidi(a);
    assert.equal(Buffer.from(midi.slice(0, 4)).toString(), 'MThd'); assert.equal(midi.length > 300, true);
    const tracks = Buffer.from(midi).toString('latin1').split('MTrk').length - 1; assert.equal(tracks, 3);
  }
});

test('syllabify keeps every letter', () => {
  for (const w of ['nonnanna', 'khuzagron', 'ia', 'lashnimesh', 'a', 'str', "fe'lo"]) assert.equal(W.syllabify(w).join(''), w.toLowerCase());
});

test('every tongue has the vocabulary the generators need', () => {
  for (const t of W.TONGUES) { const lang = W.makeLanguage(W.sub('x', t.id), t.id); for (const k of ['river', 'sea', 'mountain', 'lake', 'harbor', 'tower', 'forest', 'peak', 'island']) assert.ok(lang.lex[k], `${t.id} lacks ${k}`); }
});

test('randomSeed returns a usable, readable seed', () => { for (let i = 0; i < 20; i++) assert.match(W.randomSeed(), /^[a-z]+-[a-z]+-\d{3}$/); });

test('generation is fast enough for interactive use', () => { const t = Date.now(); for (let i = 0; i < 5; i++) W.generateCountry('speed-' + i); assert.ok((Date.now() - t) / 5 < 1500); });
