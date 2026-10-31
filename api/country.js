'use strict';
const { cors, json, IMMUTABLE } = require('./_util');
const { readSeed, links, Worldscape } = require('../lib/render');

/** GET /api/country?seed=…: the whole country as JSON (names, facts, history, anthem lyrics, flag and arms specs). */
module.exports = (req, res) => {
  if (cors(req, res)) return;
  try {
    const q = {}; for (const k of Object.keys(req.query || {})) q[k] = Array.isArray(req.query[k]) ? req.query[k][0] : req.query[k];
    const { seed, deterministic } = readSeed(q);
    const summary = Worldscape.countrySummary(Worldscape.generateCountry(seed));
    summary.links = links(seed);
    const body = q.pretty !== undefined && q.pretty !== '0' ? JSON.stringify(summary, null, 2) : JSON.stringify(summary);
    res.statusCode = 200; res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', deterministic ? IMMUTABLE : 'no-store'); res.setHeader('X-Worldscape-Seed', encodeURIComponent(seed));
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (err) { json(res, 400, { error: err.message }); }
};
