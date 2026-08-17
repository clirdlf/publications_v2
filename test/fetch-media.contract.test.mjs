import { describe, expect, it } from "vitest";
import { extractItems, plainText, slugifyMedia } from "../scripts/fetch-podcast.mjs";
import { extractEntries } from "../scripts/fetch-youtube.mjs";

describe("media feed normalization contracts", () => {
  it("creates a stable podcast identity and strips untrusted markup", () => {
    const [episode] = extractItems(`<rss><channel><item>
      <guid>episode-42</guid><title><![CDATA[An &amp; Episode]]></title>
      <pubDate>Wed, 15 Jun 2022 07:00:48 +0000</pubDate>
      <description><![CDATA[<p>Hello <script>alert(1)</script><em>world</em>.</p>]]></description>
      <itunes:duration>12:34</itunes:duration><itunes:season>2</itunes:season><itunes:episode>4</itunes:episode>
      <enclosure url="https://example.org/episode.mp3" type="audio/mpeg" />
    </item></channel></rss>`);

    expect(episode.id).toBe("episode-42");
    expect(episode.slug).toBe("an-episode-wed-15-jun-2022-07-00-48-0000");
    expect(episode.description).toBe("Hello alert(1) world .");
    expect(episode.enclosureType).toBe("audio/mpeg");
    expect(episode.season).toBe("2");
  });

  it("normalizes a YouTube entry for a local item page", () => {
    const [video] = extractEntries(`<feed><entry><id>yt:video:abc123</id><yt:videoId>abc123</yt:videoId>
      <title>Preservation &amp; Access</title><published>2026-01-02T00:00:00Z</published>
      <link rel="alternate" href="https://www.youtube.com/watch?v=abc123" />
      <media:description>Useful talk</media:description><media:thumbnail url="https://example.org/thumb.jpg" />
    </entry></feed>`);

    expect(video.videoId).toBe("abc123");
    expect(video.slug).toBe("preservation-access-abc123");
    expect(video.link).toContain("abc123");
  });

  it("produces deterministic slugs and plain text", () => {
    expect(slugifyMedia("Café: Memory!")).toBe("cafe-memory");
    expect(plainText("<p>A&nbsp; B</p>")).toBe("A B");
  });
});
