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

module.exports = {
  getReports,
  isAnnualReport,
};
