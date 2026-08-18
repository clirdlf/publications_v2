import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import contentUtils from "../src/lib/content-utils.cjs";

const { sanitizeHttpUrl } = contentUtils;

const FEED_URL = "https://feeds.libsyn.com/229370/rss";
const OUT_PATH = path.join(process.cwd(), "src", "_data", "podcast.json");

function stripCdata(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .trim();
}

export function decodeXmlEntities(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&");
}

function extractTag(xml, tagName) {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(pattern);
  if (!match) return "";
  return decodeXmlEntities(stripCdata(match[1]));
}

function extractSelfClosingTagAttr(xml, tagName, attrName) {
  const pattern = new RegExp(`<${tagName}[^>]*\\s${attrName}="([^"]+)"[^>]*/?>`, "i");
  const match = xml.match(pattern);
  if (!match) return "";
  return decodeXmlEntities(match[1].trim());
}

export function slugifyMedia(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

export function plainText(value) {
  return decodeXmlEntities(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractItems(xml) {
  const channelImage = extractSelfClosingTagAttr(xml, "itunes:image", "href");
  const itemPattern = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  const items = [];
  let match;

  while ((match = itemPattern.exec(xml)) !== null) {
    const rawItem = match[1];
    const imageFromImageTagMatch = rawItem.match(/<image\b[^>]*>\s*<url>([\s\S]*?)<\/url>\s*<\/image>/i);
    const imageFromImageTag = imageFromImageTagMatch
      ? decodeXmlEntities(stripCdata(imageFromImageTagMatch[1]))
      : "";
    const image =
      extractSelfClosingTagAttr(rawItem, "itunes:image", "href") ||
      imageFromImageTag ||
      channelImage;

    const title = plainText(extractTag(rawItem, "title"));
    const pubDate = extractTag(rawItem, "pubDate");
    const guid = plainText(extractTag(rawItem, "guid"));
    const canonicalUrl = extractTag(rawItem, "link");
    const season = plainText(extractTag(rawItem, "itunes:season"));
    const episode = plainText(extractTag(rawItem, "itunes:episode"));
    const identity = guid || canonicalUrl || `${title}-${pubDate}`;

    items.push({
      id: identity,
      slug: slugifyMedia(`${title}-${pubDate}`),
      title,
      pubDate,
      description: plainText(extractTag(rawItem, "description")),
      canonicalUrl: sanitizeHttpUrl(canonicalUrl),
      enclosureUrl: sanitizeHttpUrl(extractSelfClosingTagAttr(rawItem, "enclosure", "url")),
      enclosureType: extractSelfClosingTagAttr(rawItem, "enclosure", "type") || "audio/mpeg",
      duration: extractTag(rawItem, "itunes:duration"),
      season,
      episode,
      image: sanitizeHttpUrl(image)
    });
  }

  return items;
}

export async function main() {
  const response = await fetch(FEED_URL, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8" }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Podcast feed request failed: ${response.status} ${response.statusText} | Body: ${body}`);
  }

  const xml = await response.text();
  const items = extractItems(xml);

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(items, null, 2), "utf8");

  console.log(`Fetched ${items.length} podcast episodes -> ${OUT_PATH}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
