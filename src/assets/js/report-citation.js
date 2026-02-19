import { Cite } from "https://cdn.jsdelivr.net/npm/@citation-js/core@0.7.18/+esm";
import "https://cdn.jsdelivr.net/npm/@citation-js/plugin-csl@0.7.18/+esm";
import "https://cdn.jsdelivr.net/npm/@citation-js/plugin-doi@0.7.18/+esm";

const STYLE_OPTIONS = {
  chicago: {
    template: "chicago-author-date",
    cslUrl:
      "https://cdn.jsdelivr.net/gh/citation-style-language/styles@master/chicago-author-date.csl",
  },
  mla: {
    template: "modern-language-association",
    cslUrl:
      "https://cdn.jsdelivr.net/gh/citation-style-language/styles@master/modern-language-association.csl",
  },
  harvard: {
    template: "harvard-cite-them-right",
    cslUrl:
      "https://cdn.jsdelivr.net/gh/citation-style-language/styles@master/harvard-cite-them-right.csl",
  },
  vancouver: {
    template: "vancouver",
  },
};

const LOADED_TEMPLATES = new Set(["vancouver"]);

function normalizeDoi(value) {
  if (!value) return "";

  const normalized = String(value)
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");

  return normalized;
}

function splitName(name) {
  if (!name) return null;

  const text = String(name).trim();
  if (!text) return null;

  if (text.includes(",")) {
    const [family, ...givenParts] = text.split(",");
    const given = givenParts.join(",").trim();
    return {
      family: family.trim(),
      ...(given ? { given } : {}),
    };
  }

  const parts = text.split(/\s+/);
  if (parts.length < 2) {
    return { literal: text };
  }

  const family = parts.pop();
  return {
    family,
    given: parts.join(" "),
  };
}

function parseDateParts(dateString) {
  if (!dateString) return null;

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return null;

  return [
    parsed.getUTCFullYear(),
    parsed.getUTCMonth() + 1,
    parsed.getUTCDate(),
  ];
}

function formatYear(value) {
  const parts = parseDateParts(value);
  return parts ? String(parts[0]) : "n.d.";
}

