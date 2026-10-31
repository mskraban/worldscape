/* ───────────────────────── Heraldry: flag and coat of arms as plain data ─────────────────────────
   The renderers draw these specs; nothing here touches a canvas. Tinctures follow the rule of tincture
   (metal never touches metal, colour never touches colour, except on purpose). */

const TINCT = { or: '#e2b13c', argent: '#f4efe3', gules: '#c4262e', azure: '#1f4f9e', vert: '#2f7a46', sable: '#1b1b1f', purpure: '#6b2e7e', tenne: '#d97a26' };
const METALS = ['or', 'argent'], COLOURS = ['gules', 'azure', 'vert', 'sable', 'purpure'];
const TINCT_EN = { or: 'gold', argent: 'silver-white', gules: 'red', azure: 'blue', vert: 'green', sable: 'black', purpure: 'purple', tenne: 'orange' };
const CHARGES = {
  star: 'the guiding star', sun: 'the sun', crescent: 'the crescent moon', tower: 'the watchtower', mountains: 'the mountains', pine: 'the pine',
  oak: 'the old oak', waves: 'the waters', wheat: 'the harvest', rose: 'the rose', fleur: 'the lily', crown: 'the crown', key: 'the key', sword: 'the sword',
  anchor: 'the anchor', fish: 'the fish', bell: 'the bell', eagle: 'the eagle',
};
const GENERIC_CHARGES = ['star', 'sun', 'crescent', 'tower', 'rose', 'fleur', 'crown', 'key', 'sword', 'bell', 'eagle', 'star'];
const FLAG_LAYOUTS = [['hbands3', 3], ['vbands3', 3], ['hbands2', 1.2], ['nordic', 2], ['saltire', 1.4], ['diag', 1.2], ['triangle', 2], ['canton', 1.5], ['quarters', 1], ['chevron', 1.1], ['pale', 1.4]];
const ARMS_DIVISIONS = [['plain', 3], ['pale', 1.4], ['fess', 1.4], ['bend', 1.2], ['chevron', 1], ['quarterly', 1.2], ['saltire', 0.8]];
const ARMS_ORDINARIES = [[null, 3], ['chief', 1.3], ['fess', 1.3], ['pale', 1], ['bend', 1], ['chevron', 1.5], ['cross', 1.3], ['saltire', 1], ['bordure', 1.6]];
const SHIELDS = ['heater', 'heater', 'french', 'round', 'swiss', 'iberian'];

/* the 'two-tincture' rule: pairs that may sit side by side */
function legalPair(a, b) { return a !== b && (METALS.includes(a) !== METALS.includes(b)); }

function makePalette(rng, g) {
  const own = g.ownCount, bc = g.biomeCount;
  const share = (...codes) => codes.reduce((s, c) => s + (bc[c] || 0), 0) / own;
  const wc = { gules: 1.4, azure: 1.4, vert: 1, sable: 0.6, purpure: 0.5 };
  const maritime = g.type === 'island' || g.type === 'archipelago' ? 1 : 0;
  wc.azure += maritime * 2.2 + g.cities.filter((c) => c.port).length * 0.12;
  wc.vert += share(BIOME.FOREST, BIOME.PLAINS) * 3;
  wc.sable += share(BIOME.MOUNTAIN, BIOME.PEAK) * 5;
  wc.gules += g.neighbours.length * 0.4;
  const main = rng.weighted(Object.entries(wc));
  const rest = Object.entries(wc).filter(([k]) => k !== main);
  const second = rng.weighted(rest.map(([k, w]) => [k, w * (k === 'sable' || k === 'purpure' ? 0.6 : 1)]));
  const m1 = rng.weighted([['or', share(BIOME.PLAINS, BIOME.DESERT) * 3 + 1.4], ['argent', share(BIOME.MOUNTAIN, BIOME.PEAK, BIOME.TUNDRA) * 4 + 1.4]]);
  const m2 = m1 === 'or' ? 'argent' : 'or';
  return { main, second, metal: m1, metal2: m2 };
}

function pickCharge(rng, g) {
  const own = g.ownCount, bc = g.biomeCount, share = (...c) => c.reduce((s, k) => s + (bc[k] || 0), 0) / own;
  const w = [];
  GENERIC_CHARGES.forEach((c) => w.push([c, 1]));
  if (g.type === 'island' || g.type === 'archipelago') { w.push(['anchor', 3], ['fish', 1.8], ['waves', 2.2]); }
  if (g.cities.filter((c) => c.port).length >= 4) w.push(['anchor', 1.2], ['fish', 1]);
  w.push(['mountains', 0.4 + share(BIOME.MOUNTAIN, BIOME.PEAK, BIOME.HILLS) * 9]);
  w.push(['pine', share(BIOME.FOREST) * 8], ['oak', share(BIOME.FOREST) * 6]);
  w.push(['wheat', share(BIOME.PLAINS) * 9]);
  if (g.rivers.length >= 2) w.push(['waves', 1]);
  return rng.weighted(w.filter((x) => x[1] > 0));
}

