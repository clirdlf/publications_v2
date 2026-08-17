const siteHeader = document.querySelector(".lp-site-header");

if (siteHeader) {
  const menuToggle = siteHeader.querySelector(".lp-menu-toggle");
  const searchForm = siteHeader.querySelector(".lp-header-search-form");
  const searchButton = siteHeader.querySelector(".lp-header-search");
  const searchInput = siteHeader.querySelector(".lp-header-search-input");
  const mobileQuery = window.matchMedia("(max-width: 760px)");

  const setMenuOpen = (isOpen) => {
    siteHeader.dataset.menuOpen = isOpen ? "true" : "false";

    if (menuToggle) {
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute(
        "aria-label",
        isOpen ? "Close publications menu" : "Open publications menu",
      );
    }
  };

  setMenuOpen(false);

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      const isOpen = siteHeader.dataset.menuOpen === "true";
      setMenuOpen(!isOpen);
    });
  }

  const setSearchOpen = (isOpen) => {
    if (!searchForm || !searchButton) return;

    searchForm.dataset.open = isOpen ? "true" : "false";
    searchButton.setAttribute("aria-expanded", String(isOpen));
    searchButton.setAttribute(
      "aria-label",
      isOpen ? "Close publication search" : "Open publication search",
    );

    if (isOpen) {
      searchInput?.focus();
    }
  };

  setSearchOpen(false);

  searchButton?.addEventListener("click", () => {
    setSearchOpen(searchForm?.dataset.open !== "true");
  });

  searchForm?.addEventListener("submit", (event) => {
    if (!searchInput?.value.trim()) {
      event.preventDefault();
      setSearchOpen(true);
    }
  });

  document.addEventListener("click", (event) => {
    if (searchForm?.dataset.open === "true" && !searchForm.contains(event.target)) {
      setSearchOpen(false);
    }
  });

  siteHeader.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && searchForm?.dataset.open === "true") {
      setSearchOpen(false);
      searchButton?.focus();
    }
  });

  mobileQuery.addEventListener("change", (event) => {
    if (!event.matches) {
      setMenuOpen(false);
    }
  });
}
