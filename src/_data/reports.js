const zenodo = require("./zenodo.json");
const { getReports } = require("../lib/report-utils.cjs");

module.exports = getReports(zenodo);
