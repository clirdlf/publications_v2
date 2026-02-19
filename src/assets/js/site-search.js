(() => {
  const form = document.querySelector("[data-site-search]");
  const input = document.querySelector("[data-search-input]");
  const root = document.querySelector("[data-search-results]");
  const rawPathPrefix = document.documentElement.dataset.pathPrefix || "/";

  if (!form || !input || !root) return;

  const status = root.querySelector("[data-search-status]");
  const list = root.querySelector("[data-search-list]");
  let docsPromise;

  function withPathPrefix(pathname) {
    if (!pathname || typeof pathname !== "string") return pathname;
    if (!pathname.startsWith("/")) return pathname;

    const normalizedPrefix = rawPathPrefix.endsWith("/")
      ? rawPathPrefix.slice(0, -1)
      : rawPathPrefix;
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
    return date.toISOString().slice(0, 10);
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
          if (!response.ok) {
            throw new Error(`Search index request failed (${response.status})`);
          }
          return response.json();
        })
        .then((payload) => payload.docs || []);
    }

    return docsPromise;
  }

  function renderStatus(message) {
    status.textContent = message;
  }

  function renderResults(query, docs) {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    if (terms.length === 0) {
      root.hidden = true;
      renderStatus("");
      list.innerHTML = "";
      return;
    }

    const ranked = docs
      .map((doc) => ({ doc, score: scoreDocument(doc, terms) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || (b.doc.published || "").localeCompare(a.doc.published || ""))
      .slice(0, 24);

    root.hidden = false;
    renderStatus(`Found ${ranked.length} result${ranked.length === 1 ? "" : "s"} for "${query}".`);

    if (ranked.length === 0) {
      list.innerHTML = "";
      return;
    }

    list.innerHTML = ranked
      .map(({ doc }) => {
        const published = formatDate(doc.published);
        return `<li class="lp-search-item">
          <a href="${escapeHtml(withPathPrefix(doc.url || "/"))}">${escapeHtml(doc.title || "Untitled publication")}</a>
          <p>${escapeHtml(doc.creators || "")}</p>
          <p>${escapeHtml(published)}</p>
        </li>`;
      })
      .join("");
  }

  async function run(query) {
    const normalized = query.trim();
    if (!normalized) {
      root.hidden = true;
      renderStatus("");
      list.innerHTML = "";
      return;
    }

    try {
      renderStatus("Searching...");
      root.hidden = false;
      const docs = await getDocs();
      renderResults(normalized, docs);
    } catch (error) {
      renderStatus("Search is temporarily unavailable.");
      list.innerHTML = "";
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }

  function syncUrl(query) {
    const params = new URLSearchParams(window.location.search);
    if (query) params.set("q", query);
    else params.delete("q");
    const next = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, "", next);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    syncUrl(query);
    await run(query);
  });

  const initialQuery = new URLSearchParams(window.location.search).get("q") || "";
  if (initialQuery) {
    input.value = initialQuery;
    run(initialQuery);
  }
})();
