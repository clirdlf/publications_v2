// eleventy.config.js (CommonJS is simplest with 11ty)
const path = require("path");
const Image = require("@11ty/eleventy-img");
const { isAnnualReport } = require("./src/lib/report-utils.cjs");
const PATH_PREFIX = "/publications_v2/";

module.exports = function (eleventyConfig) {
  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function imageShortcode(
    src,
    alt = "",
    sizes = "100vw",
    widths = [320, 640, 960],
    className = "",
    loading = "lazy"
  ) {
    if (!src) return "";

    const normalizedWidths = Array.isArray(widths)
      ? widths
      : String(widths || "")
          .split(",")
          .map((value) => Number(String(value).trim()))
          .filter((value) => Number.isFinite(value) && value > 0);

    const hasSvgSource = /\.svg(\?|$)/i.test(String(src));
    if (hasSvgSource) {
      const classAttr = className ? ` class="${className}"` : "";
      return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="${escapeAttribute(loading)}" decoding="async"${classAttr}>`;
    }

    try {
      const metadata = await Image(src, {
        widths: normalizedWidths.length ? normalizedWidths : [320, 640, 960],
        formats: ["avif", "webp", "jpeg"],
        urlPath: `${PATH_PREFIX}assets/images/generated/`,
        outputDir: path.join(__dirname, "dist/assets/images/generated"),
        filenameFormat: (id, source, width, format) => {
          const basename = path.basename(String(source)).replace(/[^\w.-]/g, "-");
          return `${basename}-${id}-${width}w.${format}`;
        },
        sharpOptions: {
          animated: true,
        },
      });

      if (!metadata) {
        const classAttr = className ? ` class="${className}"` : "";
        return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="${escapeAttribute(loading)}" decoding="async"${classAttr}>`;
      }

      const imageAttributes = {
        alt,
        sizes,
        loading,
        decoding: "async",
      };

      if (className) imageAttributes.class = className;

      return Image.generateHTML(metadata, imageAttributes);
    } catch (error) {
      const classAttr = className ? ` class="${className}"` : "";
      return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="${escapeAttribute(loading)}" decoding="async"${classAttr}>`;
    }
  }

  // Copy assets straight through
  eleventyConfig.addPassthroughCopy({ "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy({ "src/assets/images": "assets/images" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/fonts": "assets/favicon" });
  eleventyConfig.addPassthroughCopy({ "src/assets/fonts": "assets/fonts" });
  eleventyConfig.addPassthroughCopy({ "src/assets/logos": "assets/logos" });

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

  eleventyConfig.addFilter("prettyDate", (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
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

  eleventyConfig.addFilter("json", (value) => {
    return JSON.stringify(value);
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

  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    pathPrefix: PATH_PREFIX,
  };
};
