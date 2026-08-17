const configuredPathPrefix = process.env.PATH_PREFIX || "/";

module.exports = {
  title: "CLIR Publications",
  description: "CLIR Publications",
  url: (process.env.SITE_URL || "https://publications.clir.org").replace(/\/+$/, ""),
  pathPrefix: configuredPathPrefix === "/"
    ? "/"
    : `/${configuredPathPrefix.replace(/^\/+|\/+$/g, "")}/`,
  google_analytics: process.env.GOOGLE_ANALYTICS_ID || "",
};
