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

  if (!(await exists(indexHtml))) {
    throw new Error("Smoke failed: dist/index.html missing (11ty build likely failed)");
  }
  if (!(await exists(searchIndex))) {
    throw new Error("Smoke failed: dist/assets/search-index.json missing (index step likely failed)");
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
