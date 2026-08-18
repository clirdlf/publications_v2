import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { getReports, isAnnualReport, isLegacyDeposit } = require("../src/lib/report-utils.cjs");

describe("getReports", () => {
  it("returns only reports in newest-first order without mutating the input", () => {
    const records = [
      { kind: "zenodo", type: "report", zenodo_id: 1, published: "2020-01-01" },
      { kind: "zenodo", type: "video", zenodo_id: 2, published: "2025-01-01" },
      { kind: "zenodo", type: "report", zenodo_id: 3, published: "2024-01-01" },
    ];

    expect(getReports(records).map((record) => record.zenodo_id)).toEqual([3, 1]);
    expect(records.map((record) => record.zenodo_id)).toEqual([1, 2, 3]);
  });
});

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

describe("isLegacyDeposit", () => {
  it("identifies recent records that use the legacy Zenodo ID range", () => {
    expect(isLegacyDeposit({ zenodo_id: 9_999_999, published: "2023-01-01" })).toBe(true);
    expect(isLegacyDeposit({ zenodo_id: 10_000_000, published: "2023-01-01" })).toBe(false);
    expect(isLegacyDeposit({ zenodo_id: 9_999_999, published: "2022-12-31" })).toBe(false);
  });
});
