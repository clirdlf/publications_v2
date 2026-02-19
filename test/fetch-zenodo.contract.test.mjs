import { describe, expect, it } from "vitest";
import {
  ZenodoDatasetSchema,
  inferTypeFromKeywords,
  isValidHit,
  normalize,
} from "../scripts/fetch-zenodo.mjs";

function buildHit(overrides = {}) {
  return {
    id: 12345,
    metadata: {
      title: "Test report",
      publication_date: "2025-01-15",
      description: "<p>desc</p>",
      creators: [{ name: "Jane Doe" }],
      doi: "10.5281/zenodo.12345",
      keywords: ["type:report", "series:annual-report"],
      ...(overrides.metadata || {}),
    },
    files: [
      {
        key: "test.pdf",
        links: { self: "https://zenodo.org/api/records/12345/files/test.pdf/content" },
      },
    ],
    links: {
      html: "https://zenodo.org/records/12345",
      thumbnails: {
        250: "https://zenodo.org/thumb-250.jpg",
      },
      ...(overrides.links || {}),
    },
    ...(overrides.root || {}),
  };
}

describe("fetch-zenodo normalization contract", () => {
  it("normalizes a valid hit and passes schema validation", () => {
    const hit = buildHit();
    expect(isValidHit(hit)).toBe(true);

    const normalized = normalize(hit);
    const parsed = ZenodoDatasetSchema.safeParse([normalized]);

    expect(parsed.success).toBe(true);
    expect(normalized.type).toBe("report");
    expect(normalized.files[0].key).toBe("test.pdf");
    expect(normalized.links.thumbnails["250"]).toBeTruthy();
    expect(Array.isArray(normalized.creator_details)).toBe(true);
    expect(Array.isArray(normalized.related_identifiers)).toBe(true);
  });

  it("falls back to type report when no type keyword is present", () => {
    const type = inferTypeFromKeywords(["series:annual-report", "topic:preservation"]);
    expect(type).toBe("report");
  });

  it("parses type keyword when present", () => {
    const type = inferTypeFromKeywords(["type:video"]);
    expect(type).toBe("video");
  });

  it("preserves linked-data oriented creator and related identifier fields", () => {
    const hit = buildHit({
      metadata: {
        creators: [
          {
            name: "Jane Doe",
            orcid: "0000-0002-1825-0097",
            affiliation: ["CLIR"],
          },
        ],
        related_identifiers: [
          {
            identifier: "10.1000/example",
            scheme: "doi",
            relation: "isSupplementTo",
            resource_type: "publication-report",
          },
        ],
        license: {
          id: "cc-by-4.0",
          title: "Creative Commons Attribution 4.0 International",
          url: "https://creativecommons.org/licenses/by/4.0/",
        },
        communities: [{ id: "clir" }],
        funding: [{ id: "501100000923", name: "Mellon Foundation" }],
      },
    });

    const normalized = normalize(hit);

    expect(normalized.creator_details[0].orcid).toBe("0000-0002-1825-0097");
    expect(normalized.related_identifiers[0].identifier).toBe("10.1000/example");
    expect(normalized.license.id).toBe("cc-by-4.0");
    expect(normalized.communities).toContain("clir");
    expect(normalized.funders[0].name).toBe("Mellon Foundation");
  });
});
