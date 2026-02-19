import fs from "node:fs/promises";
import path from "node:path";
import MiniSearch from "minisearch";

const DATA_PATH = path.join(process.cwd(), "src", "_data", "zenodo.json");
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
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const items = JSON.parse(raw);

  const docs = items.map((r) => ({
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
