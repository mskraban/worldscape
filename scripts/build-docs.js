'use strict';
// Builds public/docs.html from the engine and API metadata, so the docs cannot drift. Run: npm run docs
const fs = require('fs');
const path = require('path');
const { describe, LIMITS } = require('../lib/render');
const SITE = 'https://worldscape-teal.vercel.app';
const d = describe();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const table = (rows) => `<div class="tablewrap"><table><thead><tr><th>Parameter</th><th>Default</th><th>Description</th></tr></thead><tbody>${rows.map(([a, b, c]) => `<tr><td><code>${esc(a)}</code></td><td><code>${esc(b)}</code></td><td>${c}</td></tr>`).join('')}</tbody></table></div>`;
const code = (s) => `<pre class="code">${esc(s)}</pre>`;
const range = (r) => `${r.min}–${r.max}`;

const seedRow = ['seed', 'random', `Any text up to ${LIMITS.seedMax} characters. <b>Leave it out for a random country</b> (never cached).`];
const imgRows = (extra) => [seedRow, ...extra, ['format', 'png', '<code>png</code>, <code>jpeg</code> or <code>webp</code>.'], ['quality', '90', '<code>1</code>–<code>100</code> for jpeg and webp.'], ['download', '–', 'Add <code>download=1</code> to receive an attachment filename.']];
const sample = JSON.stringify({ seed: 'saffron', country: { name: 'Megwirenor', government: 'Republic', capital: 'Rer\'Ni' }, facts: { Area: '49,696 km²' }, cities: ['…'], history: { events: ['…'] }, anthem: { title: { text: '…', en: '…' }, lyrics: ['…'] }, flag: '{…}', arms: '{…}', links: { poster: '/api/poster?seed=saffron' } }, null, 2);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Worldscape API Docs: Maps, Flags and Anthems from a URL</title>
<meta name="description" content="Worldscape image API reference: country maps, flags, coats of arms, posters, sheet music and MIDI anthems from a simple URL. Free, no API key, cached forever per seed.">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0d1018">
<link rel="canonical" href="${SITE}/docs">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="icon" href="favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Worldscape">
<meta property="og:title" content="Worldscape API docs: a country from a URL">
<meta property="og:description" content="Free API: maps, flags, arms, posters, sheet music and MIDI for any seed word. No key.">
<meta property="og:url" content="${SITE}/docs">
<meta property="og:image" content="${SITE}/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og.jpg">
<link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="site.css">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'TechArticle', headline: 'Worldscape API documentation', url: SITE + '/docs', about: 'Image and JSON API that generates fictional countries from a seed word' })}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<nav class="nav" aria-label="Main"><div class="container">
  <a class="brand" href="/"><svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#0d1018"/><circle cx="32" cy="32" r="21" fill="none" stroke="#e2b13c" stroke-width="2.2"/><path d="M32 8 L37 27 L56 32 L37 37 L32 56 L27 37 L8 32 L27 27 Z" fill="#e8a54a"/><circle cx="32" cy="32" r="3.2" fill="#0d1018"/></svg>Worldscape</a>
  <div class="nav-links"><a href="/">Home</a><a href="/app">Generator</a><a href="/docs" aria-current="page">API docs</a><a href="https://github.com/mskraban/worldscape">GitHub</a></div>
</div></nav>
<main id="main" class="container docs">
<aside aria-label="On this page"><a href="#overview">Overview</a><a href="#poster">Poster</a><a href="#map">Map</a><a href="#flag">Flag and arms</a><a href="#anthem">Anthem</a><a href="#country">Country JSON</a><a href="#random">Random</a><a href="#shortcuts">Short URLs</a><a href="#limits">Limits</a><a href="#engine">Use the engine</a></aside>
<div>
<h1 style="font-size:clamp(32px,5vw,52px);margin-bottom:14px">API documentation</h1>
<p>Everything Worldscape makes is available as a URL. No key, no sign-up, CORS enabled. Responses for a given <code>seed</code> never change, so they are cached for a year.</p>

<h2 id="overview">Overview</h2>
${code(`${SITE}/api/{poster|map|flag|arms|anthem|country|random}?seed=WORD`)}
<p>All endpoints accept <code>GET</code>, <code>HEAD</code> and <code>OPTIONS</code>. Errors are JSON: <code>{"error": "…", "hint": "…"}</code> with status 400 (bad input) or 413 (response over the 4.5 MB platform limit). <code>GET /api/describe</code> lists valid options as JSON.</p>
<div class="gal"><img loading="lazy" width="190" height="270" alt="Poster example" src="gallery/poster-lantern.jpg"><img loading="lazy" width="190" height="127" alt="Map example" src="gallery/map-glacier.jpg"><img loading="lazy" width="190" height="127" alt="Night map example" src="gallery/map-saffron-night.jpg"></div>

