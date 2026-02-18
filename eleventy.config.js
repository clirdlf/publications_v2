// eleventy.config.js (CommonJS is simplest with 11ty)
module.exports = function (eleventyConfig) {
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

  eleventyConfig.addFilter("firstFileUrl", (files) => {
    if (!Array.isArray(files) || files.length === 0) return "";
    return files[0]?.url || "";
  });

  // Collections (example)
  eleventyConfig.addCollection("reports", (collectionApi) => {
    // Build from data, not from files (we’ll render items via a template)
    const zenodo = collectionApi.eleventy?.globalData?.zenodo ?? [];
    return zenodo
      .filter((r) => r?.kind === "zenodo" && r?.type === "report")
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
