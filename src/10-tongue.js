/* ───────────────────────── Tongues: invented languages with a real vocabulary ─────────────────────────
   Each country speaks a tongue with its own sounds. We invent a root word for ~70 concepts, then build
   place names by compounding roots, so "Orvathel" really does mean "White Harbor" and the glossary can say so. */

const NOUN_EN = { water: 'water', river: 'river', sea: 'sea', harbor: 'harbor', mountain: 'mountain', hill: 'hill', valley: 'valley', forest: 'forest', stone: 'stone', salt: 'salt', gold: 'gold', iron: 'iron', wheat: 'wheat', wine: 'wine', fish: 'fish', wolf: 'wolf', bear: 'bear', eagle: 'eagle', sun: 'sun', moon: 'moon', star: 'star', king: 'king', bridge: 'bridge', tower: 'tower', fort: 'fort', ford: 'ford', lake: 'lake', island: 'island', cape: 'cape', spring: 'spring', field: 'field', fire: 'fire', wind: 'wind', night: 'night', dawn: 'dawn', home: 'home', crown: 'crown', oak: 'oak', pine: 'pine', horse: 'horse', stag: 'stag', rose: 'rose', swan: 'swan', bell: 'bell', glass: 'glass', amber: 'amber', silver: 'silver', copper: 'copper', hearth: 'hearth', peak: 'peak', bay: 'bay', gate: 'gate', market: 'market', mill: 'mill', cliff: 'cliff' };
const ADJ_EN = { red: 'red', white: 'white', black: 'black', green: 'green', blue: 'blue', old: 'old', new: 'new', high: 'high', great: 'great', little: 'little', holy: 'holy', long: 'long', hidden: 'hidden', bright: 'bright', silent: 'silent', bitter: 'bitter', sweet: 'sweet', wild: 'wild', free: 'free', proud: 'proud' };
const CONCEPT_EN = Object.assign({}, NOUN_EN, ADJ_EN);
const IS_ADJ = (k) => Object.prototype.hasOwnProperty.call(ADJ_EN, k);
const MOD_NOUNS = ['wolf', 'bear', 'eagle', 'stag', 'swan', 'salt', 'gold', 'iron', 'stone', 'amber', 'silver', 'copper', 'wheat', 'wine', 'fish', 'rose', 'sun', 'moon', 'star', 'bell', 'glass', 'oak', 'pine', 'horse', 'fire', 'wind', 'dawn', 'night'];
const MOD_ADJS = Object.keys(ADJ_EN);

