'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const call = async (name, query, method = 'GET') => {
  const handler = require(`../api/${name}.js`); const headers = {}; let body;
  const res = { statusCode: 200, setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, end: (b) => { body = b; } };
  await handler({ method, query }, res);
  return { status: res.statusCode, headers, body };
};
const isPng = (b) => Buffer.isBuffer(b) && b.slice(1, 4).toString() === 'PNG';
const isJpeg = (b) => Buffer.isBuffer(b) && b[0] === 0xff && b[1] === 0xd8;

test('every api file is a function and is listed in the docs', () => {
  const docs = fs.readFileSync(path.join(__dirname, '..', 'public', 'docs.html'), 'utf8');
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'api')).filter((x) => !x.startsWith('_'))) { const n = f.replace('.js', ''); assert.equal(typeof require(`../api/${f}`), 'function'); assert.ok(docs.includes(`/api/${n}`) || n === 'describe', `docs do not mention /api/${n}`); }
});

test('flag, arms, map and poster render images and cache forever when seeded', async () => {
  for (const [name, q, check] of [['flag', { seed: 'saffron', width: '200' }, isPng], ['arms', { seed: 'saffron', width: '200' }, isPng], ['map', { seed: 'saffron', width: '500', height: '340', format: 'png' }, isPng], ['poster', { seed: 'saffron', width: '500' }, isJpeg]]) {
    const r = await call(name, q); assert.equal(r.status, 200, name); assert.ok(check(r.body), `${name} wrong image type`);
    assert.match(r.headers['cache-control'], /immutable/); assert.equal(r.headers['x-worldscape-seed'], 'saffron');
  }
});

test('the same request gives identical bytes, a different seed does not', async () => {
  const a = await call('flag', { seed: 'one', width: '240' }), b = await call('flag', { seed: 'one', width: '240' }), c = await call('flag', { seed: 'two', width: '240' });
  assert.ok(a.body.equals(b.body)); assert.ok(!a.body.equals(c.body));
});

test('unseeded requests are random and never cached', async () => {
  const r = await call('flag', { width: '100' }); assert.equal(r.status, 200); assert.equal(r.headers['cache-control'], 'no-store');
  const j = await call('random', {}); assert.equal(j.status, 200); const o = JSON.parse(j.body); assert.ok(o.seed && o.name && o.links.poster.includes(encodeURIComponent(o.seed)));
});

test('anthem: MIDI by default, sheet music and JSON on request', async () => {
  const m = await call('anthem', { seed: 'saffron' }); assert.equal(m.headers['content-type'], 'audio/midi'); assert.equal(m.body.slice(0, 4).toString(), 'MThd');
  const p = await call('anthem', { seed: 'saffron', format: 'png', width: '800' }); assert.ok(isPng(p.body));
  const j = await call('anthem', { seed: 'saffron', format: 'json' }); assert.equal(JSON.parse(j.body).lyrics.length, 4);
  assert.equal((await call('anthem', { seed: 'saffron', format: 'wav' })).status, 400);
});

test('country JSON has the documented shape', async () => {
  const r = await call('country', { seed: 'saffron' }); assert.equal(r.status, 200); const o = JSON.parse(r.body);
  for (const k of ['seed', 'country', 'facts', 'cities', 'regions', 'geography', 'flag', 'arms', 'history', 'anthem', 'links']) assert.ok(k in o, `missing ${k}`);
  assert.ok(o.history.events.length >= 10); assert.ok(o.cities.some((c) => c.capital));
});

test('bad input gets a clear 400, and unsupported methods a 405', async () => {
  for (const [name, q] of [['poster', { seed: 's', width: '99999' }], ['poster', { seed: 's', width: 'abc' }], ['poster', { seed: 's', style: 'neon' }], ['map', { seed: 's', size: 'big' }], ['map', { seed: 's', width: '3200', height: '3200' }], ['flag', { seed: 'x'.repeat(201) }], ['flag', { seed: 's', format: 'bmp' }], ['flag', { seed: 's', quality: '0' }]]) {
    const r = await call(name, q); assert.equal(r.status, 400, `${name} ${JSON.stringify(q)}`); assert.ok(JSON.parse(r.body).error);
  }
  assert.equal((await call('flag', { seed: 's' }, 'POST')).status, 405);
  assert.equal((await call('flag', { seed: 's' }, 'OPTIONS')).status, 204);
});

test('describe lists options that the renderer really accepts', async () => {
  const d = JSON.parse((await call('describe', {})).body);
  for (const style of d.styles) assert.equal((await call('map', { seed: 's', style, width: '320', height: '320' })).status, 200);
  for (const f of d.formats) assert.equal((await call('flag', { seed: 's', width: '64', format: f })).status, 200);
});