function makeFlag(rng, g, pal, charge) {
  const ratio = rng.weighted([[[3, 2], 5], [[2, 1], 2], [[5, 3], 2], [[1, 1], 0.4]]);
  const layout = rng.weighted(FLAG_LAYOUTS);
  const cols = [pal.main, pal.second, pal.metal, pal.metal2];
  const A = pal.main, B = pal.metal, C = rng.chance(0.5) ? pal.second : pal.metal2;
  let colors, chargeAt = [0.5, 0.5], chargeScale = 0.46, chargeColor, params = {};
  const metalOf = (c) => (legalPair(c, B) ? B : legalPair(c, pal.metal2) ? pal.metal2 : B);
  switch (layout) {
    case 'hbands3': { const mid = rng.chance(0.55) ? B : C === A ? pal.second : C; colors = [A, legalPair(A, mid) || rng.chance(0.3) ? mid : B, rng.chance(0.6) ? A : (legalPair(mid, pal.second) ? pal.second : B)]; if (colors[1] === colors[2]) colors[2] = A; params.weights = rng.chance(0.5) ? [1, 1, 1] : [1, 2, 1]; chargeAt = rng.chance(0.4) ? [0.5, 0.5] : [0.36, 0.5]; chargeColor = legalPair(colors[1], pal.metal) ? pal.metal : (METALS.includes(colors[1]) ? A : pal.metal); break; }
    case 'vbands3': { const mid = rng.chance(0.55) ? B : pal.metal2 === B ? pal.second : pal.metal2; colors = [A, mid, rng.chance(0.6) ? A : pal.second]; if (colors[1] === colors[0]) colors[1] = B; if (colors[2] === colors[1]) colors[2] = A; params.weights = rng.chance(0.5) ? [1, 1, 1] : [1, 2, 1]; chargeAt = [0.5, 0.5]; chargeColor = METALS.includes(colors[1]) ? A : pal.metal; chargeScale = 0.4; break; }
    case 'hbands2': colors = [A, B]; chargeAt = [0.3, 0.5]; chargeColor = pal.metal2 === B ? pal.second : pal.metal2; if (chargeColor === A) chargeColor = pal.metal2; chargeScale = 0.4; break;
    case 'nordic': colors = [A, B, rng.chance(0.5) ? pal.second : A]; params.inner = colors[2] !== A && colors[2] !== B; chargeAt = [0.37, 0.5]; chargeColor = null; chargeScale = 0; break;
    case 'saltire': colors = [A, B]; chargeColor = null; chargeScale = 0; break;
    case 'diag': colors = [A, rng.chance(0.5) ? B : pal.second === A ? pal.metal2 : pal.second]; if (colors[0] === colors[1]) colors[1] = B; params.dir = rng.chance(0.5) ? 'down' : 'up'; chargeAt = [0.5, 0.5]; chargeColor = pal.metal; chargeScale = 0.3; break;
    case 'triangle': { const base = rng.chance(0.5) ? [A, B] : [A, B, A]; colors = [...base, rng.chance(0.5) ? pal.second : pal.metal2]; if (colors[colors.length - 1] === colors[0] || colors[colors.length - 1] === colors[1]) colors[colors.length - 1] = METALS.includes(colors[0]) ? pal.second : pal.metal; params.bands = base.length; params.depth = rng.pick([0.4, 0.5, 0.5]); chargeAt = [params.depth * 0.33, 0.5]; chargeColor = METALS.includes(colors[colors.length - 1]) ? A : pal.metal; chargeScale = 0.26; break; }
    case 'canton': colors = [A, B, rng.chance(0.5) ? pal.second : A]; if (colors[2] === colors[0]) colors[2] = pal.second === A ? pal.metal2 : pal.second; params.bands = rng.pick([2, 3, 5]); chargeAt = [0.2, 0.25]; chargeColor = pal.metal; chargeScale = 0.2; break;
    case 'quarters': colors = [A, B]; chargeAt = [0.5, 0.5]; chargeColor = pal.second === A ? pal.metal2 : pal.second; chargeScale = 0.3; break;
    case 'chevron': colors = [A, B, rng.chance(0.5) ? pal.second : pal.metal2]; if (colors[2] === A || colors[2] === B) colors[2] = METALS.includes(A) ? pal.second : pal.metal2; chargeAt = [0.17, 0.5]; chargeColor = null; chargeScale = 0; break;
    default: { colors = [A, B, A]; params.weights = [1, 1.4, 1]; chargeAt = [0.5, 0.5]; chargeColor = pal.metal === B ? pal.metal2 : pal.metal; chargeScale = 0.3; colors = [A, B, C === B ? pal.second : C]; if (colors[2] === colors[1]) colors[2] = A; }
  }
  const under = { hbands3: colors[1], vbands3: colors[1], hbands2: colors[0], pale: colors[1], diag: colors[0], triangle: colors[colors.length - 1], canton: colors[2] || colors[0] }[layout];
  if (chargeColor && under) chargeColor = METALS.includes(under) ? (pal.main === under ? pal.second : pal.main) : (pal.metal === under ? pal.metal2 : pal.metal);
  if (chargeColor && layout === 'quarters') chargeColor = [pal.main, pal.second, pal.metal, pal.metal2].find((x) => !colors.includes(x)) || pal.second;
  const hasCharge = chargeColor && chargeScale > 0 && rng.chance(layout === 'hbands3' || layout === 'vbands3' ? 0.65 : 0.8);
  return { layout, ratio, colors, params, charge: hasCharge ? { type: charge, color: chargeColor, at: chargeAt, scale: chargeScale } : null };
}

