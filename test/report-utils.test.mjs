import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { isAnnualReport } = require("../src/lib/report-utils.cjs");

describe("isAnnualReport", () => {
  it("returns true when report has annual-report keyword", () => {
    const value = isAnnualReport({
      kind: "zenodo",
      type: "report",
      keywords: ["series:annual-report"],
      title: "Not needed",
    });

    expect(value).toBe(true);
  });

  it("returns true when title fallback matches", () => {
    const value = isAnnualReport({
      kind: "zenodo",
      type: "report",
      keywords: [],
      title: "CLIR Annual Report 2024",
    });

    expect(value).toBe(true);
  });

  it("returns false for non-report records", () => {
    const value = isAnnualReport({
      kind: "zenodo",
      type: "video",
      keywords: ["series:annual-report"],
      title: "Annual Report video",
    });

    expect(value).toBe(false);
  });
});
