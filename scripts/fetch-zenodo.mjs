import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const OUT_PATH = path.join(process.cwd(), "src", "_data", "zenodo.json");
const BASE = "https://zenodo.org/api/records";

const ZenodoFileSchema = z.object({
  key: z.string(),
  url: z.string(),
});

const ZenodoRecordSchema = z.object({
  kind: z.literal("zenodo"),
  zenodo_id: z.number().int().nonnegative(),
  title: z.string(),
  published: z.string(),
  description: z.string(),
  creators: z.array(z.string()),
  doi: z.string(),
  keywords: z.array(z.string()),
  type: z.string(),
  zenodo_html: z.string(),
  links: z.object({
    thumbnails: z.record(z.string(), z.string()),
  }),
  files: z.array(ZenodoFileSchema),
});

const ZenodoDatasetSchema = z.array(ZenodoRecordSchema);

// Load local .env for developer convenience, but don't require it in CI.
async function loadDotEnvIfPresent() {
  const envPath = path.join(process.cwd(), ".env");

  try {
    const raw = await fs.readFile(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue;

      const isQuoted =
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"));
      if (isQuoted && value.length >= 2) value = value.slice(1, -1);

      process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

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
  return "report"; // default for now since you're focused on reports
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

async function fetchPage(page, size, community, token) {
  if (!token && size > 25) {
    throw new Error("Zenodo API: unauthenticated requests must use size <= 25. Set ZENODO_TOKEN for larger page sizes.");
  }

  const url = new URL(BASE);
  // Use dedicated community filter arg to avoid query-string syntax issues.
  url.searchParams.set("communities", community);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(size));
  url.searchParams.set("sort", "mostrecent");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
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
  await loadDotEnvIfPresent();

  const community = process.env.ZENODO_COMMUNITY || "clir";
  const token = process.env.ZENODO_TOKEN || "";
  const requestedPageSize = Number(process.env.ZENODO_PAGE_SIZE || 25);
  const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
    ? Math.floor(requestedPageSize)
    : 25;

  const all = [];
  let page = 1;

  while (true) {
    const data = await fetchPage(page, pageSize, community, token);
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

  const validation = ZenodoDatasetSchema.safeParse(all);
  if (!validation.success) {
    const details = validation.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Normalized Zenodo data failed schema validation: ${details}`);
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(validation.data, null, 2), "utf8");

  console.log(`Fetched ${all.length} Zenodo records from community "${community}" -> ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
