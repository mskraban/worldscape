'use strict';
// Regenerates test/fixtures/signatures.json. Only run this when you INTEND to change generated output
// (and bump VERSION in src/00-core.js): it re-freezes what every seed produces.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const W = require('../public/engine.js');
const SEEDS = ['alpha', 'saffron', 'Mario', 'harbor', 'glacier', 'mistral', 'x1', '7'];
const out = { version: W.VERSION, signatures: {} };
for (const s of SEEDS) out.signatures[s] = crypto.createHash('sha256').update(JSON.stringify(W.countrySummary(W.generateCountry(s)))).digest('hex').slice(0, 24) + ':' + crypto.createHash('sha256').update(Buffer.from(W.anthemMidi(W.generateCountry(s).anthem))).digest('hex').slice(0, 12);
fs.writeFileSync(path.join(__dirname, '..', 'test', 'fixtures', 'signatures.json'), JSON.stringify(out, null, 2) + '\n');
console.log('wrote', Object.keys(out.signatures).length, 'signatures');
