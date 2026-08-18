const { richTextToPlainText } = require("./content-utils.cjs");
const { isoDate, normalizeWhitespace, prettyDate, snippet } = require("./template-utils.cjs");

function mediaSlug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function podcastCards(records) {
  return (Array.isArray(records) ? records : []).map((episode) => {
    const slug = episode?.slug || mediaSlug(`${episode?.title || ""}-${episode?.pubDate || ""}`);
    return {
      ...episode,
      date: isoDate(episode?.pubDate),
      detailPath: `/items/podcast-${slug}/`,
      publishedLabel: prettyDate(episode?.pubDate),
      summary: snippet(normalizeWhitespace(richTextToPlainText(episode?.description)), 170),
    };
  });
}

function videoCards(records) {
  return (Array.isArray(records) ? records : []).map((video) => {
    const slug = video?.slug || mediaSlug(`${video?.title || ""}-${video?.videoId || ""}`);
    return {
      ...video,
      date: isoDate(video?.published),
      detailPath: `/items/video-${slug}/`,
      publishedLabel: prettyDate(video?.published),
      summary: snippet(normalizeWhitespace(video?.description), 170),
    };
  });
}

module.exports = { mediaSlug, podcastCards, videoCards };
