function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(value) {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

function year(value) {
  const date = parseDate(value);
  return date ? String(date.getUTCFullYear()) : "";
}

function prettyDate(value) {
  const date = parseDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function yearOffset(value, offset = 0) {
  const date = parseDate(value);
  if (!date) return "";
  return String(date.getUTCFullYear() + (Number(offset) || 0));
}

function naturalCreators(creators) {
  if (!Array.isArray(creators)) return "";
  const names = creators.filter(Boolean).map((name) => {
    const text = String(name);
    const parts = text.split(",").map((part) => part.trim());
    return parts.length === 2 && parts.every(Boolean) ? `${parts[1]} ${parts[0]}` : text;
  });
  if (names.length < 2) return names[0] || "";
  if (names.length === 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function fileType(filename) {
  const cleanName = String(filename || "").split(/[?#]/, 1)[0];
  const match = cleanName.match(/\.([a-z0-9]{1,8})$/i);
  return match ? match[1].toUpperCase() : "FILE";
}

function hasSparseHero(item) {
  const title = String(item?.title || "").trim();
  return title.length > 0 && title.length <= 60;
}

function normalizeWhitespace(value) {
  return value ? String(value).replace(/\s+/g, " ").trim() : "";
}

function snippet(value, length = 180) {
  if (!value) return "";
  const max = Number(length) > 0 ? Number(length) : 180;
  const text = String(value).trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function absoluteUrl(value, baseUrl, pathPrefix = "/") {
  if (!value || !baseUrl) return "";
  const root = String(baseUrl).replace(/\/+$/, "");
  const pathname = String(value).startsWith("/") ? String(value) : `/${value}`;
  const prefix = pathPrefix === "/" ? "" : String(pathPrefix).replace(/\/$/, "");
  return `${root}${prefix}${pathname}`;
}

module.exports = {
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
};
