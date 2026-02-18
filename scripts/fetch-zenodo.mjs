import fs from "node:fs/promises";
import path from "node:path";

const OUT_PATH = path.join(process.cwd(), "src", "_data", "zenodo.json");
const COMMUNITY = process.env.ZENODO_COMMUNITY || "clir";
const BASE = "https://zenodo.org/api/records";
const TOKEN = process.env.ZENODO_TOKEN || "";
const REQUESTED_PAGE_SIZE = Number(process.env.ZENODO_PAGE_SIZE || 25);

function isObject(value) {
  return typeof value === "object" && value !== null;
}

// Minimal runtime guard for Zenodo hit shape.
function isValidHit(hit) {
  return isObject(hit) && typeof hit.id === "number" && isObject(hit.metadata);
}

function inferTypeFromKeywords(keywords = []) {
  // You can tighten this later with your controlled vocabulary.
  // Example: keywords include "type:report"
  const typeTag = keywords.find(k => k.toLowerCase().startsWith("type:"));
  if (typeTag) return typeTag.split(":")[1]?.trim().toLowerCase() || "other";
  return "report"; // default for now since you’re focused on reports
}

function extractThumbnailPaths(links) {
  if (!isObject(links)) return {};
  const source = isObject(links.thumbnails)
    ? links.thumbnails
    : isObject(links.thumbs)
      ? links.thumbs
      : null;
  if (!source) return {};

  const thumbs = {};
  for (const [size, url] of Object.entries(source)) {
    if (typeof url !== "string" || url.length === 0) continue;
    thumbs[size] = url;
  }
  return thumbs;
}

function normalize(hit) {
  const md = hit.metadata || {};
  const keywords = md.keywords || [];

  const files = (hit.files || []).map(f => ({
    key: f.key || "",
    url: f.links?.self || ""
  }));

  return {
    kind: "zenodo",
    zenodo_id: hit.id,
    title: md.title || "",
    published: md.publication_date || "",
    description: md.description || "",
    creators: (md.creators || []).map(c => c.name).filter(Boolean),
    doi: md.doi || "",
    keywords,
    type: inferTypeFromKeywords(keywords),
    zenodo_html: hit.links?.html || "",
    links: {
      thumbnails: extractThumbnailPaths(hit.links)
    },
    files
  };
}

async function fetchPage(page, size = 100) {
  if (!TOKEN && size > 25) {
    throw new Error("Zenodo API: unauthenticated requests must use size <= 25. Set ZENODO_TOKEN for larger page sizes.");
  }

  const url = new URL(BASE);
  // Use dedicated community filter arg to avoid query-string syntax issues.
  url.searchParams.set("communities", COMMUNITY);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(size));
  url.searchParams.set("sort", "mostrecent");

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
    }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Zenodo fetch failed: ${res.status} ${res.statusText} | URL: ${url.toString()} | Body: ${body}`
    );
  }
  return res.json();
}

async function main() {
  const pageSize = Number.isFinite(REQUESTED_PAGE_SIZE) && REQUESTED_PAGE_SIZE > 0
    ? Math.floor(REQUESTED_PAGE_SIZE)
    : 25;

  const all = [];
  let page = 1;

  while (true) {
    const data = await fetchPage(page, pageSize);
    const hits = data?.hits?.hits || [];
    if (hits.length === 0) break;

    for (const h of hits) {
      if (!isValidHit(h)) continue; // skip malformed items
      all.push(normalize(h));
    }

    const rawTotal = data?.hits?.total;
    const total =
      typeof rawTotal === "number"
        ? rawTotal
        : typeof rawTotal?.value === "number"
          ? rawTotal.value
          : all.length;
    if (all.length >= total) break;
    page += 1;
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(all, null, 2), "utf8");

  console.log(`Fetched ${all.length} Zenodo records from community "${COMMUNITY}" -> ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
