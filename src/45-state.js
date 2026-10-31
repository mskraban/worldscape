/* ───────────────────────── The state: government, money, symbols, fact sheet ───────────────────────── */

const GOVERNMENTS = [
  { form: 'Kingdom', adj: 'monarchy', ruler: ['King', 'Queen'], region: ['Duchy', 'County', 'March', 'Shire'], w: 4, assembly: 'the Royal Council' },
  { form: 'Grand Duchy', adj: 'grand duchy', ruler: ['Grand Duke', 'Grand Duchess'], region: ['County', 'Barony', 'Parish'], w: 1.2, assembly: 'the Ducal Diet' },
  { form: 'Principality', adj: 'principality', ruler: ['Prince', 'Princess'], region: ['Parish', 'County', 'Vale'], w: 1.2, assembly: 'the Princely Estates' },
  { form: 'Republic', adj: 'republic', ruler: ['President', 'President'], region: ['Province', 'Canton', 'Department'], w: 3, assembly: 'the Senate' },
  { form: 'Free State', adj: 'free state', ruler: ['Chancellor', 'Chancellor'], region: ['District', 'Canton', 'Land'], w: 1.2, assembly: 'the Free Assembly' },
  { form: 'Confederation', adj: 'confederation', ruler: ['Speaker', 'Speaker'], region: ['Canton', 'Commune', 'Member State'], w: 1, assembly: 'the Council of Cantons' },
  { form: 'Empire', adj: 'empire', ruler: ['Emperor', 'Empress'], region: ['Province', 'Satrapy', 'Marches'], w: 0.7, assembly: 'the Imperial Court' },
  { form: 'Sultanate', adj: 'sultanate', ruler: ['Sultan', 'Sultana'], region: ['Emirate', 'Province', 'Vilayet'], w: 0.5, assembly: 'the Divan' },
];
const TONGUE_GOV_BIAS = { kheshic: { Sultanate: 5, Empire: 1.5 }, norvic: { Confederation: 2, Kingdom: 1.5 }, solaric: { Republic: 1.8 }, hardic: { Kingdom: 1.4, 'Grand Duchy': 1.4 }, tuvian: { Confederation: 2, 'Free State': 2 }, ostrian: { Empire: 2, 'Grand Duchy': 1.4 } };
const CLIMATES = [
  [(b) => (b[BIOME.TUNDRA] || 0) > 0.25, 'cold, windy and mostly treeless in the north'],
  [(b) => (b[BIOME.DESERT] || 0) > 0.25, 'hot and dry, with a green fringe along the rivers'],
  [(b) => (b[BIOME.FOREST] || 0) > 0.35, 'damp and temperate, wrapped in forest'],
  [(b) => (b[BIOME.PLAINS] || 0) > 0.35, 'mild, with long summers over open farmland'],
  [() => true, 'changeable and temperate, shifting with the hills'],
];
const pluralize = (w) => (w === 'March' ? 'Marches' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : /(s|x|ch|sh)$/.test(w) ? w + 'es' : w + 's');
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ANIMALS = ['wolf', 'bear', 'eagle', 'stag', 'swan', 'horse', 'fish'];
const COMMODITIES = { forest: ['timber', 'resin', 'honey'], plains: ['wheat', 'barley', 'wool'], hills: ['wool', 'cheese', 'copper'], mountain: ['iron', 'silver', 'granite'], coast: ['salted fish', 'sea salt', 'ship timber'], desert: ['glass', 'spice', 'dates'], marsh: ['peat', 'reeds', 'eels'], tundra: ['furs', 'amber', 'whale oil'], lake: ['freshwater pearls', 'smoked trout'], wine: ['wine', 'olive oil'] };

