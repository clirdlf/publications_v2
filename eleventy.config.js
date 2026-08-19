// eleventy.config.js (CommonJS is simplest with 11ty)
const path = require("path");
const fs = require("fs");
const Image = require("@11ty/eleventy-img");
const { isAnnualReport, isLegacyDeposit } = require("./src/lib/report-utils.cjs");
const {
  hasSubstantiveDescription,
  richTextToPlainText,
  scriptSafeJson,
} = require("./src/lib/content-utils.cjs");
const {
  absoluteUrl,
  fileType,
  hasSparseHero,
  isoDate,
  naturalCreators,
  normalizeWhitespace,
  prettyDate,
  snippet,
  year,
  yearOffset,
} = require("./src/lib/template-utils.cjs");
const configuredPathPrefix = process.env.PATH_PREFIX || "/";
const PATH_PREFIX = configuredPathPrefix === "/"
  ? "/"
  : `/${configuredPathPrefix.replace(/^\/+|\/+$/g, "")}/`;
const FAST_DEV_IMAGES =
  process.env.FAST_DEV_IMAGES === "1" ||
  process.argv.includes("--serve") ||
  process.env.ELEVENTY_RUN_MODE === "serve";

module.exports = function (eleventyConfig) {
  eleventyConfig.setNunjucksEnvironmentOptions({ autoescape: true });

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
    if (hasSvgSource || FAST_DEV_IMAGES) {
      const classAttr = className ? ` class="${escapeAttribute(className)}"` : "";
      return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="${escapeAttribute(loading)}" decoding="async"${classAttr}>`;
    }

    try {
      const metadata = await Image(src, {
        widths: normalizedWidths.length ? normalizedWidths : [320, 640, 960],
        formats: ["avif", "webp"],
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
        const classAttr = className ? ` class="${escapeAttribute(className)}"` : "";
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
      const classAttr = className ? ` class="${escapeAttribute(className)}"` : "";
      return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="${escapeAttribute(loading)}" decoding="async"${classAttr}>`;
    }
  }

  // Copy assets straight through
  eleventyConfig.addPassthroughCopy({
    "src/assets/images/clir-logo.png": "assets/images/clir-logo.png",
    "src/assets/images/CLIR-Pattern-1.jpg": "assets/images/CLIR-Pattern-1.jpg",
  });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/favicon": "assets/favicon" });
  eleventyConfig.addPassthroughCopy({
    "src/assets/fonts/Otto/ABCOtto-Regular.woff2": "assets/fonts/Otto/ABCOtto-Regular.woff2",
    "src/assets/fonts/Otto/ABCOtto-RegularItalic.woff2": "assets/fonts/Otto/ABCOtto-RegularItalic.woff2",
    "src/assets/fonts/Otto/ABCOtto-Bold.woff2": "assets/fonts/Otto/ABCOtto-Bold.woff2",
  });
  eleventyConfig.addPassthroughCopy({
    "src/assets/logos/CLIR-logo-bounded-red-hairline.svg": "assets/logos/CLIR-logo-bounded-red-hairline.svg",
  });
  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });

  // Useful: watch data files so changes trigger rebuild
  eleventyConfig.addWatchTarget("./src/_data/");
  eleventyConfig.addWatchTarget("./scripts/");
  eleventyConfig.addWatchTarget("./content/legacy-reports/", { resetConfig: true });

  const legacyContentRoot = path.join(__dirname, "content", "legacy-reports");
  const legacyPreviews = [];
  if (fs.existsSync(legacyContentRoot)) {
    for (const entry of fs.readdirSync(legacyContentRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[a-z0-9][a-z0-9-]*$/i.test(entry.name)) continue;
      const markdownPath = path.join(legacyContentRoot, entry.name, "report.md");
      const recipePath = path.join(legacyContentRoot, entry.name, "conversion.json");
      if (!fs.existsSync(markdownPath) || !fs.existsSync(recipePath)) continue;
      const recipe = JSON.parse(fs.readFileSync(recipePath, "utf8"));
      const title = recipe.title || entry.name;
      legacyPreviews.push({ slug: entry.name, title });
      eleventyConfig.addTemplate(
        `legacy-reports/${entry.name}.md`,
        fs.readFileSync(markdownPath, "utf8"),
        {
          layout: "legacy-report.njk",
          permalink: `/legacy-reports/${entry.name}/index.html`,
          title,
          legacySlug: entry.name,
          noindex: true,
          eleventyExcludeFromCollections: true,
        }
      );
    }
  }
  legacyPreviews.sort((a, b) => a.title.localeCompare(b.title));
  eleventyConfig.addGlobalData("legacyPreviews", legacyPreviews);

  // Filters
  eleventyConfig.addFilter("isoDate", isoDate);
  eleventyConfig.addFilter("year", year);
  eleventyConfig.addFilter("prettyDate", prettyDate);
  eleventyConfig.addFilter("naturalCreators", naturalCreators);
  eleventyConfig.addFilter("fileType", fileType);
  eleventyConfig.addFilter("hasSubstantiveDescription", hasSubstantiveDescription);
  eleventyConfig.addFilter("hasSparseHero", hasSparseHero);
  eleventyConfig.addFilter("isLegacyDeposit", isLegacyDeposit);
  eleventyConfig.addFilter("yearOffset", yearOffset);

  eleventyConfig.addFilter("firstFileUrl", (files) => {
    if (!Array.isArray(files) || files.length === 0) return "";
    return files[0]?.url || "";
  });

  eleventyConfig.addFilter("stripHtml", (value) => {
    return richTextToPlainText(value);
  });

  eleventyConfig.addFilter("normalizeWhitespace", normalizeWhitespace);
  eleventyConfig.addFilter("snippet", snippet);

  eleventyConfig.addFilter("json", (value) => {
    return scriptSafeJson(value);
  });

  eleventyConfig.addFilter("absoluteUrl", (value, baseUrl) => absoluteUrl(value, baseUrl, PATH_PREFIX));

  eleventyConfig.addFilter("annualReports", (records) => {
    const items = Array.isArray(records) ? records : [];
    return items
      .filter((item) => isAnnualReport(item))
      .sort((a, b) => (b?.published || "").localeCompare(a?.published || ""));
  });

  // Collections (example)
  eleventyConfig.addCollection("reports", (collectionApi) => {
    return collectionApi.eleventy?.globalData?.reports ?? [];
  });

  eleventyConfig.addCollection("annualReports", (collectionApi) => {
    const reports = collectionApi.eleventy?.globalData?.reports ?? [];
    return reports
      .filter((r) => isAnnualReport(r))
      .sort((a, b) => (b.published || "").localeCompare(a.published || ""));
  });

  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data"
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    pathPrefix: PATH_PREFIX,
  };
};
