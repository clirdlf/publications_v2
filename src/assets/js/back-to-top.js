const backToTop = document.querySelector("[data-back-to-top]");

if (backToTop) {
  let ticking = false;

  const updateVisibility = () => {
    backToTop.hidden = window.scrollY <= window.innerHeight;
    ticking = false;
  };

  const requestVisibilityUpdate = () => {
    if (!ticking) {
      window.requestAnimationFrame(updateVisibility);
      ticking = true;
    }
  };

  updateVisibility();
  window.addEventListener("scroll", requestVisibilityUpdate, { passive: true });
  window.addEventListener("resize", requestVisibilityUpdate);
}