/* phonologies. C = consonants/onsets, V = vowels, K = codas, T = syllable templates (C onset, V vowel, K coda) */
const TONGUES = [
  { id: 'silvern', feel: 'flowing', C: ['l', 'r', 'n', 'm', 's', 'v', 'th', 'f', 'l', 'r'], V: ['a', 'e', 'i', 'o', 'ae', 'ia', 'a', 'e'], K: ['n', 'l', 'r', 's', 'th'], T: ['CV', 'CV', 'CVK', 'V'], link: 'e', countryEnds: ['ia', 'ar', 'eth', 'anor', 'ien'], cityEnds: ['ia', 'en', 'eth', 'or'], personEnds: ['iel', 'wen', 'ion', 'ara', 'eth'], adjFirst: true, sep: 0.03 },
  { id: 'hardic', feel: 'stony', C: ['k', 'g', 'd', 'r', 'z', 'kh', 't', 'b', 'gh', 'kr', 'dr', 'gr'], V: ['a', 'o', 'u', 'e'], K: ['k', 'r', 'n', 'g', 'd', 'z'], T: ['CVK', 'CVK', 'CV', 'CVK'], link: 'a', countryEnds: ['ak', 'or', 'un', 'ar', 'ok'], cityEnds: ['ak', 'un', 'ar', 'dun'], personEnds: ['ak', 'ur', 'og', 'ar'], adjFirst: false, sep: 0.07 },
  { id: 'solaric', feel: 'melodic', C: ['l', 'r', 's', 't', 'n', 'v', 'm', 'c', 'p', 'd', 'b'], V: ['a', 'e', 'i', 'o', 'u'], K: ['n', 's', 'r', 'l'], T: ['CV', 'CV', 'CVK', 'V'], link: 'o', countryEnds: ['ia', 'ara', 'onia', 'essa', 'ino'], cityEnds: ['ia', 'o', 'a', 'ino', 'essa'], personEnds: ['ino', 'ara', 'elo', 'ia', 'ora'], adjFirst: false, sep: 0 },
  { id: 'norvic', feel: 'wind-worn', C: ['v', 'k', 's', 'th', 'r', 'd', 'g', 'h', 'b', 'f', 'y'], V: ['a', 'o', 'i', 'y', 'u', 'e'], K: ['r', 'n', 'd', 'k', 't', 's', 'g'], T: ['CVK', 'CV', 'CVK'], link: 'a', countryEnds: ['mar', 'dal', 'gar', 'holm', 'vald'], cityEnds: ['vik', 'dal', 'sund', 'vald', 'holm'], personEnds: ['ar', 'vald', 'rik', 'dis', 'gerd'], adjFirst: true, sep: 0 },
  { id: 'kheshic', feel: 'hushed', C: ['kh', 'sh', 'z', 'q', 'h', 's', 'm', 'n', 'r', 'l', 't', 'b'], V: ['a', 'i', 'u', 'a', 'i'], K: ['r', 'n', 'm', 'sh', 'l'], T: ['CVK', 'CV', 'CVK'], link: 'a', countryEnds: ['ar', 'esh', 'im', 'an', 'ur'], cityEnds: ['ar', 'im', 'esh', 'an'], personEnds: ['im', 'ar', 'esh', 'ah'], adjFirst: false, sep: 0.18 },
  { id: 'tuvian', feel: 'open', C: ['t', 'k', 'm', 'n', 'h', 'l', 'p', 'w', 'v'], V: ['a', 'e', 'i', 'o', 'u', 'a', 'o'], K: [], T: ['CV', 'CV', 'CV', 'CV'], link: '', countryEnds: ['a', 'i', 'u', 'ani', 'ua'], cityEnds: ['a', 'ua', 'i', 'ani'], personEnds: ['a', 'i', 'ua', 'ani'], adjFirst: true, sep: 0.02 },
  { id: 'ostrian', feel: 'rolling', C: ['st', 'sk', 'tr', 'pr', 'br', 'v', 'z', 'd', 'm', 'n', 'l', 's', 'j'], V: ['a', 'e', 'o', 'i', 'y'], K: ['n', 'r', 's', 'k', 'v', 'l', 't'], T: ['CVK', 'CV', 'CVK', 'CV'], link: 'o', countryEnds: ['ova', 'ia', 'ev', 'ika', 'avia'], cityEnds: ['ov', 'ia', 'ika', 'ava', 'insk'], personEnds: ['ov', 'ek', 'ika', 'an'], adjFirst: true, sep: 0 },
  { id: 'lunaric', feel: 'soft', C: ['l', 'll', 'n', 'nn', 's', 'ss', 'm', 'r', 'd', 'v'], V: ['a', 'e', 'i', 'o', 'u', 'ia'], K: ['n', 'l', 's', 'r'], T: ['CV', 'CVK', 'CV', 'CV'], link: 'e', countryEnds: ['ella', 'anna', 'enne', 'ora', 'illa'], cityEnds: ['ella', 'enne', 'ia', 'inna'], personEnds: ['ella', 'anne', 'ora', 'iel'], adjFirst: false, sep: 0 },
  { id: 'rhunic', feel: 'breathy', C: ['r', 'h', 'dh', 'gw', 'n', 'm', 'l', 'th', 's'], V: ['a', 'e', 'o', 'u', 'i', 'a', 'e', 'ae'], K: ['n', 'r', 'dh', 'th'], T: ['CV', 'CVK', 'CV', 'CVK'], link: 'e', countryEnds: ['ion', 'wyn', 'ar', 'ael', 'nor'], cityEnds: ['wyn', 'ael', 'ion', 'nor'], personEnds: ['wyn', 'ael', 'ion', 'ar'], adjFirst: true, sep: 0.04 },
  { id: 'zephyric', feel: 'airy', C: ['z', 'f', 'v', 's', 'l', 'n', 'r', 'th'], V: ['a', 'e', 'i', 'o', 'a', 'e', 'i'], K: ['s', 'n', 'l'], T: ['CV', 'CV', 'CVK', 'VK'], link: 'e', countryEnds: ['ae', 'is', 'os', 'ea', 'ia'], cityEnds: ['ae', 'is', 'os', 'ea'], personEnds: ['ae', 'is', 'ea', 'os'], adjFirst: false, sep: 0 },
];

