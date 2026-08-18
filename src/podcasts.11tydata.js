const { podcastCards } = require("./lib/media-utils.cjs");

module.exports = {
  eleventyComputed: {
    podcastCards: (data) => podcastCards(data?.podcast),
  },
};
