/* ───────────────────────── History: a chronicle assembled from the country's own geography ─────────────────────────
   Events are templates filled with real places, rivers, peaks and neighbours from this country, then
   placed in order on a timeline. */

const EPITHETS = ['the Bold', 'the Wise', 'the Red', 'the Fair', 'the Old', 'the Builder', 'the Patient', 'the Stern', 'the Generous', 'Ironhand', 'the Lame', 'the Pious'];
const PLAGUES = ['Grey Sickness', 'Weeping Fever', 'Pale Death', 'Sleeping Plague', 'Red Cough'];
const WARS = ['Salt', 'Two Crowns', 'Bitter Winter', 'Broken Bridge', 'Three Rivers', 'Hollow Harvest', 'Border Stones', 'Silver Road'];

function makeHistory(rng, g, st, her) {
  const lang = g.lang, cities = g.cities, cap = cities[0];
  const now = rng.int(1180, 1980);
  const monarchy = !['republic', 'free state', 'confederation'].includes(st.governmentAdj);
  const ports = cities.filter((c) => c.port), inland = cities.filter((c) => !c.port && c.id !== 0);
  const anyCity = () => rng.pick(cities.slice(1).length ? cities.slice(1) : cities);
  const anyPort = () => (ports.length ? rng.pick(ports) : anyCity());
  const river = g.rivers[0], range = g.ranges[0], peak = g.peaks[0], sea = g.seas[0];
  const nb = g.neighbours.length ? rng.pick(g.neighbours) : null;
  const nbName = nb ? nb.name : null;
  const p = () => lang.person();
  const founder = `${p()} ${rng.pick(EPITHETS)}`;
  const people = g.demonym;
  const ev = [];
  const E = (order, kind, title, text, refs) => ev.push({ order, kind, title, text, refs: refs || {} });

  const where = cap.site === 'coast' ? `on the shore at ${cap.name}` : cap.site === 'river' ? `beside the ${river ? river.name : 'river'}, at ${cap.name}` : cap.site === 'mountain' ? `under the mountains at ${cap.name}` : `on the open ground at ${cap.name}`;
  const origin = rng.pick([
    [`The first ${people} arrive`, `${cap.site === 'coast' ? `Seafaring clans land from across the ${sea ? sea.name : 'water'}` : `Herding clans cross ${range ? `the passes of the ${range.name}` : 'the hills'}`} and settle ${where}.`],
    [`Clans gather at ${cap.name}`, `Scattered ${lang.feel} clans begin to winter together ${where}, and a common tongue starts to form.`],
  ]);
  E(0, 'origin', origin[0], origin[1], { city: cap.id });
  E(0.06, 'founding', `${cap.name} is founded`, `A palisade and a market rise ${where}. The name “${cap.name}” means “${cap.en.toLowerCase()}” in the old speech.`, { city: cap.id });

  if (monarchy) E(0.13, 'unification', `${founder} unites the clans`, `After a generation of feuds, ${founder} is acclaimed ${st.rulerTitle === 'Queen' ? 'Queen' : 'king'} at ${cap.name} and swears the first oath of the ${g.name} crown.`, { city: cap.id });
  else E(0.13, 'unification', `The Compact of ${cap.name}`, `The clan-heads of ${g.name} meet at ${cap.name}, put down their spears and sign a compact to rule by common vote under ${founder}.`, { city: cap.id });

  const prov = rng.sample(g.regions.filter((r) => r.id !== g.regionOf[cap.cell]), Math.min(2, g.regions.length - 1));
  prov.forEach((r, k) => E(0.2 + k * 0.05, 'province', `${r.name} is brought into the realm`, `${r.name} (“${r.en}”) joins ${g.name} ${rng.pick(['by marriage', 'after a short campaign', 'by treaty', 'when its lords seek protection from raiders'])} and becomes a ${st.regionTitle.toLowerCase()}.`, { region: r.id }));

  if (ports.length) { const t = anyPort(); E(0.27, 'trade', `${t.name} opens its harbor`, `Merchants from beyond the ${sea ? sea.name : 'sea'} start calling at ${t.name} (“${t.en}”) for ${rng.pick(st.exports)}, and the town doubles within a lifetime.`, { city: t.id }); }
  else { const t = anyCity(); E(0.27, 'trade', `${t.name} becomes a market town`, `Caravans meet at ${t.name} (“${t.en}”) to trade ${rng.pick(st.exports)}; its fair becomes the largest in the country.`, { city: t.id }); }

  if (river) { const near = cities.filter((c) => c.site === 'river'); const t = near.length ? rng.pick(near) : anyCity(); E(0.34, 'flood', `The Great Flood of the ${river.name}`, `Spring meltwater sends the ${river.name} (“${river.en}”) over its banks. ${t.name} is swept away and rebuilt on higher ground; a chronicler counts the dead in the thousands.`, { river: 0, city: t.id }); }
  if (peak && range) E(0.42, 'mountain', `${peak.name} wakes`, `Rockfalls and ash from ${peak.name} (“${peak.en}”), the highest summit in the ${range.name}, bury the upland pastures for three summers. A road is cut through the pass afterwards.`, { peak: 0 });

  E(0.48, 'plague', `The ${rng.pick(PLAGUES)}`, `Brought by ${ports.length ? `ships at ${anyPort().name}` : 'caravans from the border'}, the sickness kills one ${st.regionTitle.toLowerCase()} dweller in ${rng.int(4, 7)}. Orchards go unpicked, and whole villages are never resettled.`, {});

  if (nb) E(0.55, 'war', `The ${rng.pick(WARS)} War`, `${nbName} (a ${nb.tongue} people to the ${nb.cx > g.centroid[0] ? 'east' : 'west'}) contests the border. After ${rng.int(3, 14)} years of raids, the Treaty of ${anyCity().name} fixes the frontier where it still runs.`, { neighbour: nb.id });
  else E(0.55, 'war', 'Raiders from the sea', `Ships out of the ${sea ? sea.name : 'fog'} burn ${anyPort().name} three summers running. The towns respond with towers and a standing fleet.`, {});

  E(0.62, 'golden', 'A golden age', `Under ${p()} ${rng.pick(EPITHETS)}, ${g.name} enjoys fifty years of peace. Trade in ${rng.pick(st.exports)} fills the ports, ${cities[1] ? cities[1].name : cap.name} gets its first stone walls, and the ${lang.feel} poets are written down for the first time.`, {});

  if (monarchy) { const [a, b] = [p(), p()]; E(0.7, 'civil', `The War of the Two Cousins`, `${st.rulerTitle === 'Queen' ? 'A queen' : 'A king'} dies without an heir. The houses of ${a} and ${b} fight for the crown until ${cities.length > 4 ? cities[3].name : cap.name} is besieged for a winter. ${b} is crowned in the spring.`, {}); }
  else E(0.7, 'civil', `The Winter Dissolution`, `A hard year of failed harvests splits the assembly. For eleven months two rival councils sit in ${cap.name} and in ${cities[1] ? cities[1].name : cap.name}, until a general strike forces a new settlement.`, {});

  const ch = anyCity();
  E(0.8, 'reform', monarchy ? `The Charter of ${ch.name}` : `The Constitution of ${ch.name}`, monarchy ? `Nobles and townsmen force the crown to accept ${st.assembly}, which must approve new taxes. The charter is read aloud in every market square each ${st.nationalDay.text.split(' ')[0]}.` : `Delegates from all ${g.regions.length} ${st.regionPlural.toLowerCase()} agree a constitution, creating ${st.assembly} and a ${st.rulerTitle.toLowerCase()} elected for a fixed term.`, { city: ch.id });
  if (g.rivers.length > 1 || g.roads.length) E(0.88, 'works', 'The great road is finished', `A paved road links ${cap.name} to ${cities[cities.length - 1].name}, the last link opening the whole of ${g.name} to a single market.`, {});
  E(0.94, 'national', 'The national day is proclaimed', `${st.nationalDay.text} is set aside to mark the founding of the state; flags, bells and ${st.nationalAnimal.en} banners fill the streets for the first time.`, {});
  E(1, 'present', `${st.rulerFull} takes office`, `${g.name} today is a ${st.governmentAdj} of ${g.population.toLocaleString('en-US')} people in ${g.regions.length} ${st.regionPlural.toLowerCase()}, led by ${st.rulerFull} from ${cap.name}.`, {});

  ev.sort((a, b) => a.order - b.order);
  let last = 0;
  const events = ev.map((e) => { let y = Math.round(e.order * now + (e.order > 0 && e.order < 1 ? (rng.next() - 0.5) * 30 : 0)); if (y <= last) y = last + rng.int(3, 12); if (e.order === 1) y = Math.max(y, now); last = y; return { year: y, kind: e.kind, title: e.title, text: e.text, refs: e.refs }; });
  const tail = events[events.length - 1]; tail.year = now;
  const houses = []; { let y = events[2] ? events[2].year : 100; const n = monarchy ? rng.int(2, 4) : rng.int(2, 3); for (let k = 0; k < n; k++) { const to = k === n - 1 ? now : Math.round(y + (now - y) / (n - k) * (0.7 + rng.next() * 0.6)); houses.push({ name: monarchy ? `House of ${lang.person()}` : `${lang.person()} Party`, from: y, to: Math.min(to, now) }); y = Math.min(to, now); } }
  return { now, era: 'R.', eraName: 'the Reckoning', events, houses, founder, foundingYear: events[2] ? events[2].year : 0 };
}
