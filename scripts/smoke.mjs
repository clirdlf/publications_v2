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

  console.log("Smoke OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
