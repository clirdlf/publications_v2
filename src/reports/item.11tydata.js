function stripHtml(value) {
  if (!value) return "";
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function compact(value) {
  if (Array.isArray(value)) {
    const entries = value
      .map((entry) => compact(entry))
      .filter((entry) => {
        if (entry === null || entry === undefined || entry === "") return false;
        if (Array.isArray(entry) && entry.length === 0) return false;
        if (
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          Object.keys(entry).length === 0
        ) {
          return false;
        }
        return true;
      });
    return entries;
  }

  if (typeof value === "object" && value !== null) {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      const next = compact(entry);
      if (next === null || next === undefined || next === "") continue;
      if (Array.isArray(next) && next.length === 0) continue;
      if (
        typeof next === "object" &&
        !Array.isArray(next) &&
        Object.keys(next).length === 0
      ) {
        continue;
      }
      output[key] = next;
    }
    return output;
  }

  return value;
}

module.exports = {
  eleventyComputed: {
    reportJsonLd: (data) => {
      const item = data?.item;
      if (!item || item.kind !== "zenodo" || item.type !== "report") return null;

      const doiUrl = item?.doi ? `https://doi.org/${item.doi}` : "";
      const thumbnail =
        item?.links?.thumbnails?.["750"] ||
        item?.links?.thumbnails?.["250"] ||
        item?.links?.thumbnails?.["100"] ||
        "";
      const primaryFile = item?.files?.[0]?.url || "";

      const authors =
        Array.isArray(item?.creator_details) && item.creator_details.length
          ? item.creator_details.map((creator) =>
              compact({
                "@type": "Person",
                name: creator?.name || "",
                sameAs: creator?.orcid
                  ? `https://orcid.org/${String(creator.orcid).replace(/^https?:\/\/orcid\.org\//, "")}`
                  : "",
                affiliation: Array.isArray(creator?.affiliation)
                  ? creator.affiliation.map((name) => ({
                      "@type": "Organization",
                      name,
                    }))
                  : [],
              })
            )
          : (item?.creators || []).map((name) => ({
              "@type": "Person",
              name,
            }));

      const identifiers = [
        item?.doi
          ? {
              "@type": "PropertyValue",
              propertyID: "DOI",
              value: item.doi,
            }
          : null,
        item?.zenodo_id
          ? {
              "@type": "PropertyValue",
              propertyID: "Zenodo",
              value: String(item.zenodo_id),
            }
          : null,
      ].filter(Boolean);

      const related = Array.isArray(item?.related_identifiers)
        ? item.related_identifiers
            .filter((entry) => entry?.identifier)
            .map((entry) =>
              compact({
                "@type": "CreativeWork",
                identifier: entry.identifier,
                url:
                  entry.scheme && String(entry.scheme).toLowerCase() === "doi"
                    ? `https://doi.org/${entry.identifier}`
                    : "",
                additionalType: entry.resource_type || "",
              })
            )
        : [];

      return compact({
        "@context": "https://schema.org",
        "@type": "Report",
        "@id": item?.zenodo_html || doiUrl || "",
        name: item?.title || "",
        headline: item?.title || "",
        description: stripHtml(item?.description || ""),
        datePublished: item?.published || "",
        url: item?.zenodo_html || doiUrl || "",
        sameAs: doiUrl || "",
        author: authors,
        publisher: {
          "@type": "Organization",
          name: "Council on Library and Information Resources",
          alternateName: "CLIR",
          url: "https://www.clir.org",
        },
        identifier: identifiers,
        image: thumbnail || "",
        encoding: primaryFile
          ? {
              "@type": "MediaObject",
              contentUrl: primaryFile,
            }
          : null,
        license: item?.license?.url || "",
        citation: related,
        keywords: Array.isArray(item?.keywords) ? item.keywords : [],
      });
    },
  },
};
