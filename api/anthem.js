'use strict';
const { cors, json, IMMUTABLE, safeName, imageHandler } = require('./_util');
const { readSeed, Worldscape } = require('../lib/render');
const sheet = imageHandler('sheet');

/** GET /api/anthem?seed=…: the anthem as a Standard MIDI file (default), as sheet music (format=png|jpeg|webp) or as JSON. */
module.exports = async (req, res) => {
  const f = String((Array.isArray(req.query.format) ? req.query.format[0] : req.query.format) || 'mid').toLowerCase();
  if (['png', 'jpeg', 'jpg', 'webp'].includes(f)) return sheet(req, res);
  if (cors(req, res)) return;
  try {
    const q = {}; for (const k of Object.keys(req.query || {})) q[k] = Array.isArray(req.query[k]) ? req.query[k][0] : req.query[k];
    const { seed, deterministic } = readSeed(q), c = Worldscape.generateCountry(seed);
    res.setHeader('Cache-Control', deterministic ? IMMUTABLE : 'no-store'); res.setHeader('X-Worldscape-Seed', encodeURIComponent(seed));
    if (f === 'json') { res.statusCode = 200; res.setHeader('Content-Type', 'application/json; charset=utf-8'); return res.end(JSON.stringify(Worldscape.countrySummary(c).anthem)); }
    if (f !== 'mid' && f !== 'midi') return json(res, 400, { error: '"format" must be one of: mid, png, jpeg, webp, json' });
    const buf = Buffer.from(Worldscape.anthemMidi(c.anthem));
    res.statusCode = 200; res.setHeader('Content-Type', 'audio/midi'); res.setHeader('Content-Length', buf.length);
    res.setHeader('Content-Disposition', `${req.query.download !== undefined && req.query.download !== '0' ? 'attachment' : 'inline'}; filename="worldscape-${safeName(seed)}-anthem.mid"`);
    res.end(req.method === 'HEAD' ? undefined : buf);
  } catch (err) { json(res, 400, { error: err.message }); }
};
