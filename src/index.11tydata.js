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
  },
};
