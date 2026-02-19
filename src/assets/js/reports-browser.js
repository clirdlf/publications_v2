(() => {
  const root = document.querySelector("[data-reports-browser]");
  if (!root) return;

  const searchInput = root.querySelector("[data-reports-search]");
  const categorySelect = root.querySelector("[data-reports-category]");
  const sortSelect = root.querySelector("[data-reports-sort]");
  const pageSizeSelect = root.querySelector("[data-reports-page-size]");
  const status = root.querySelector("[data-reports-status]");
  const list = root.querySelector("[data-reports-list]");
  const prevBtn = root.querySelector("[data-reports-prev]");
  const nextBtn = root.querySelector("[data-reports-next]");
  const pageLabel = root.querySelector("[data-reports-page]");

  if (!list) return;

  const cards = [...list.querySelectorAll("[data-report-card]")];
  const DEFAULT_PAGE_SIZE = 12;

  const state = {
    query: "",
    category: "all",
    sort: "newest",
    pageSize: DEFAULT_PAGE_SIZE,
    page: 1,
  };

  const parseDate = (value) => {
    if (!value) return 0;
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? 0 : ts;
  };

  const collectCategories = () => {
    const counts = new Map();
    for (const card of cards) {
      const categories = (card.dataset.categories || "")
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      for (const category of categories) {
        counts.set(category, (counts.get(category) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };

  const hydrateCategories = () => {
    if (!categorySelect) return;
    const categories = collectCategories();
    for (const [name, count] of categories) {
      const option = document.createElement("option");
      option.value = name.toLowerCase();
      option.textContent = `${name} (${count})`;
      option.dataset.label = name;
      categorySelect.append(option);
    }
  };

  const readUrlState = () => {
    const params = new URLSearchParams(window.location.search);
    const query = (params.get("q") || "").trim();
    const category = (params.get("category") || "all").trim().toLowerCase();
    const sort = (params.get("sort") || "newest").trim().toLowerCase();
    const page = Number.parseInt(params.get("page") || "1", 10);
    const pageSize = Number.parseInt(params.get("size") || `${DEFAULT_PAGE_SIZE}`, 10);

    if (query) state.query = query;
    state.category = category || "all";
    if (["newest", "oldest", "title-asc", "title-desc"].includes(sort)) state.sort = sort;
    state.page = Number.isFinite(page) && page > 0 ? page : 1;
    state.pageSize = [12, 24, 48].includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE;
  };

  const syncControls = () => {
    if (searchInput) searchInput.value = state.query;
    if (categorySelect && [...categorySelect.options].some((o) => o.value === state.category)) {
      categorySelect.value = state.category;
    } else if (categorySelect) {
      categorySelect.value = "all";
      state.category = "all";
    }
    if (sortSelect) sortSelect.value = state.sort;
    if (pageSizeSelect) pageSizeSelect.value = String(state.pageSize);
  };

  const updateUrl = () => {
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    if (state.category !== "all") params.set("category", state.category);
    if (state.sort !== "newest") params.set("sort", state.sort);
    if (state.page !== 1) params.set("page", String(state.page));
    if (state.pageSize !== DEFAULT_PAGE_SIZE) params.set("size", String(state.pageSize));

    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, "", nextUrl);
  };

  const categoryMatches = (card) => {
    if (state.category === "all") return true;
    const categories = (card.dataset.categories || "")
      .toLowerCase()
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    return categories.includes(state.category);
  };

  const queryMatches = (card) => {
    if (!state.query) return true;
    const haystack = (card.dataset.searchable || "").toLowerCase();
    const terms = state.query.toLowerCase().split(/\s+/).filter(Boolean);
    return terms.every((term) => haystack.includes(term));
  };

  const sortCards = (items) => {
    const sorted = [...items];
    sorted.sort((a, b) => {
      const titleA = (a.dataset.title || "").toLowerCase();
      const titleB = (b.dataset.title || "").toLowerCase();
      const dateA = parseDate(a.dataset.published || "");
      const dateB = parseDate(b.dataset.published || "");

      if (state.sort === "oldest") return dateA - dateB;
      if (state.sort === "title-asc") return titleA.localeCompare(titleB);
      if (state.sort === "title-desc") return titleB.localeCompare(titleA);
      return dateB - dateA;
    });
    return sorted;
  };

  const render = () => {
    const filtered = cards.filter((card) => categoryMatches(card) && queryMatches(card));
    const sorted = sortCards(filtered);

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.pageSize;
    const end = start + state.pageSize;
    const visible = new Set(sorted.slice(start, end));

    for (const card of cards) {
      card.hidden = !visible.has(card);
    }

    list.append(...sorted);

    if (status) {
      const plural = total === 1 ? "report" : "reports";
      status.textContent = `${total} ${plural} found`;
    }

    if (pageLabel) pageLabel.textContent = `Page ${state.page} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = state.page <= 1;
    if (nextBtn) nextBtn.disabled = state.page >= totalPages;

    updateUrl();
  };

  const resetPage = () => {
    state.page = 1;
  };

  hydrateCategories();
  readUrlState();
  syncControls();
  render();

  searchInput?.addEventListener("input", () => {
    state.query = searchInput.value.trim();
    resetPage();
    render();
  });

  categorySelect?.addEventListener("change", () => {
    state.category = categorySelect.value;
    resetPage();
    render();
  });

  sortSelect?.addEventListener("change", () => {
    state.sort = sortSelect.value;
    resetPage();
    render();
  });

  pageSizeSelect?.addEventListener("change", () => {
    const size = Number.parseInt(pageSizeSelect.value, 10);
    state.pageSize = [12, 24, 48].includes(size) ? size : DEFAULT_PAGE_SIZE;
    resetPage();
    render();
  });

  prevBtn?.addEventListener("click", () => {
    if (state.page <= 1) return;
    state.page -= 1;
    render();
  });

  nextBtn?.addEventListener("click", () => {
    state.page += 1;
    render();
  });
})();