function makeArms(rng, g, pal, charge) {
  const division = rng.weighted(ARMS_DIVISIONS);
  const ordinary = rng.weighted(ARMS_ORDINARIES);
  const fieldA = rng.chance(0.62) ? pal.main : pal.second;
  const fieldB = legalPair(fieldA, pal.metal) ? pal.metal : pal.metal2;
  const colorOnField = (f) => (METALS.includes(f) ? (f === pal.metal ? pal.main : pal.second) : pal.metal);
  const field = division === 'plain' ? [fieldA] : [fieldA, fieldB];
  let ordColor = ordinary ? colorOnField(field[division === 'plain' ? 0 : 0]) : null;
  if (ordinary && division !== 'plain' && ordColor === field[1]) ordColor = field[1] === pal.metal ? pal.metal2 : pal.metal;
  const second = rng.pick(GENERIC_CHARGES.filter((c) => c !== charge));
  const centre = !ordinary || ordinary === 'bordure' || ordinary === 'chief' ? 1 : 0;
  const chargeColor = division === 'plain' || ordinary === 'bordure' ? (ordinary === 'bordure' ? colorOnField(field[0]) : colorOnField(field[0])) : (METALS.includes(field[0]) ? pal.main : pal.metal);
  const crest = rng.weighted([['crown', 3], ['helm', 2], ['star', 1], ['none', 1]]);
  const supporters = rng.weighted([['none', 3], ['laurel', 2], ['wheat', 1], ['wings', 1]]);
  const arrangement = rng.weighted([[1, 5], [2, 1.4], [3, 2]]);
  return { shape: rng.pick(SHIELDS), division, tinctures: field, ordinary, ordinaryColor: ordColor, charge: { type: charge, color: chargeColor, count: centre ? (division === 'quarterly' ? 1 : arrangement) : (ordinary === 'chevron' || ordinary === 'fess' || ordinary === 'bend' || ordinary === 'pale' ? 3 : 1), arrangement: arrangement }, secondCharge: division === 'quarterly' ? { type: second, color: METALS.includes(field[1]) ? pal.main : pal.metal } : null, crest, supporters, crownColor: 'or', outline: pal.metal === 'or' ? 'sable' : 'sable' };
}

function makeHeraldry(rng, g) {
  const pal = makePalette(rng, g);
  const charge = pickCharge(rng, g);
  const flag = makeFlag(rng, g, pal, charge);
  const arms = makeArms(rng, g, pal, charge);
  /* a short, honest account of what the symbols stand for */
  const means = [];
  const sea = g.seas[0], river = g.rivers[0], range = g.ranges[0];
  const meaning = { azure: sea ? `the ${sea.name} (“${sea.en}”) that washes the coast` : 'the rivers and the sky', vert: 'the forests and meadows', or: 'the grain and the sun', argent: range ? `the snows of the ${range.name} (“${range.en}”)` : 'peace and the snows', gules: 'the blood spilled at the founding', sable: 'the iron beneath the hills', purpure: 'the old royal house', tenne: 'the autumn fields' };
  const seen = new Set(); [...flag.colors, flag.charge && flag.charge.color].filter(Boolean).forEach((c) => { if (!seen.has(c) && meaning[c]) { seen.add(c); means.push(`${cap(TINCT_EN[c])}: ${meaning[c]}.`); } });
  if (flag.charge || arms.charge) means.push(`The charge, ${CHARGES[charge]}, is the nation's old emblem.`);
  return { palette: pal, charge, flag, arms, meaning: means };
}
