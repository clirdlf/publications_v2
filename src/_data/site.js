const configuredPathPrefix = process.env.PATH_PREFIX || "/";

module.exports = {
  title: "CLIR Publications",
  description: "CLIR Publications",
  url: (process.env.SITE_URL || "https://clirdlf.github.io/publications_v2/").replace(/\/+$/, ""),
  pathPrefix: configuredPathPrefix === "/"
    ? "/"
    : `/${configuredPathPrefix.replace(/^\/+|\/+$/g, "")}/`,
  google_analytics: process.env.GOOGLE_ANALYTICS_ID || "",
};
