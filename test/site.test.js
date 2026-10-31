'use strict';
// SEO and site-integrity checks: these protect search ranking, link previews and basic accessibility.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public');
const SITE = 'https://worldscape-teal.vercel.app';
const pages = { 'index.html': '/', 'app.html': '/app', 'docs.html': '/docs' };
const read = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');
const meta = (html, re) => { const m = html.match(re); return m ? m[1] : null; };

for (const [file, route] of Object.entries(pages)) {
  test(`${file}: title, description, canonical, social tags and a single h1`, () => {
    const html = read(file);
    const title = meta(html, /<title>([^<]+)<\/title>/); assert.ok(title && title.length >= 20 && title.length <= 75, `title length ${title && title.length}`);
    const desc = meta(html, /<meta name="description" content="([^"]+)"/); assert.ok(desc && desc.length >= 70 && desc.length <= 175, `description length ${desc && desc.length}`);
    assert.equal(meta(html, /<link rel="canonical" href="([^"]+)"/), SITE + route);
    for (const tag of ['og:title', 'og:description', 'og:url', 'og:image']) assert.ok(html.includes(`property="${tag}"`), `missing ${tag}`);
    assert.ok(html.includes('name="twitter:card"') && html.includes('name="twitter:image"'));
    assert.ok(html.includes('name="theme-color"') && html.includes('rel="manifest"') && html.includes('rel="apple-touch-icon"'));
    assert.match(html, /<html lang="en">/); assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, 'exactly one <h1>');
  });
  test(`${file}: structured data parses and every local file it links to exists`, () => {
    const html = read(file);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
    for (const m of html.matchAll(/(?:href|src)="([^"#?]+)[^"]*"/g)) {
      const u = m[1]; if (/^(https?:|mailto:|data:|\/\/)/.test(u) || /\$\{/.test(u) || /^\/?(api|c|poster|map|flag|arms|anthem|random)(\/|$)/.test(u)) continue;
      const clean = u.replace(/^\//, ''); assert.ok(clean === '' || fs.existsSync(path.join(PUB, clean)) || fs.existsSync(path.join(PUB, clean + '.html')), `${file} links to a missing file: ${u}`);
    }
  });
  test(`${file}: images have alt text and dimensions`, () => {
    for (const m of read(file).replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/<img\b[^>]*>/g)) { assert.ok(/\balt="[^"]+"/.test(m[0]), `img without alt: ${m[0].slice(0, 90)}`); assert.ok(/\bwidth="\d+"/.test(m[0]) && /\bheight="\d+"/.test(m[0]), `img without size: ${m[0].slice(0, 90)}`); }
  });
}
test('sitemap, robots, llms.txt and manifest agree with the pages', () => {
  const sm = read('sitemap.xml'); for (const r of Object.values(pages)) assert.ok(sm.includes(`<loc>${SITE}${r}</loc>`), `sitemap lacks ${r}`);
  assert.ok(read('robots.txt').includes(`Sitemap: ${SITE}/sitemap.xml`)); assert.ok(read('llms.txt').startsWith('# Worldscape'));
  const man = JSON.parse(read('manifest.webmanifest')); for (const i of man.icons) assert.ok(fs.existsSync(path.join(PUB, i.src)));
});
test('every font file is present with its licence', () => {
  for (const m of read('fonts.css').matchAll(/url\('(fonts\/[^']+)'\)/g)) assert.ok(fs.existsSync(path.join(PUB, m[1])), m[1]);
  assert.ok(fs.readdirSync(path.join(PUB, 'fonts')).filter((f) => /LICENSE/i.test(f)).length >= 5);
});
test('the committed engine is up to date with src/', () => {
  const before = fs.readFileSync(path.join(PUB, 'engine.js'), 'utf8');
  execFileSync('node', [path.join(ROOT, 'scripts', 'build-engine.js')], { env: { ...process.env, ENGINE_OUT: path.join(require('node:os').tmpdir(), 'ws-engine-check.js') } });
  assert.equal(fs.readFileSync(path.join(require('node:os').tmpdir(), 'ws-engine-check.js'), 'utf8'), before, 'run `npm run build` and commit public/engine.js');
});
test('docs.html is up to date with the code (run `npm run docs`)', () => {
  const tmp = fs.readFileSync(path.join(PUB, 'docs.html'), 'utf8'); execFileSync('node', [path.join(ROOT, 'scripts', 'build-docs.js')]);
  assert.equal(fs.readFileSync(path.join(PUB, 'docs.html'), 'utf8'), tmp);
});
test('vercel.json routes only to existing functions', () => {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  for (const r of v.rewrites) { const fn = r.destination.split('?')[0].replace('/api/', ''); assert.ok(fs.existsSync(path.join(ROOT, 'api', fn + '.js')), `rewrite to missing function ${fn}`); }
});
test('the app page wires up every element id its script uses', () => {
  const html = read('app.html'), ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/\$\('([a-z0-9-]+)'\)/g)) assert.ok(ids.has(m[1]), `app.html uses #${m[1]} but it does not exist`);
});
