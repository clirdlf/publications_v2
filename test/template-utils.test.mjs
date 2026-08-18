import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  absoluteUrl,
  fileType,
  hasSparseHero,
  isoDate,
  naturalCreators,
  normalizeWhitespace,
  prettyDate,
  snippet,
  year,
  yearOffset,
} = require("../src/lib/template-utils.cjs");

describe("date filters", () => {
  it("formats dates in UTC and rejects invalid input", () => {
    expect(isoDate("2025-02-03T23:00:00-05:00")).toBe("2025-02-04");
    expect(prettyDate("2025-02-03")).toBe("February 3, 2025");
    expect(year("2025-02-03")).toBe("2025");
    expect(yearOffset("2025-02-03", -1)).toBe("2024");
    expect(isoDate("not-a-date")).toBe("");
  });
});

describe("naturalCreators", () => {
  it("normalizes simple inverted names and produces a natural list", () => {
    expect(naturalCreators(["Lovelace, Ada", "Hopper, Grace", "Turing, Alan"]))
      .toBe("Ada Lovelace, Grace Hopper, and Alan Turing");
  });

  it("does not reinterpret names with multiple commas", () => {
    expect(naturalCreators(["Smith, John, Jr."])).toBe("Smith, John, Jr.");
  });
});

describe("text and path filters", () => {
  it("handles filenames, snippets, whitespace, URLs, and hero classification", () => {
    expect(fileType("report.PDF?download=1")).toBe("PDF");
    expect(fileType("README")).toBe("FILE");
    expect(normalizeWhitespace(" a\n  b ")).toBe("a b");
    expect(snippet("abcdef", 4)).toBe("abc…");
    expect(absoluteUrl("reports/", "https://example.test/", "/pubs/")).toBe("https://example.test/pubs/reports/");
    expect(hasSparseHero({ title: "A short title" })).toBe(true);
    expect(hasSparseHero({ title: "" })).toBe(false);
  });
});
