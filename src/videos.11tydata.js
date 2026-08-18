const { videoCards } = require("./lib/media-utils.cjs");

module.exports = {
  eleventyComputed: {
    videoCards: (data) => videoCards(data?.youtube),
  },
};
