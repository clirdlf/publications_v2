import fs from "node:fs/promises";
import path from "node:path";

const FEED_URL = "https://feeds.libsyn.com/229370/rss";
const OUT_PATH = path.join(process.cwd(), "src", "_data", "podcast.json");

function stripCdata(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .trim();
}

function decodeXmlEntities(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
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

function extractItems(xml) {
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

    items.push({
      title: extractTag(rawItem, "title"),
      pubDate: extractTag(rawItem, "pubDate"),
      description: extractTag(rawItem, "description"),
      enclosureUrl: extractSelfClosingTagAttr(rawItem, "enclosure", "url"),
      duration: extractTag(rawItem, "itunes:duration"),
      image
    });
  }

  return items;
}

async function main() {
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
