(() => {
  const form = document.querySelector("[data-site-search]");
  const input = document.querySelector("[data-search-input]");
  const root = document.querySelector("[data-search-results]");
  const rawPathPrefix = document.documentElement.dataset.pathPrefix || "/";

  if (!form || !input || !root) return;

  const status = root.querySelector("[data-search-status]");
  const list = root.querySelector("[data-search-list]");
  const empty = root.querySelector("[data-search-empty]");
  const filter = root.querySelector("[data-search-filter]");
  const filterWrap = root.querySelector("[data-search-filter-wrap]");
  let docsPromise;
  let currentResults = [];
  let currentQuery = "";

  function withPathPrefix(pathname) {
    if (!pathname || typeof pathname !== "string" || !pathname.startsWith("/")) return pathname;
    const normalizedPrefix = rawPathPrefix.endsWith("/") ? rawPathPrefix.slice(0, -1) : rawPathPrefix;
    if (!normalizedPrefix || normalizedPrefix === "/") return pathname;
    return `${normalizedPrefix}${pathname}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  function documentType(doc) {
    if (doc.type === "podcast") return { key: "podcast", label: "Podcast" };
    if (doc.type === "video") return { key: "video", label: "Video" };
    return { key: "publication", label: "Report" };
  }

  function scoreDocument(doc, terms) {
    let score = 0;
    const title = (doc.title || "").toLowerCase();
    const creators = (doc.creators || "").toLowerCase();
    const keywords = (doc.keywords || "").toLowerCase();
    const searchable = (doc.searchable || "").toLowerCase();

    for (const term of terms) {
      if (!searchable.includes(term)) return 0;
      if (title.includes(term)) score += 12;
      if (keywords.includes(term)) score += 6;
      if (creators.includes(term)) score += 5;
      score += 1;
    }
    return score;
  }

  async function getDocs() {
    if (!docsPromise) {
      docsPromise = fetch(withPathPrefix("/assets/search-index.json"))
        .then((response) => {
          if (!response.ok) throw new Error(`Search index request failed (${response.status})`);
          return response.json();
        })
        .then((payload) => payload.docs || []);
    }
    return docsPromise;
  }

  function renderResults() {
    const selectedType = filter?.value || "all";
    const visible = currentResults.filter(({ doc }) => {
      return selectedType === "all" || documentType(doc).key === selectedType;
    });
    const typeLabel = filter?.selectedOptions[0]?.textContent.toLowerCase() || "results";

    status.textContent = selectedType === "all"
      ? `${visible.length} result${visible.length === 1 ? "" : "s"} for “${currentQuery}”`
      : `${visible.length} ${typeLabel} for “${currentQuery}”`;
    empty.hidden = visible.length !== 0;
    list.innerHTML = visible.map(({ doc }) => {
      const published = formatDate(doc.published);
      const type = documentType(doc);
      return `<li class="search-page-item">
        <h2><a href="${escapeHtml(withPathPrefix(doc.url || "/"))}">${escapeHtml(doc.title || "Untitled publication")}</a></h2>
        <p class="search-page-meta"><span>${type.label}</span>${doc.creators ? ` · ${escapeHtml(doc.creators)}` : ""}${published ? ` · <time datetime="${escapeHtml(doc.published)}">${escapeHtml(published)}</time>` : ""}</p>
      </li>`;
    }).join("");
  }

  async function run(query) {
    currentQuery = query.trim();
    if (!currentQuery) {
      currentResults = [];
      status.textContent = "Enter a title, author, or keyword to search the collection.";
      list.innerHTML = "";
      empty.hidden = true;
      filterWrap.hidden = true;
      return;
    }

    root.setAttribute("aria-busy", "true");
    status.textContent = "Searching…";
    list.innerHTML = "";
    empty.hidden = true;
    filterWrap.hidden = true;

    try {
      const terms = currentQuery.toLowerCase().split(/\s+/).filter(Boolean);
      const docs = await getDocs();
      currentResults = docs
        .map((doc) => ({ doc, score: scoreDocument(doc, terms) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || (b.doc.published || "").localeCompare(a.doc.published || ""));
      filterWrap.hidden = currentResults.length === 0;
      renderResults();
    } catch (error) {
      status.textContent = "Search is temporarily unavailable. Try again in a moment.";
      console.error(error);
    } finally {
      root.setAttribute("aria-busy", "false");
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = input.value.trim();
    const url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    window.history.pushState({}, "", url);
    run(query);
  });

  filter?.addEventListener("change", renderResults);
  window.addEventListener("popstate", () => {
    const query = new URLSearchParams(window.location.search).get("q") || "";
    input.value = query;
    run(query);
  });

  const initialQuery = new URLSearchParams(window.location.search).get("q") || "";
  input.value = initialQuery;
  run(initialQuery);
})();
