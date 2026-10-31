'use strict';
// Tiny local server that mimics the Vercel routes: `npm run dev` → http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const handlers = {};
for (const f of fs.readdirSync(path.join(__dirname, '..', 'api'))) if (f.endsWith('.js') && !f.startsWith('_')) handlers['/api/' + f.slice(0, -3)] = require('../api/' + f);
const rewrites = [[/^\/c\/(.+)$/, '/api/country'], [/^\/poster\/(.+)$/, '/api/poster'], [/^\/map\/(.+)$/, '/api/map'], [/^\/flag\/(.+)$/, '/api/flag'], [/^\/arms\/(.+)$/, '/api/arms'], [/^\/anthem\/(.+)$/, '/api/anthem']];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  let p = u.pathname;
  for (const [re, dest] of rewrites) { const m = re.exec(p); if (m) { u.searchParams.set('seed', decodeURIComponent(m[1])); p = dest; break; } }
  if (p === '/random') p = '/api/poster';
  if (handlers[p]) { req.query = Object.fromEntries(u.searchParams); return handlers[p](req, res); }
  const pub = path.join(__dirname, '..', 'public');
  let file = path.join(pub, p === '/' ? 'index.html' : p);
  if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';   // cleanUrls: /app → app.html
  if (!file.startsWith(pub) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; const nf = path.join(pub, '404.html'); res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found'); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log('Worldscape dev server on http://localhost:' + (process.env.PORT || 3000)));
