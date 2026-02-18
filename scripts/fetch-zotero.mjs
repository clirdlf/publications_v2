import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const OUT_PATH = path.join(process.cwd(), "src", "_data", "zenodo.json");
const COMMUNITY = process.env.ZENODO_COMMUNITY || "clir";
const BASE = "https://zenodo.org/api/records";

// Minimal schema for safety. Zenodo fields vary.
const ZenodoHitSchema = z.object({
  id: z.number(),
  metadata: z.object({
    title: z.string().optional(),
    publication_date: z.string().optional(),
    description: z.string().optional(),
    creators: z.array(z.object({ name: z.string().optional() })).optional(),
    doi: z.string().optional(),
    keywords: z.array(z.string()).optional()
  }).passthrough(),
  links: z.object({
    html: z.string().optional()
  }).passthrough().optional(),
  files: z.array(z.object({
    key: z.string().optional(),
    links: z.object({
      self: z.string().optional()
    }).passthrough().optional()
  }).passthrough()).optional()
}).passthrough();

function inferTypeFromKeywords(keywords = []) {
  // You can tighten this later with your controlled vocabulary.
  // Example: keywords include "type:report"
  const typeTag = keywords.find(k => k.toLowerCase().startsWith("type:"));
  if (typeTag) return typeTag.split(":")[1]?.trim().toLowerCase() || "other";
  return "report"; // default for now since you’re focused on reports
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
    files
  };
}

async function fetchPage(page, size = 100) {
  const url = new URL(BASE);
  // community filter
  url.searchParams.set("q", `communities:${COMMUNITY}`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(size));
  url.searchParams.set("sort", "mostrecent");

  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" }
  });

  if (!res.ok) {
    throw new Error(`Zenodo fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function main() {
  const all = [];
  let page = 1;

  while (true) {
    const data = await fetchPage(page);
    const hits = data?.hits?.hits || [];
    if (hits.length === 0) break;

    for (const h of hits) {
      const parsed = ZenodoHitSchema.safeParse(h);
      if (!parsed.success) continue; // skip malformed items
      all.push(normalize(parsed.data));
    }

    const total = data?.hits?.total ?? all.length;
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
