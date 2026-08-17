import fs from "node:fs/promises";
import path from "node:path";

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const dist = path.join(process.cwd(), "dist");
  const indexHtml = path.join(dist, "index.html");
  const searchIndex = path.join(dist, "assets", "search-index.json");
  const notFoundHtml = path.join(dist, "404.html");
  const robotsTxt = path.join(dist, "robots.txt");
  const sitemapXml = path.join(dist, "sitemap.xml");
  const cname = path.join(dist, "CNAME");

  if (!(await exists(indexHtml))) {
    throw new Error("Smoke failed: dist/index.html missing (11ty build likely failed)");
  }
  if (!(await exists(searchIndex))) {
    throw new Error("Smoke failed: dist/assets/search-index.json missing (index step likely failed)");
  }
  for (const requiredPath of [notFoundHtml, robotsTxt, sitemapXml, cname]) {
    if (!(await exists(requiredPath))) {
      throw new Error(`Smoke failed: required launch artifact missing (${requiredPath})`);
    }
  }

  const renderedHome = await fs.readFile(indexHtml, "utf8");
  if (!renderedHome.includes('rel="canonical" href="https://publications.clir.org/"')) {
    throw new Error("Smoke failed: homepage production canonical is missing or incorrect");
  }
  if (/UA-XXXXXXXXX-X|googletagmanager\.com/.test(renderedHome)) {
    throw new Error("Smoke failed: placeholder or unconfigured analytics rendered");
  }

  const renderedNotFound = await fs.readFile(notFoundHtml, "utf8");
  if (!renderedNotFound.includes('name="robots" content="noindex,follow"')) {
    throw new Error("Smoke failed: 404 page is missing its noindex directive");
  }

  const renderedSitemap = await fs.readFile(sitemapXml, "utf8");
  if (!renderedSitemap.includes("https://publications.clir.org/reports/")) {
    throw new Error("Smoke failed: sitemap does not use the production origin");
  }

  const rawSearchIndex = await fs.readFile(searchIndex, "utf8");
  const payload = JSON.parse(rawSearchIndex);
  const docs = Array.isArray(payload?.docs) ? payload.docs : [];
  if (docs.length === 0) {
    throw new Error("Smoke failed: search index has no docs");
  }

  const firstDocUrl = String(docs[0]?.url || "");
  if (!firstDocUrl.startsWith("/reports/zenodo-")) {
    throw new Error(`Smoke failed: unexpected search doc URL format (${firstDocUrl || "empty"})`);
  }

  const normalizedPath = firstDocUrl.replace(/^\/+/, "");
  const firstDocIndexHtml = path.join(dist, normalizedPath, "index.html");
  if (!(await exists(firstDocIndexHtml))) {
    throw new Error(`Smoke failed: search doc URL target missing (${firstDocIndexHtml})`);
  }

  console.log("Smoke OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