function joinAuthors(source, styleKey) {
  const creatorDetails = Array.isArray(source.creator_details)
    ? source.creator_details
    : [];
  const creators = creatorDetails.length
    ? creatorDetails.map((entry) => String(entry?.name || "").trim()).filter(Boolean)
    : Array.isArray(source.creators)
      ? source.creators.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];

  if (!creators.length) return "";
  if (creators.length === 1) return creators[0];

  if (styleKey === "mla") {
    return `${creators[0]} et al.`;
  }

  if (creators.length === 2) {
    return `${creators[0]} and ${creators[1]}`;
  }

  return `${creators.slice(0, -1).join(", ")}, and ${creators[creators.length - 1]}`;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function localFallbackCitation(source, styleKey) {
  const authors = cleanText(joinAuthors(source, styleKey));
  const year = formatYear(source.published);
  const title = cleanText(source.title) || "[Untitled]";
  const publisher = cleanText(source.publisher) || "Council on Library and Information Resources";
  const doi = normalizeDoi(source.doi);
  const doiText = doi ? `https://doi.org/${doi}` : "";
  const url = cleanText(source.url) || doiText;
  const accessDate = new Date().toISOString().slice(0, 10);

  if (styleKey === "mla") {
    return [
      authors,
      `“${title}.”`,
      `${publisher},`,
      `${year}.`,
      doiText || url,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (styleKey === "harvard") {
    return [
      authors,
      `(${year})`,
      `${title}.`,
      publisher + ".",
      url ? `Available at: ${url}` : "",
      url ? `(Accessed: ${accessDate}).` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (styleKey === "vancouver") {
    return [
      authors,
      `${title}.`,
      publisher + ";",
      year + ".",
      url ? `Available from: ${url}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    authors,
    `${year}.`,
    `${title}.`,
    publisher + ".",
    doiText || url,
  ]
    .filter(Boolean)
    .join(" ");
}

function fallbackCslJson(source) {
  const creatorDetails = Array.isArray(source.creator_details)
    ? source.creator_details
    : [];

  const creatorsFromDetails = creatorDetails
    .map((entry) => splitName(entry?.name))
    .filter(Boolean);

  const creatorsFromStrings = Array.isArray(source.creators)
    ? source.creators.map((name) => splitName(name)).filter(Boolean)
    : [];

  const author = creatorsFromDetails.length ? creatorsFromDetails : creatorsFromStrings;

  const doi = normalizeDoi(source.doi);
  const issued = parseDateParts(source.published);

  return {
    id: source.url || doi || source.title || "clir-item",
    type: "report",
    title: source.title || "",
    ...(author.length ? { author } : {}),
    ...(issued ? { issued: { "date-parts": [issued] } } : {}),
    ...(source.publisher ? { publisher: source.publisher } : {}),
    ...(doi ? { DOI: doi } : {}),
    ...(source.url ? { URL: source.url } : {}),
  };
}

async function ensureStyleTemplate(styleKey) {
  const style = STYLE_OPTIONS[styleKey];
  if (!style || !style.cslUrl || LOADED_TEMPLATES.has(style.template)) return;

  const response = await fetch(style.cslUrl);
  if (!response.ok) {
    throw new Error(`Unable to load CSL style: ${style.template}`);
  }

  const xml = await response.text();
  Cite.plugins.config.get("csl").templates.add(style.template, xml);
  LOADED_TEMPLATES.add(style.template);
}

async function buildCitationEngine(source) {
  const doi = normalizeDoi(source.doi);

  if (doi) {
    try {
      return await Cite.async(doi);
    } catch {
      // Fall back to local metadata when DOI resolution fails.
    }
  }

  return new Cite([fallbackCslJson(source)]);
}

async function initCitationWidget(root) {
  const select = root.querySelector("[data-citation-style]");
  const output = root.querySelector("[data-citation-output]");
  const status = root.querySelector("[data-citation-status]");
  const copyButton = root.querySelector("[data-citation-copy]");
  const sourceNode = root.querySelector("[data-citation-source]");

  if (!select || !output || !status || !copyButton || !sourceNode) return;

  let source;
  try {
    source = JSON.parse(sourceNode.textContent || "{}");
  } catch {
    output.textContent = "Citation data is unavailable for this item.";
    return;
  }

  const citationEngine = await buildCitationEngine(source);
  let activeCitation = "";
  let copiedStateTimer = null;

  function setCopiedState(value) {
    if (copiedStateTimer) {
      clearTimeout(copiedStateTimer);
      copiedStateTimer = null;
    }

    copyButton.dataset.copied = value ? "true" : "false";
  }

  async function renderCitation(styleKey) {
    const option = STYLE_OPTIONS[styleKey] || STYLE_OPTIONS.chicago;

    try {
      await ensureStyleTemplate(styleKey);
      activeCitation = citationEngine
        .format("bibliography", {
          format: "text",
          template: option.template,
          lang: "en-US",
        })
        .trim();

      if (!activeCitation) {
        throw new Error("Empty citation output");
      }

      output.textContent = activeCitation;
      status.textContent = "";
      setCopiedState(false);
    } catch {
      activeCitation = localFallbackCitation(source, styleKey);
      output.textContent = activeCitation;
      status.textContent = "Using fallback formatter for this citation style.";
      setCopiedState(false);
    }
  }

  select.addEventListener("change", (event) => {
    renderCitation(event.target.value);
  });

  copyButton.addEventListener("click", async () => {
    if (!activeCitation) {
      status.textContent = "No citation text available to copy.";
      return;
    }

    try {
      await navigator.clipboard.writeText(activeCitation);
      status.textContent = "Citation copied.";
      setCopiedState(true);
      copiedStateTimer = setTimeout(() => {
        copyButton.dataset.copied = "false";
        copiedStateTimer = null;
      }, 1500);
    } catch {
      status.textContent = "Copy failed. Select the text and copy manually.";
      setCopiedState(false);
    }
  });

  await renderCitation(select.value || "chicago");
}

for (const root of document.querySelectorAll("[data-citation-root]")) {
  initCitationWidget(root).catch(() => {
    const output = root.querySelector("[data-citation-output]");
    if (output) {
      output.textContent = "Citation data could not be loaded.";
    }
  });
}
