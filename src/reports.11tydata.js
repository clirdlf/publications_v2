const { reportCards } = require("./lib/report-utils.cjs");

module.exports = {
  eleventyComputed: {
    reportCards: (data) => reportCards(data?.reports),
  },
};
