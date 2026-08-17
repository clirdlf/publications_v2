import { describe, expect, it } from "vitest";
import contentUtils from "../src/lib/content-utils.cjs";

const { decodeHtmlEntities, richTextToPlainText, sanitizeHttpUrl, scriptSafeJson } = contentUtils;

describe("richTextToPlainText", () => {
  it("preserves text and decodes common and numeric entities", () => {
    expect(richTextToPlainText("<p>CLIR&rsquo;s A&ndash;Z &#x26; &#38;</p>"))
      .toBe("CLIR’s A–Z & &");
  });

  it("removes executable and formatting markup", () => {
    expect(richTextToPlainText('<p>Hello <a href="javascript:alert(1)">world</a></p><script>alert(1)</script>'))
      .toBe("Hello world");
  });
});

describe("scriptSafeJson", () => {
  it("cannot terminate its containing script element", () => {
    const serialized = scriptSafeJson({ title: "</script><script>alert(1)</script>", amp: "&" });
    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized).not.toContain("&");
    expect(JSON.parse(serialized).title).toBe("</script><script>alert(1)</script>");
  });
});

describe("decodeHtmlEntities", () => {
  it("leaves unknown named entities intact", () => {
    expect(decodeHtmlEntities("A &unknown; value")).toBe("A &unknown; value");
  });
});

describe("sanitizeHttpUrl", () => {
  it("allows HTTP URLs and rejects active or malformed schemes", () => {
    expect(sanitizeHttpUrl("https://zenodo.org/records/123")).toBe("https://zenodo.org/records/123");
    expect(sanitizeHttpUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeHttpUrl("not a URL")).toBe("");
  });
});
