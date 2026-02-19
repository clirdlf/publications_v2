import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const testDirPrefix = path.join(os.tmpdir(), "publications-v2-test-");
const createdDirs = [];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repoRoot, "scripts", "build-search-index.mjs");

async function createWorkspace() {
  const workspace = await fs.mkdtemp(testDirPrefix);
  createdDirs.push(workspace);
  await fs.mkdir(path.join(workspace, "src", "_data"), { recursive: true });
  await fs.mkdir(path.join(workspace, "dist", "assets"), { recursive: true });
  return workspace;
}

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe("build-search-index contract", () => {
  it("writes docs with report item URLs and required fields", async () => {
    const workspace = await createWorkspace();

    const sample = [
      {
        kind: "zenodo",
        zenodo_id: 987,
        title: "Stable Systems Report",
        published: "2024-06-01",
        description: "<p>Detailed report body</p>",
        creators: ["A. Author"],
        keywords: ["type:report", "topic:stability"],
        type: "report",
      },
    ];

    await fs.writeFile(
      path.join(workspace, "src", "_data", "zenodo.json"),
      JSON.stringify(sample, null, 2),
      "utf8"
    );

    await execFile("node", [scriptPath], { cwd: workspace });

    const outputPath = path.join(workspace, "dist", "assets", "search-index.json");
    const output = JSON.parse(await fs.readFile(outputPath, "utf8"));

    expect(Array.isArray(output.docs)).toBe(true);
    expect(output.docs.length).toBe(1);
    expect(output.docs[0].id).toBe("zenodo-987");
    expect(output.docs[0].title).toBe("Stable Systems Report");
    expect(output.docs[0].url).toBe("/reports/zenodo-987/");
    expect(output.docs[0].searchable).toContain("stable systems report");
  });
});
