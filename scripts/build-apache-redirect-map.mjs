import fs from "node:fs/promises";
import path from "node:path";

const IN_PATH = path.join(process.cwd(), "src", "_data", "redirects.json");
const OUT_DIR = path.join(process.cwd(), "dist", "assets");
const OUT_PATH = path.join(OUT_DIR, "redirects.map");

async function main() {
  const raw = await fs.readFile(IN_PATH, "utf8");
  const redirects = JSON.parse(raw);

  // Produce a simple two-column map: "<from> <to>"
  const lines = [];
  for (const r of redirects) {
    const from = (r.from || "").trim();
    const to = (r.to || "").trim();
    if (!from || !to) continue;
    lines.push(`${from} ${to}`);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_PATH, lines.join("\n") + "\n", "utf8");

  console.log(`Wrote Apache redirects map -> ${OUT_PATH} (${lines.length} rules)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
