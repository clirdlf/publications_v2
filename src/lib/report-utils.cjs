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

function getReports(records) {
  return (Array.isArray(records) ? records : [])
    .filter((record) => record?.kind === "zenodo" && record?.type === "report")
    .sort((a, b) => String(b?.published || "").localeCompare(String(a?.published || "")));
}

function isLegacyDeposit(item) {
  if (!item || Number(item.zenodo_id) >= 10_000_000) return false;
  const publicationYear = Number(String(item.published || "").slice(0, 4));
  return publicationYear >= 2023;
}

function reportCards(records) {
  return (Array.isArray(records) ? records : []).map((report) => {
    const authors = Array.isArray(report?.creators) ? report.creators.filter(Boolean).join(", ") : "";
    const summaryText = normalizeWhitespace(richTextToPlainText(report?.description));
    const thumbnails = report?.links?.thumbnails || {};
    const thumbnail250 = thumbnails["250"] || thumbnails["100"] || "";

    return {
      ...report,
      authors,
      categories: Array.isArray(report?.keywords) ? report.keywords.filter(Boolean).join("|") : "",
      detailPath: `/reports/zenodo-${report?.zenodo_id}/`,
      searchableText: normalizeWhitespace(`${report?.title || ""} ${authors} ${summaryText}`),
      summary: snippet(summaryText, 190),
      thumbnail250,
      thumbnail750: thumbnails["750"] || thumbnail250,
    };
  });
}

module.exports = {
  getReports,
  isAnnualReport,
  isLegacyDeposit,
  reportCards,
};
const { richTextToPlainText } = require("./content-utils.cjs");
const { normalizeWhitespace, snippet } = require("./template-utils.cjs");
