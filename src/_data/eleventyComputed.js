const { richTextToPlainText } = require("../lib/content-utils.cjs");

module.exports = {
  canonicalUrl: (data) => {
    if (!data?.site?.url || !data?.page?.url || data?.noindex) return "";
    const prefix = data.site.pathPrefix === "/"
      ? ""
      : String(data.site.pathPrefix || "").replace(/\/$/, "");
    return `${data.site.url}${prefix}${data.page.url}`;
  },
  ogUrl: (data) => data.canonicalUrl || "",
  description: (data) => {
    if (data?.description) return data.description;
    if (data?.item?.description) {
      const text = richTextToPlainText(data.item.description);
      return text.length > 160 ? `${text.slice(0, 159).trimEnd()}…` : text;
    }
    return "Research, Resources, and Media from the Council on Library and Information Resources.";
  },
};