function makeState(rng, g, heraldry) {
  const lang = g.lang, bias = TONGUE_GOV_BIAS[g.tongue] || {};
  const gov = rng.weighted(GOVERNMENTS.map((x) => [x, x.w * (bias[x.form] || 1)]));
  const female = rng.chance(0.5);
  const rulerTitle = gov.ruler[female ? 1 : 0];
  const rulerName = lang.person();
  const regnal = gov.adj === 'republic' || gov.adj === 'free state' || gov.adj === 'confederation' ? '' : ROMAN[rng.int(0, 5)];
  const regionTitle = rng.pick(gov.region);

  const bc = g.biomeCount, own = g.ownCount, share = {}; for (const k of Object.keys(bc)) share[k] = bc[k] / own;
  const climate = CLIMATES.find(([f]) => f(share))[1];
  const names = ['plains', 'forest', 'hills', 'mountain', 'peak', 'desert', 'marsh', 'tundra', 'lake'];
  const landscape = names.map((n, k) => [n, share[[BIOME.PLAINS, BIOME.FOREST, BIOME.HILLS, BIOME.MOUNTAIN, BIOME.PEAK, BIOME.DESERT, BIOME.MARSH, BIOME.TUNDRA, BIOME.LAKE][k]] || 0]).filter((x) => x[1] > 0.06).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
  const sc = (k) => share[k] || 0;
  const goods = [];
  const add = (key, n) => { for (const w of COMMODITIES[key].slice(0, n)) if (!goods.includes(w)) goods.push(w); };
  if (sc(BIOME.FOREST) > 0.12) add('forest', 1); if (sc(BIOME.PLAINS) > 0.15) add('plains', 2); if (sc(BIOME.HILLS) > 0.1) add('hills', 1);
  if (sc(BIOME.MOUNTAIN) + sc(BIOME.PEAK) > 0.05) add('mountain', 2); if (g.cities.some((c) => c.port)) add('coast', 2);
  if (sc(BIOME.DESERT) > 0.08) add('desert', 1); if (sc(BIOME.MARSH) > 0.05) add('marsh', 1); if (sc(BIOME.TUNDRA) > 0.1) add('tundra', 1); if (sc(BIOME.LAKE) > 0.01) add('lake', 1);
  if (sc(BIOME.PLAINS) + sc(BIOME.HILLS) > 0.3 && rng.chance(0.4)) add('wine', 1);
  const exports = rng.sample(goods.length ? goods : ['timber'], Math.min(4, goods.length || 1));

  /* money */
  const unit = lang.fmt(lang.join(lang.syl(), rng.pick(lang.T.countryEnds.concat(lang.T.cityEnds)).slice(0, 3)));
  const sub = lang.fmt(lang.syl() + (lang.T.K.length ? rng.pick(lang.T.K) : ''));
  const currency = { name: unit, sub, per: rng.pick([10, 12, 20, 100]) };

  /* animal & tree */
  const animal = ANIMALS.filter((a) => lang.lex[a]); const nat = rng.pick(animal.length ? animal : ['wolf']);
  const nationalAnimal = { native: lang.fmt(lang.lex[nat] || 'wolf'), en: nat };
  const treeCand = ['oak', 'pine', 'rose'].filter((a) => lang.lex[a]); const tr = rng.pick(treeCand.length ? treeCand : ['oak']);
  const nationalTree = { native: lang.fmt(lang.lex[tr] || tr), en: tr === 'rose' ? 'rose' : tr + ' tree' };

  /* national day */
  const m = rng.int(0, 11), d = rng.int(1, MDAYS[m]);

  /* motto in the national tongue, with its gloss */
  const mAdj = rng.pick(['free', 'proud', 'bright', 'old', 'great', 'holy', 'wild', 'silent']);
  const mNoun = rng.pick(['stone', 'sun', 'sea', 'star', 'wind', 'fire', 'mountain', 'river', 'wolf', 'eagle', 'water', 'oak', 'bell'].filter((n) => lang.lex[n]));
  const motto = lang.phrase([mAdj, mNoun]);

  const capital = g.cities[0];
  const largest = g.cities.reduce((a, b) => (b.pop > a.pop ? b : a));
  const peak = g.peaks[0], river = g.rivers.slice().sort((a, b) => b.length - a.length)[0];
  const density = Math.round(g.population / g.area * 10) / 10;
  const gdp = Math.round(g.population * rng.int(3, 28) / 1000) / 1000;

  const facts = [
    ['Government', `${gov.form}, led by ${rulerTitle} ${rulerName}${regnal ? ' ' + regnal : ''}`],
    ['Capital', `${capital.name} (“${capital.en}”)`],
    ['Language', `${g.demonym} (a ${lang.feel} tongue)`],
    ['Area', `${g.area.toLocaleString('en-US')} km²`],
    ['Population', `${g.population.toLocaleString('en-US')} (${density} per km²)`],
    ['Divisions', `${g.regions.length} ${pluralize(regionTitle)}`],
    ['Highest point', peak ? `${peak.name} (“${peak.en}”), ${peak.alt.toLocaleString('en-US')} m` : 'none to speak of'],
    ['Longest river', river ? `${river.name} (“${river.en}”), ${river.length} km` : 'none of note'],
    ['Coastline', `${g.coastKm.toLocaleString('en-US')} km`],
    ['Currency', `${currency.name} (1 = ${currency.per} ${currency.sub})`],
    ['Exports', exports.join(', ')],
    ['Climate', climate],
    ['National animal', `${nationalAnimal.native} (“${nationalAnimal.en}”)`],
    ['National day', `${MONTHS[m]} ${d}`],
  ];
  return { government: gov.form, governmentAdj: gov.adj, assembly: gov.assembly, rulerTitle, rulerName, regnal, rulerFull: `${rulerTitle} ${rulerName}${regnal ? ' ' + regnal : ''}`, regionTitle, regionPlural: pluralize(regionTitle), climate, landscape, exports, currency, nationalAnimal, nationalTree, nationalDay: { month: m, day: d, text: `${MONTHS[m]} ${d}` }, motto, capital: capital.id, largest: largest.id, density, gdpBillions: gdp, facts };
}
