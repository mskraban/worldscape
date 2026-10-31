'use strict';
// Concatenates src/*.js into public/engine.js (one UMD file for browser and Node). Run: npm run build
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'src');
const files = fs.readdirSync(dir).filter((f) => /^\d+-.*\.js$/.test(f)).sort();
const body = files.map((f) => `/* ═══ ${f} ═══ */\n${fs.readFileSync(path.join(dir, f), 'utf8')}`).join('\n');
const out = `/*!
 * Worldscape engine: deterministic imaginary countries. One file, browser and Node (with @napi-rs/canvas).
 * Same seed => same country. MIT License. Generated from src/*.js by scripts/build-engine.js. Do not edit by hand.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Worldscape = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
${body}
});
`;
const target = process.env.ENGINE_OUT || path.join(__dirname, '..', 'public', 'engine.js');
fs.writeFileSync(target, out);
console.log(`built ${path.relative(process.cwd(), target)} from ${files.length} modules (${(out.length / 1024).toFixed(0)} KB)`);
