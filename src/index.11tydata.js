const { isAnnualReport } = require("./lib/report-utils.cjs");

module.exports = {
  eleventyComputed: {
    latestReports: (data) => {
      const zenodo = Array.isArray(data.zenodo) ? data.zenodo : [];
      return zenodo
        .filter((item) => item?.kind === "zenodo" && item?.type === "report")
        .slice(0, 4)
        .map((item) => ({
          ...item,
          thumbnail250: item?.links?.thumbnails?.["250"] || "",
        }));
    },
    annualReportCount: (data) => {
      const zenodo = Array.isArray(data.zenodo) ? data.zenodo : [];
      return zenodo.filter((item) => isAnnualReport(item)).length;
    },
    latestAnnualReports: (data) => {
      const zenodo = Array.isArray(data.zenodo) ? data.zenodo : [];
      return zenodo
        .filter((item) => isAnnualReport(item))
        .sort((a, b) => (b?.published || "").localeCompare(a?.published || ""))
        .slice(0, 3)
        .map((item) => ({
          ...item,
          thumbnail250: item?.links?.thumbnails?.["250"] || "",
        }));
    },
  },
};
