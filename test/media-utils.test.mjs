import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { mediaSlug, podcastCards, videoCards } = require("../src/lib/media-utils.cjs");

describe("media listing view models", () => {
  it("prepares podcast presentation data without mutating the source", () => {
    const source = [{
      title: "Café Memory",
      pubDate: "2025-02-03",
      description: "<p>A useful   episode</p>",
    }];

    const [card] = podcastCards(source);
    expect(card.detailPath).toBe("/items/podcast-cafe-memory-2025-02-03/");
    expect(card.date).toBe("2025-02-03");
    expect(card.publishedLabel).toBe("February 3, 2025");
    expect(card.summary).toBe("A useful episode");
    expect(source[0]).not.toHaveProperty("summary");
  });

  it("uses stable supplied slugs and prepares video summaries", () => {
    const [card] = videoCards([{
      slug: "stable-video",
      title: "Video",
      videoId: "abc",
      published: "2025-04-05",
      description: " A   useful video ",
    }]);

    expect(card.detailPath).toBe("/items/video-stable-video/");
    expect(card.summary).toBe("A useful video");
  });

  it("creates deterministic ASCII slugs", () => {
    expect(mediaSlug("Café: Memory!")).toBe("cafe-memory");
  });
});
