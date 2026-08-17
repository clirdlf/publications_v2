(() => {
  for (const browser of document.querySelectorAll("[data-media-browser]")) {
    const input = browser.querySelector("[data-media-search]");
    const select = browser.querySelector("[data-media-sort]");
    const status = browser.querySelector("[data-media-status]");
    const empty = browser.querySelector("[data-media-empty]");
    const grid = browser.querySelector(".lp-grid");
    const items = [...browser.querySelectorAll("[data-media-item]")];

    const render = () => {
      const query = (input?.value || "").trim().toLowerCase();
      const visible = items.filter((item) => {
        const text = `${item.dataset.title || ""} ${item.dataset.description || ""}`.toLowerCase();
        const matches = !query || text.includes(query);
        item.hidden = !matches;
        return matches;
      });

      visible.sort((a, b) => {
        if (select?.value === "title") return (a.dataset.title || "").localeCompare(b.dataset.title || "");
        const dates = (a.dataset.date || "").localeCompare(b.dataset.date || "");
        return select?.value === "oldest" ? dates : -dates;
      });
      visible.forEach((item) => grid.append(item));

      if (status) status.textContent = `${visible.length} item${visible.length === 1 ? "" : "s"} shown.`;
      if (empty) empty.hidden = visible.length !== 0;
    };

    input?.addEventListener("input", render);
    select?.addEventListener("change", render);
    render();
  }
})();
