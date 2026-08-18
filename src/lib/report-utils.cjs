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

module.exports = {
  getReports,
  isAnnualReport,
  isLegacyDeposit,
};
