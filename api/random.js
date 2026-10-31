'use strict';
const { cors, json } = require('./_util');
const { links, Worldscape } = require('../lib/render');

/** GET /api/random: a fresh random seed with the country's name and every link. Never cached. */
module.exports = (req, res) => {
  if (cors(req, res)) return;
  const seed = Worldscape.randomSeed(), c = Worldscape.generateCountry(seed);
  json(res, 200, { seed, name: c.geo.name, government: c.state.government, type: c.geo.type, capital: c.geo.cities[0].name, links: links(seed) });
};
