// eleventy.config.js (CommonJS is simplest with 11ty)
module.exports = function (eleventyConfig) {
  function isAnnualReport(record) {
    if (!record || record.kind !== "zenodo" || record.type !== "report") return false;

    const keywords = Array.isArray(record.keywords) ? record.keywords : [];
    const hasSeriesKeyword = keywords.some(
      (entry) => String(entry || "").toLowerCase() === "series:annual-report"
    );
    if (hasSeriesKeyword) return true;

    const title = String(record.title || "").toLowerCase();
    return title.includes("annual report");
  }

  // Copy assets straight through
  eleventyConfig.addPassthroughCopy({ "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/favicon": "assets/favicon" });

  // Useful: watch data files so changes trigger rebuild
  eleventyConfig.addWatchTarget("./src/_data/");
  eleventyConfig.addWatchTarget("./scripts/");

  // Filters
  eleventyConfig.addFilter("isoDate", (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  });

  eleventyConfig.addFilter("year", (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return String(d.getUTCFullYear());
  });

  eleventyConfig.addFilter("yearOffset", (value, offset = 0) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const parsedOffset = Number(offset) || 0;
    return String(d.getUTCFullYear() + parsedOffset);
  });

  eleventyConfig.addFilter("firstFileUrl", (files) => {
    if (!Array.isArray(files) || files.length === 0) return "";
    return files[0]?.url || "";
  });

  eleventyConfig.addFilter("stripHtml", (value) => {
    if (!value) return "";
    return String(value).replace(/<[^>]*>/g, " ");
  });

  eleventyConfig.addFilter("normalizeWhitespace", (value) => {
    if (!value) return "";
    return String(value).replace(/\s+/g, " ").trim();
  });

  eleventyConfig.addFilter("snippet", (value, length = 180) => {
    if (!value) return "";
    const max = Number(length) > 0 ? Number(length) : 180;
    const text = String(value).trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1).trimEnd()}…`;
  });

  eleventyConfig.addFilter("annualReports", (records) => {
    const items = Array.isArray(records) ? records : [];
    return items
      .filter((item) => isAnnualReport(item))
      .sort((a, b) => (b?.published || "").localeCompare(a?.published || ""));
  });

  // Collections (example)
  eleventyConfig.addCollection("reports", (collectionApi) => {
    // Build from data, not from files (we’ll render items via a template)
    const zenodo = collectionApi.eleventy?.globalData?.zenodo ?? [];
    return zenodo
      .filter((r) => r?.kind === "zenodo" && r?.type === "report")
      .sort((a, b) => (b.published || "").localeCompare(a.published || ""));
  });

  eleventyConfig.addCollection("annualReports", (collectionApi) => {
    const zenodo = collectionApi.eleventy?.globalData?.zenodo ?? [];
    return zenodo
      .filter((r) => isAnnualReport(r))
      .sort((a, b) => (b.published || "").localeCompare(a.published || ""));
  });

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
