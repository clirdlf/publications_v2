import fs from "node:fs/promises";
import path from "node:path";
import MiniSearch from "minisearch";

const DATA_DIR = path.join(process.cwd(), "src", "_data");
const OUT_DIR = path.join(process.cwd(), "dist", "assets");
const OUT_PATH = path.join(OUT_DIR, "search-index.json");

function stripHtml(value) {
  if (!value) return "";
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const [items, podcasts, videos] = await Promise.all(
    ["zenodo.json", "podcast.json", "youtube.json"].map(async (filename) => {
      try {
        return JSON.parse(await fs.readFile(path.join(DATA_DIR, filename), "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
      }
    })
  );

  const reportDocs = items.map((r) => ({
    id: `zenodo-${r.zenodo_id}`,
    title: r.title || "",
    description: stripHtml(r.description || ""),
    creators: (r.creators || []).join("; "),
    keywords: (r.keywords || []).join("; "),
    published: r.published || "",
    type: r.type || "report",
    url: `/reports/zenodo-${r.zenodo_id}/`,
    searchable: [
      r.title || "",
      stripHtml(r.description || "").slice(0, 1200),
      (r.creators || []).join(" "),
      (r.keywords || []).join(" "),
    ]
      .join(" ")
      .toLowerCase()
  }));

  const slugify = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
  const mediaDocs = [
    ...podcasts.map((item) => ({
      id: `podcast-${item.id || item.slug || item.title}`,
      title: item.title || "",
      description: stripHtml(item.description || ""),
      creators: "Material Memory",
      keywords: `podcast audio${item.season ? ` season ${item.season}` : ""}`,
      published: item.pubDate || "",
      type: "podcast",
      url: `/items/podcast-${item.slug || slugify(`${item.title}-${item.pubDate}`)}/`
    })),
    ...videos.map((item) => ({
      id: `video-${item.videoId || item.slug || item.title}`,
      title: item.title || "",
      description: stripHtml(item.description || ""),
      creators: item.authorName || "CLIRDLF",
      keywords: "video webinar talk",
      published: item.published || "",
      type: "video",
      url: `/items/video-${item.slug || slugify(`${item.title}-${item.videoId}`)}/`
    }))
  ].map((doc) => ({ ...doc, searchable: [doc.title, doc.description.slice(0, 1200), doc.creators, doc.keywords].join(" ").toLowerCase() }));

  const docs = [...reportDocs, ...mediaDocs];

  const miniSearch = new MiniSearch({
    fields: ["title", "description", "creators", "keywords"],
    storeFields: ["title", "published", "type", "url"]
  });

  miniSearch.addAll(docs);

  const payload = {
    generatedAt: new Date().toISOString(),
    index: miniSearch.toJSON(),
    docs: docs.map(({ id, title, published, type, url, creators, keywords, searchable }) => ({
      id,
      title,
      published,
      type,
      url,
      creators,
      keywords,
      searchable
    }))
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(payload), "utf8");

  console.log(`Built search index -> ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
