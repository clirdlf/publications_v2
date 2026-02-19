import fs from "node:fs/promises";
import path from "node:path";

const FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCTlqPVhBqGnyKsebb3mjA0Q";
const OUT_PATH = path.join(process.cwd(), "src", "_data", "youtube.json");

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  const safeTag = escapeRegExp(tagName);
  const pattern = new RegExp(`<${safeTag}>([\\s\\S]*?)<\\/${safeTag}>`, "i");
  const match = xml.match(pattern);
  if (!match) return "";
  return decodeXmlEntities(stripCdata(match[1]));
}

function extractSelfClosingTagAttr(xml, tagName, attrName) {
  const safeTag = escapeRegExp(tagName);
  const safeAttr = escapeRegExp(attrName);
  const pattern = new RegExp(`<${safeTag}[^>]*\\s${safeAttr}="([^"]+)"[^>]*/?>`, "i");
  const match = xml.match(pattern);
  if (!match) return "";
  return decodeXmlEntities(match[1].trim());
}

function extractEntries(xml) {
  const entryPattern = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  const entries = [];
  let match;

  while ((match = entryPattern.exec(xml)) !== null) {
    const rawEntry = match[1];
    const authorMatch = rawEntry.match(/<author>([\s\S]*?)<\/author>/i);
    const authorXml = authorMatch ? authorMatch[1] : "";

    entries.push({
      id: extractTag(rawEntry, "id"),
      videoId: extractTag(rawEntry, "yt:videoId"),
      channelId: extractTag(rawEntry, "yt:channelId"),
      title: extractTag(rawEntry, "title"),
      link: extractSelfClosingTagAttr(rawEntry, "link", "href"),
      published: extractTag(rawEntry, "published"),
      updated: extractTag(rawEntry, "updated"),
      authorName: extractTag(authorXml, "name"),
      authorUri: extractTag(authorXml, "uri"),
      description: extractTag(rawEntry, "media:description"),
      thumbnail: extractSelfClosingTagAttr(rawEntry, "media:thumbnail", "url")
    });
  }

  return entries;
}

async function main() {
  const response = await fetch(FEED_URL, {
    headers: { Accept: "application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8" }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`YouTube feed request failed: ${response.status} ${response.statusText} | Body: ${body}`);
  }

  const xml = await response.text();
  const entries = extractEntries(xml);

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(entries, null, 2), "utf8");

  console.log(`Fetched ${entries.length} YouTube videos -> ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