/* An instance of a tongue for one country: a lexicon plus generators for words, names and phrases. */
function makeLanguage(rng, tongueId) {
  const T = TONGUES.find((t) => t.id === tongueId) || rng.pick(TONGUES);
  const used = new Set();
  const syl = () => {
    const tpl = rng.pick(T.T); let s = '';
    for (const ch of tpl) s += ch === 'C' ? rng.pick(T.C) : ch === 'V' ? rng.pick(T.V) : rng.pick(T.K.length ? T.K : ['']);
    return s;
  };
  const vgroups = (w) => (w.match(/[aeiouy]+/g) || []).length;
  const makeRoot = () => {
    for (let tries = 0; tries < 60; tries++) {
      let w = syl(); if (rng.chance(0.12)) w += syl();
      if (w.length >= 2 && w.length <= 5 && vgroups(w) <= 2 && !used.has(w)) { used.add(w); return w; }
    }
    const w = syl() + syl() + syl(); used.add(w); return w;
  };
  const lex = {};
  for (const k of Object.keys(CONCEPT_EN)) lex[k] = makeRoot();

  const isV = (c) => 'aeiouy'.includes(c);
  const join = (a, b) => {
    const la = a[a.length - 1], fb = b[0];
    if (isV(la) && isV(fb)) return a.slice(0, -1) + b;
    if (!isV(la) && !isV(fb)) return T.link ? a + T.link + b : a + b;
    return a + b;
  };
  const sepJoin = (a, b) => (rng.chance(T.sep) ? a + "'" + b : join(a, b));
  const fmt = (s) => s.split("'").map(cap).join("'");

  /* compound(modifier, head): native word and its English gloss */
  const compound = (mod, head, ending) => {
    const modAdj = IS_ADJ(mod);
    const first = modAdj ? T.adjFirst : rng.chance(0.5);
    let text = first ? sepJoin(lex[mod], lex[head]) : sepJoin(lex[head], lex[mod]);
    if (ending) text = join(text, ending);
    return { text: fmt(text), en: `${cap(CONCEPT_EN[mod])} ${cap(CONCEPT_EN[head])}`, parts: [mod, head] };
  };
  const tooLong = (n) => n.text.length > 9 || vgroups(n.text.toLowerCase()) > 3 || /[aeiouy]{3,}/.test(n.text.toLowerCase());
  const unique = new Set();
  const place = (heads, mods = [...MOD_ADJS, ...MOD_NOUNS], withEnd = 0.15) => {
    for (let tries = 0; tries < 40; tries++) {
      const mod = rng.pick(mods), head = rng.pick(heads);
      const n = compound(mod, head, rng.chance(withEnd) ? rng.pick(T.cityEnds) : '');
      if (!tooLong(n) && !unique.has(n.text)) { unique.add(n.text); return n; }
    }
    let n; for (let i = 0; i < 40; i++) { n = compound(rng.pick(MOD_ADJS), rng.pick(heads), ''); if (n.text.length <= 12) break; } unique.add(n.text); return n;
  };
  const person = () => {
    let s = syl(); if (rng.chance(0.6)) s += syl();
    return cap(rng.chance(0.55) ? join(s, rng.pick(T.personEnds)) : s);
  };
  const phrase = (concepts) => ({ text: concepts.map((c) => cap(lex[c])).join(' '), en: concepts.map((c) => cap(CONCEPT_EN[c])).join(' ') });
  return { id: T.id, feel: T.feel, T, lex, compound, place, person, phrase, join, fmt, syl, rng };
}

const SITE_HEADS = {
  coast: ['harbor', 'bay', 'cape', 'harbor'],
  river: ['ford', 'bridge', 'mill', 'ford'],
  mountain: ['peak', 'cliff', 'gate', 'fort'],
  plains: ['field', 'market', 'mill', 'hearth', 'home'],
  forest: ['oak', 'pine', 'spring', 'hearth'],
  general: ['tower', 'fort', 'stone', 'crown', 'bell'],
};
