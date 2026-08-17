(() => {
  const root = document.querySelector("[data-reports-browser]");
  if (!root) return;

  const searchInput = root.querySelector("[data-reports-search]");
  const categorySelect = root.querySelector("[data-reports-category]");
  const categoryList = root.querySelector("[data-reports-category-list]");
  const sortSelect = root.querySelector("[data-reports-sort]");
  const pageSizeSelect = root.querySelector("[data-reports-page-size]");
  const status = root.querySelector("[data-reports-status]");
  const list = root.querySelector("[data-reports-list]");
  const prevBtn = root.querySelector("[data-reports-prev]");
  const nextBtn = root.querySelector("[data-reports-next]");
  const pageLabel = root.querySelector("[data-reports-page]");
  const pageNumbers = root.querySelector("[data-reports-pages]");
  const clearBtn = root.querySelector("[data-reports-clear]");
  const emptyState = root.querySelector("[data-reports-empty]");
  const emptyClearBtn = root.querySelector("[data-reports-empty-clear]");
  const activeFilters = root.querySelector("[data-reports-active-filters]");
  const filterPanel = root.querySelector("[data-reports-filter-panel]");

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

  const normalizeCategory = (value) =>
    (value || "")
      .trim()
      .replace(/,+$/, "")
      .replace(/\s+/g, " ")
      .toLocaleLowerCase();

  const collectCategories = () => {
    const counts = new Map();
    for (const card of cards) {
      const categories = (card.dataset.categories || "")
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      for (const category of categories) {
        const key = normalizeCategory(category);
        if (!key || key.startsWith("type:") || key.startsWith("series:")) continue;
        const current = counts.get(key) || { name: category.replace(/,+$/, ""), count: 0 };
        current.count += 1;
        counts.set(key, current);
      }
    }
    return [...counts.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  };

  const hydrateCategories = () => {
    if (!categorySelect || !categoryList) return;
    const categories = collectCategories();
    for (const [value, category] of categories) {
      const option = document.createElement("option");
      option.value = category.name;
      option.label = `${category.count} reports`;
      option.dataset.key = value;
      categoryList.append(option);
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
    if (categorySelect) {
      const category = collectCategories().find(([key]) => key === state.category);
      categorySelect.value = category ? category[1].name : "";
      if (!category && state.category !== "all") state.category = "all";
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
      .map(normalizeCategory)
      .filter(Boolean);
    return categories.includes(normalizeCategory(state.category));
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

    if (list) list.hidden = total === 0;
    if (emptyState) emptyState.hidden = total !== 0;

    const hasFilters = Boolean(state.query || state.category !== "all");
    if (clearBtn) clearBtn.hidden = !hasFilters;
    if (activeFilters) {
      activeFilters.replaceChildren();
      const addChip = (label, clear) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "rp-filter-chip";
        button.textContent = `${label} ×`;
        button.setAttribute("aria-label", `Remove ${label} filter`);
        button.addEventListener("click", clear);
        activeFilters.append(button);
      };
      if (state.query) addChip(`Search: ${state.query}`, () => {
        state.query = "";
        if (searchInput) searchInput.value = "";
        resetPage();
        render();
      });
      if (state.category !== "all") addChip(`Category: ${categorySelect?.value || state.category}`, () => {
        state.category = "all";
        if (categorySelect) categorySelect.value = "";
        resetPage();
        render();
      });
    }

    if (pageLabel) pageLabel.textContent = `Page ${state.page} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = state.page <= 1;
    if (nextBtn) nextBtn.disabled = state.page >= totalPages;

    if (pageNumbers) {
      pageNumbers.replaceChildren();
      const pages = new Set([1, totalPages, state.page - 1, state.page, state.page + 1]);
      let previous = 0;
      [...pages].filter((page) => page > 0 && page <= totalPages).sort((a, b) => a - b).forEach((page) => {
        if (previous && page - previous > 1) {
          const gap = document.createElement("span");
          gap.textContent = "…";
          gap.setAttribute("aria-hidden", "true");
          pageNumbers.append(gap);
        }
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = String(page);
        button.className = "rp-page-number";
        if (page === state.page) button.setAttribute("aria-current", "page");
        button.setAttribute("aria-label", `Page ${page}`);
        button.addEventListener("click", () => goToPage(page));
        pageNumbers.append(button);
        previous = page;
      });
    }

    updateUrl();
  };

  const resetPage = () => {
    state.page = 1;
  };

  const focusResults = () => {
    const firstHeading = list.querySelector("[data-report-card]:not([hidden]) h2 a");
    firstHeading?.focus({ preventScroll: true });
    list.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  const goToPage = (page) => {
    state.page = page;
    render();
    focusResults();
  };

  const clearFilters = () => {
    state.query = "";
    state.category = "all";
    state.page = 1;
    if (searchInput) searchInput.value = "";
    if (categorySelect) categorySelect.value = "";
    render();
    searchInput?.focus();
  };

  hydrateCategories();
  readUrlState();
  syncControls();
  render();

  let searchTimer;
  searchInput?.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.query = searchInput.value.trim();
      resetPage();
      render();
    }, 180);
  });

  const applyCategoryInput = ({ clearInvalid = false } = {}) => {
    const value = normalizeCategory(categorySelect?.value);
    const selected = collectCategories().find(([, category]) => normalizeCategory(category.name) === value);
    state.category = selected ? selected[0] : "all";
    if (!selected && clearInvalid && categorySelect) categorySelect.value = "";
    resetPage();
    render();
  };

  let categoryTimer;
  categorySelect?.addEventListener("input", () => {
    window.clearTimeout(categoryTimer);
    categoryTimer = window.setTimeout(() => applyCategoryInput(), 120);
  });
  categorySelect?.addEventListener("change", () => applyCategoryInput({ clearInvalid: true }));

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
    goToPage(state.page - 1);
  });

  nextBtn?.addEventListener("click", () => {
    goToPage(state.page + 1);
  });

  clearBtn?.addEventListener("click", clearFilters);
  emptyClearBtn?.addEventListener("click", clearFilters);

  const mobileQuery = window.matchMedia("(max-width: 760px)");
  const syncFilterPanel = () => {
    if (filterPanel) filterPanel.open = !mobileQuery.matches;
  };
  syncFilterPanel();
  mobileQuery.addEventListener("change", syncFilterPanel);
})();
