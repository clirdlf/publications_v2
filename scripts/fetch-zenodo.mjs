import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import contentUtils from "../src/lib/content-utils.cjs";

const { sanitizeHttpUrl } = contentUtils;

const OUT_PATH = path.join(process.cwd(), "src", "_data", "zenodo.json");
const BASE = "https://zenodo.org/api/records";

const NonEmptyString = z.string().trim().min(1);
const HttpUrl = z.url().refine((value) => /^https?:\/\//i.test(value), "Expected an HTTP(S) URL");
const PublicationDate = z.string().regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/, "Expected YYYY, YYYY-MM, or YYYY-MM-DD");
const Doi = z.string().regex(/^10\.\d{4,9}\/\S+$/i, "Expected a DOI");

const ZenodoFileSchema = z.object({
  key: NonEmptyString,
  url: HttpUrl,
});

const ZenodoCreatorSchema = z.object({
  name: NonEmptyString,
  orcid: z.string(),
  gnd: z.string(),
  affiliation: z.array(z.string()),
});

const ZenodoRelatedIdentifierSchema = z.object({
  identifier: z.string(),
  scheme: z.string(),
  relation: z.string(),
  resource_type: z.string(),
});

const ZenodoLicenseSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
});

const ZenodoFunderSchema = z.object({
  id: z.string(),
  name: z.string(),
  award_number: z.string(),
});

const ZenodoRecordSchema = z.object({
  kind: z.literal("zenodo"),
  zenodo_id: z.number().int().positive(),
  title: NonEmptyString,
  published: PublicationDate,
  description: z.string(),
  creators: z.array(NonEmptyString).min(1),
  creator_details: z.array(ZenodoCreatorSchema).min(1),
  doi: Doi,
  keywords: z.array(NonEmptyString),
  type: NonEmptyString,
  zenodo_html: z.union([z.literal(""), HttpUrl]),
  related_identifiers: z.array(ZenodoRelatedIdentifierSchema),
  license: ZenodoLicenseSchema,
  funders: z.array(ZenodoFunderSchema),
  communities: z.array(z.string()),
  links: z.object({
    thumbnails: z.record(z.string(), z.string()),
  }),
  files: z.array(ZenodoFileSchema).min(1),
});

const ZenodoDatasetSchema = z.array(ZenodoRecordSchema).superRefine((records, context) => {
  const seen = new Set();
  records.forEach((record, index) => {
    if (seen.has(record.zenodo_id)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate Zenodo record ID ${record.zenodo_id}`,
        path: [index, "zenodo_id"],
      });
    }
    seen.add(record.zenodo_id);
  });
});

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
    const safeUrl = sanitizeHttpUrl(url);
    if (!safeUrl) continue;
    thumbs[size] = safeUrl;
  }
  return thumbs;
}

function normalize(hit) {
  const md = hit.metadata || {};
  const keywords = md.keywords || [];
  const creators = Array.isArray(md.creators) ? md.creators : [];
  const relatedIdentifiers = Array.isArray(md.related_identifiers)
    ? md.related_identifiers
    : [];
  const funders = Array.isArray(md.funding)
    ? md.funding
    : Array.isArray(md.funders)
      ? md.funders
      : [];
  const communities = Array.isArray(md.communities) ? md.communities : [];

  const files = (hit.files || []).map(f => ({
    key: f.key || "",
    url: sanitizeHttpUrl(f.links?.self)
  }));

  return {
    kind: "zenodo",
    zenodo_id: hit.id,
    title: md.title || "",
    published: md.publication_date || "",
    description: md.description || "",
    creators: creators.map(c => c.name).filter(Boolean),
    creator_details: creators
      .filter((c) => isObject(c))
      .map((c) => ({
        name: c.name || "",
        orcid: c.orcid || "",
        gnd: c.gnd || "",
        affiliation: Array.isArray(c.affiliation)
          ? c.affiliation.filter(Boolean).map(String)
          : [],
      })),
    doi: md.doi || "",
    keywords,
    type: inferTypeFromKeywords(keywords),
    zenodo_html: sanitizeHttpUrl(hit.links?.html),
    related_identifiers: relatedIdentifiers
      .filter((id) => isObject(id))
      .map((id) => ({
        identifier: id.identifier || "",
        scheme: id.scheme || "",
        relation: id.relation || "",
        resource_type: id.resource_type || "",
      })),
    license: {
      id: isObject(md.license) ? md.license.id || "" : "",
      title: isObject(md.license) ? md.license.title || "" : "",
      url: isObject(md.license) ? sanitizeHttpUrl(md.license.url) : "",
    },
    funders: funders
      .filter((f) => isObject(f))
      .map((f) => ({
        id: f.id || "",
        name: f.name || "",
        award_number: f.award?.number || f.award_number || "",
      })),
    communities: communities
      .map((entry) =>
        isObject(entry)
          ? entry.id || entry.identifier || entry.slug || ""
          : ""
      )
      .filter(Boolean),
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

    for (const [index, h] of hits.entries()) {
      if (!isValidHit(h)) {
        throw new Error(`Zenodo returned a malformed record on page ${page} at offset ${index}`);
      }
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

export {
  ZenodoDatasetSchema,
  ZenodoFileSchema,
  ZenodoCreatorSchema,
  ZenodoRecordSchema,
  ZenodoRelatedIdentifierSchema,
  extractThumbnailPaths,
  inferTypeFromKeywords,
  isValidHit,
  main,
  normalize,
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
