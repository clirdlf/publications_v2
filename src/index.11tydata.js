const { isAnnualReport } = require("./lib/report-utils.cjs");

module.exports = {
  eleventyComputed: {
    latestReports: (data) => {
      const reports = Array.isArray(data.reports) ? data.reports : [];
      return reports
        .slice(0, 3)
        .map((item) => ({
          ...item,
          thumbnail250: item?.links?.thumbnails?.["250"] || "",
          thumbnail750: item?.links?.thumbnails?.["750"] || "",
        }));
    },
    annualReportCount: (data) => {
      const reports = Array.isArray(data.reports) ? data.reports : [];
      return reports.filter((item) => isAnnualReport(item)).length;
    },
    latestAnnualReports: (data) => {
      const reports = Array.isArray(data.reports) ? data.reports : [];
      return reports
        .filter((item) => isAnnualReport(item))
        .sort((a, b) => (b?.published || "").localeCompare(a?.published || ""))
        .slice(0, 3)
        .map((item) => ({
          ...item,
          thumbnail250: item?.links?.thumbnails?.["250"] || "",
          thumbnail750: item?.links?.thumbnails?.["750"] || "",
        }));
    },
  },
};