<h2 id="poster">GET /api/poster</h2>
<p>The whole country on one A-series sheet (1 : √2): header with arms and flag, map, fact sheet, gazetteer, symbols, chronicle and the anthem's sheet music.</p>
${table(imgRows([['width', String(LIMITS.poster.def), `Pixels, ${range(LIMITS.poster)}. Height follows the A-series ratio. 1240 ≈ A4 at 150 dpi, 2480 ≈ A4 at 300 dpi.`], ['style', 'parchment', `Map style: ${d.styles.map((s) => `<code>${s}</code>`).join(', ')}.`]]).map((r) => r))}
<p>The default format is <code>jpeg</code>; a 2480 px PNG exceeds the response limit, so use jpeg or webp for print sizes.</p>
${code(`${SITE}/api/poster?seed=saffron&width=2480&format=jpeg&download=1`)}

<h2 id="map">GET /api/map</h2>
${table(imgRows([['width, height', `${LIMITS.map.def}, ${Math.round(LIMITS.map.def * 0.66)}`, `Pixels, ${range(LIMITS.map)} each, at most ${(LIMITS.mapPixels / 1e6).toFixed(0)} megapixels total. Or use <code>size=1600x1000</code>.`], ['style', 'parchment', 'One of ' + d.styles.map((s) => `<code>${s}</code>`).join(', ') + '.'], ['labels, roads, borders, title', '1', 'Set to <code>0</code> to hide that layer.']]))}
${code(`${SITE}/api/map?seed=glacier&style=atlas&labels=0`)}

<h2 id="flag">GET /api/flag and /api/arms</h2>
${table(imgRows([['width', `${LIMITS.flag.def} (flag), ${LIMITS.arms.def} (arms)`, `Pixels, ${range(LIMITS.flag)}. The flag's height follows its own ratio. Arms are PNG with a transparent background.`]]))}
${code(`![flag](${SITE}/flag/saffron)\n![arms](${SITE}/arms/saffron?width=300)`)}

<h2 id="anthem">GET /api/anthem</h2>
<p>A Standard MIDI file by default, so it plays in anything. Change <code>format</code> for sheet music or lyrics.</p>
${table([seedRow, ['format', 'mid', '<code>mid</code> (audio/midi), <code>png</code>, <code>jpeg</code>, <code>webp</code> (sheet music, <code>width</code> ' + range(LIMITS.sheet) + '), or <code>json</code> (title, key, lyrics with translation).'], ['download', '–', 'Attachment filename instead of inline.']])}
${code(`${SITE}/api/anthem?seed=saffron                 # MIDI\n${SITE}/api/anthem?seed=saffron&format=png        # sheet music\n${SITE}/api/anthem?seed=saffron&format=json       # lyrics`)}

<h2 id="country">GET /api/country</h2>
<p>Everything as JSON: names with meanings, facts, cities, provinces, geography, flag and arms specifications, symbolism, chronicle and anthem lyrics. Add <code>pretty=1</code> for indented output.</p>
${code(sample)}

<h2 id="random">GET /api/random</h2>
<p>A fresh random seed with the country's name and every link. Never cached.</p>
${code(`curl ${SITE}/api/random`)}

<h2 id="shortcuts">Short URLs</h2>
${table([['/c/:seed', '→', '<code>/api/country?seed=:seed</code>'], ['/poster/:seed', '→', '<code>/api/poster</code>'], ['/map/:seed', '→', '<code>/api/map</code>'], ['/flag/:seed, /arms/:seed', '→', '<code>/api/flag</code>, <code>/api/arms</code>'], ['/anthem/:seed', '→', '<code>/api/anthem</code>'], ['/random', '→', 'a random poster']]).replace('<th>Default</th>', '<th></th>')}

<h2 id="limits">Limits and determinism</h2>
<ul class="muted" style="line-height:1.9"><li>Seeds are case-sensitive and trimmed: <code>Saffron</code> and <code>saffron</code> are different countries.</li><li>Same seed and same engine version give byte-identical data. The version is returned in <code>X-Worldscape-Engine</code>.</li><li>Poster ${range(LIMITS.poster)} px, map ${range(LIMITS.map)} px, flag ${range(LIMITS.flag)} px, sheet ${range(LIMITS.sheet)} px.</li><li>Be kind: for heavy use, cache responses or run the engine yourself (below).</li></ul>

<h2 id="engine">Use the engine directly</h2>
<p>The engine is one file with no dependencies that runs in browsers and Node. It generates the country; drawing needs any Canvas 2D context.</p>
${code(`const W = require('./public/engine.js');       // or <script src="engine.js"> in a page\nconst country = W.generateCountry('saffron');\nconsole.log(country.geo.name, country.state.government);\nconst midi = W.anthemMidi(country.anthem);       // Uint8Array\n// draw: W.drawMap(ctx, country, 0, 0, 1600, 1000, { style: 'parchment' })`)}
<p>See the <a href="https://github.com/mskraban/worldscape">README</a> for the full list of exports.</p>
</div>
</main>
<footer class="footer"><div class="container"><div><a class="brand" href="/">Worldscape</a></div><div><h4>Product</h4><a href="/app">Generator</a></div><div><h4>Project</h4><a href="https://github.com/mskraban/worldscape">GitHub</a></div><div></div><div class="fine"><span>© Worldscape contributors · MIT</span></div></div></footer>
<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, '..', 'public', 'docs.html'), html);
console.log('docs.html written');
