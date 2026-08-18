import fs from "node:fs/promises";
import path from "node:path";

const dist = path.resolve(process.cwd(), "dist");
const expected = path.join(path.resolve(process.cwd()), "dist");

if (dist !== expected || path.basename(dist) !== "dist") {
  throw new Error(`Refusing to clean unexpected output path: ${dist}`);
}

await fs.rm(dist, { recursive: true, force: true });
console.log(`Cleaned ${dist}`);
