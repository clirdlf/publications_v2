const NAMED_ENTITIES = new Map([
  ["Aring", "Å"], ["Ouml", "Ö"], ["aacute", "á"],
  ["amp", "&"], ["apos", "'"], ["gt", ">"], ["hellip", "…"],
  ["deg", "°"], ["eacute", "é"], ["iacute", "í"], ["ldquo", "“"],
  ["lsquo", "‘"], ["lt", "<"], ["mdash", "—"], ["middot", "·"],
  ["nbsp", " "], ["ndash", "–"], ["quot", '"'], ["rdquo", "”"],
  ["rsquo", "’"], ["shy", ""], ["yen", "¥"],
]);

function decodeHtmlEntities(value) {
  return String(value || "").replace(
    /&(#(?:x[0-9a-f]+|[0-9]+)|[a-z][a-z0-9]+);/gi,
    (entity, key) => {
      if (key[0] !== "#") {
        return NAMED_ENTITIES.get(key) ?? NAMED_ENTITIES.get(key.toLowerCase()) ?? entity;
      }
      const isHex = key[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(key.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return "�";
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return "�";
      }
    },
  );
}

function richTextToPlainText(value) {
  if (!value) return "";
  return decodeHtmlEntities(
    String(value)
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<[^>]*>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

function hasSubstantiveDescription(value, minimumLength = 120) {
  return richTextToPlainText(value).length >= minimumLength;
}

function scriptSafeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function sanitizeHttpUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

module.exports = {
  decodeHtmlEntities,
  hasSubstantiveDescription,
  richTextToPlainText,
  sanitizeHttpUrl,
  scriptSafeJson,
};
