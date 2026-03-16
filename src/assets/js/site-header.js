const siteHeader = document.querySelector(".lp-site-header");

if (siteHeader) {
  const menuToggle = siteHeader.querySelector(".lp-menu-toggle");
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

  mobileQuery.addEventListener("change", (event) => {
    if (!event.matches) {
      setMenuOpen(false);
    }
  });
}
