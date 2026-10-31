'use strict';
// Generates the favicon set, the 1200x630 social preview and the gallery images. Run: npm run assets
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const R = require('../lib/render');
const W = R.Worldscape;
R.ensureFonts();
const pub = path.join(__dirname, '..', 'public');
fs.mkdirSync(path.join(pub, 'gallery'), { recursive: true });

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0cd6a"/><stop offset="1" stop-color="#d0663a"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="#0d1018"/><circle cx="32" cy="32" r="21" fill="none" stroke="#e2b13c" stroke-width="2.2"/><path d="M32 8 L37 27 L56 32 L37 37 L32 56 L27 37 L8 32 L27 27 Z" fill="url(#g)"/><circle cx="32" cy="32" r="3.2" fill="#0d1018"/></svg>\n`;
fs.writeFileSync(path.join(pub, 'favicon.svg'), logoSvg);
function mark(ctx, x, y, size, bg = true) {
  const k = size / 64; ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  if (bg) { ctx.fillStyle = '#0d1018'; ctx.beginPath(); ctx.roundRect(0, 0, 64, 64, 16); ctx.fill(); }
  const g = ctx.createLinearGradient(0, 0, 64, 64); g.addColorStop(0, '#f0cd6a'); g.addColorStop(1, '#d0663a');
  ctx.strokeStyle = '#e2b13c'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(32, 32, 21, 0, 7); ctx.stroke();
  ctx.fillStyle = g; ctx.beginPath(); [[32, 8], [37, 27], [56, 32], [37, 37], [32, 56], [27, 37], [8, 32], [27, 27]].forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0d1018'; ctx.beginPath(); ctx.arc(32, 32, 3.2, 0, 7); ctx.fill(); ctx.restore();
}
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['favicon-32.png', 32]]) {
  const c = createCanvas(size, size), x = c.getContext('2d');
  if (name.startsWith('apple')) { x.fillStyle = '#0d1018'; x.fillRect(0, 0, size, size); mark(x, size * 0.1, size * 0.1, size * 0.8, false); } else mark(x, 0, 0, size);
  fs.writeFileSync(path.join(pub, name), c.toBuffer('image/png'));
}

const SHOW = ['saffron', 'harbor', 'glacier', 'mistral', 'lantern', 'basalt'];
async function save(file, kind, query, fmt) { const out = await R.renderImage(kind, { ...query, format: fmt }); fs.writeFileSync(path.join(pub, 'gallery', file), out.buffer); return out; }
(async () => {
  for (const s of SHOW) {
    await save(`poster-${s}.jpg`, 'poster', { seed: s, width: 900, quality: 82 }, 'jpeg');
    await save(`map-${s}.jpg`, 'map', { seed: s, width: 1200, height: 800, quality: 82 }, 'jpeg');
  }
  await save('map-saffron-atlas.jpg', 'map', { seed: 'saffron', style: 'atlas', width: 1200, height: 800, quality: 82 }, 'jpeg');
  await save('map-saffron-night.jpg', 'map', { seed: 'saffron', style: 'night', width: 1200, height: 800, quality: 82 }, 'jpeg');
  await save('anthem-saffron.png', 'sheet', { seed: 'saffron', width: 1200 }, 'png');
  // flag and arms mosaics
  const seeds = ['saffron', 'harbor', 'glacier', 'mistral', 'lantern', 'basalt', 'kestrel', 'meridian', 'solstice', 'vellum', 'tundra', 'cedar'];
  const fm = createCanvas(1200, 560), fx = fm.getContext('2d'); fx.fillStyle = '#0d1018'; fx.fillRect(0, 0, 1200, 560);
  const am = createCanvas(1200, 560), ax = am.getContext('2d'); ax.fillStyle = '#efe4c8'; ax.fillRect(0, 0, 1200, 560);
  seeds.forEach((s, i) => { const C = W.generateCountry(s), col = i % 4, row = Math.floor(i / 4), r = C.heraldry.flag.ratio, fw = 240, fh = fw * r[1] / r[0];
    W.drawFlag(fx, C.heraldry.flag, 30 + col * 292, 28 + row * 180, fw, Math.min(fh, 150)); W.drawArms(ax, C.heraldry.arms, 150 + col * 300, 105 + row * 180, 105); });
  fs.writeFileSync(path.join(pub, 'gallery', 'flags.png'), fm.toBuffer('image/png')); fs.writeFileSync(path.join(pub, 'gallery', 'arms.png'), am.toBuffer('image/png'));

  // social preview
  const WW = 1200, HH = 630, c = createCanvas(WW, HH), x = c.getContext('2d');
  const C = W.generateCountry('saffron'); x.fillStyle = '#0d1018'; x.fillRect(0, 0, WW, HH);
  x.save(); x.translate(700, 0); W.drawMap(x, C, 0, 0, 500, HH, { style: 'parchment', frame: false, title: undefined, decor: false, labels: true }); x.restore();
  const sh = x.createLinearGradient(660, 0, 860, 0); sh.addColorStop(0, 'rgba(13,16,24,1)'); sh.addColorStop(1, 'rgba(13,16,24,0)'); x.fillStyle = sh; x.fillRect(660, 0, 200, HH);
  mark(x, 64, 56, 60); x.fillStyle = '#f1e9d6'; x.font = '700 38px Cinzel'; x.letterSpacing = '4px'; x.fillText('WORLDSCAPE', 140, 100); x.letterSpacing = '0px';
  x.font = '700 72px Cinzel'; x.fillStyle = '#fff'; x.fillText('A whole country', 64, 262); const g = x.createLinearGradient(64, 0, 560, 0); g.addColorStop(0, '#f0cd6a'); g.addColorStop(1, '#d0663a'); x.fillStyle = g; x.fillText('from one word.', 64, 346);
  x.fillStyle = '#c9cfdd'; x.font = '500 25px Inter'; x.fillText('Map · flag · arms · language · history · anthem', 66, 412);
  let cx = 66; for (const t of ['printable poster', 'free API', 'offline', 'MIT']) { x.font = '600 21px "JetBrains Mono"'; const w = x.measureText(t).width; x.fillStyle = 'rgba(255,255,255,.1)'; x.beginPath(); x.roundRect(cx, 470, w + 34, 44, 22); x.fill(); x.fillStyle = '#f1e9d6'; x.fillText(t, cx + 17, 499); cx += w + 48; }
  W.drawFlag(x, C.heraldry.flag, 64, 548, 84, 56, {}); x.fillStyle = '#aab0c0'; x.font = '600 22px Inter'; x.fillText(`Try “saffron”: the ${C.state.government} of ${C.geo.name}`, 166, 585);
  fs.writeFileSync(path.join(pub, 'og.jpg'), c.toBuffer('image/jpeg', 90));
  console.log('assets done');
})();
