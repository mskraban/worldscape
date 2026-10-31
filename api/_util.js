'use strict';
/** Vercel functions cap response bodies at 4.5 MB; stay safely below it. */
const MAX_BODY = 4.4 * 1024 * 1024;

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return true; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.setHeader('Allow', 'GET, HEAD, OPTIONS'); res.end('Method Not Allowed'); return true; }
  return false;
}
function json(res, status, body, cache) {
  res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(JSON.stringify(body));
}
const IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable';
const safeName = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'seed';

/** Shared handler body for the image endpoints. */
function imageHandler(kind) {
  const { renderImage } = require('../lib/render');
  return async (req, res) => {
    if (cors(req, res)) return;
    try {
      const out = await renderImage(kind, req.query);
      if (out.buffer.length > MAX_BODY) return json(res, 413, { error: `Rendered image is ${(out.buffer.length / 1e6).toFixed(1)} MB, above the ${(MAX_BODY / 1e6).toFixed(1)} MB response limit`, hint: 'Use format=jpeg or format=webp, or request a smaller width.' });
      res.statusCode = 200; res.setHeader('Content-Type', out.mime);
      res.setHeader('X-Worldscape-Seed', encodeURIComponent(out.seed)); res.setHeader('X-Worldscape-Engine', String(require('../lib/render').Worldscape.VERSION));
      res.setHeader('Cache-Control', out.deterministic ? IMMUTABLE : 'no-store');
      if (req.query.download !== undefined && req.query.download !== '0') res.setHeader('Content-Disposition', `attachment; filename="worldscape-${safeName(out.seed)}-${kind}.${out.format === 'jpeg' ? 'jpg' : out.format}"`);
      res.setHeader('Content-Length', out.buffer.length);
      return res.end(req.method === 'HEAD' ? undefined : out.buffer);
    } catch (err) {
      return json(res, 400, { error: err.message, hint: 'GET /api/describe lists every valid option.' });
    }
  };
}
module.exports = { cors, json, imageHandler, IMMUTABLE, MAX_BODY, safeName };
