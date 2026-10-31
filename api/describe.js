'use strict';
const { cors, json } = require('./_util');
const { describe } = require('../lib/render');

/** GET /api/describe: valid options and limits, as JSON. */
module.exports = (req, res) => { if (cors(req, res)) return; json(res, 200, describe(), 'public, max-age=3600'); };
