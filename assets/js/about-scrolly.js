(() => {
  const figure = document.querySelector(".about-figure");
  const steps = Array.from(document.querySelectorAll(".step"));
  if (!steps.length) return;

  function setThemeFromStep(stepEl) {
    if (!figure) return;
    const theme = stepEl?.dataset?.theme || "orange";
    figure.classList.remove("theme-orange", "theme-green", "theme-blue");
    figure.classList.add(`theme-${theme}`);
  }

  const setActive = (el) => {
    steps.forEach(s => s.classList.toggle("is-active", s === el));
    setThemeFromStep(el);
  };

  // Default: first step active
  setActive(steps[0]);

  const mql = window.matchMedia("(max-width: 576px)");
  let io = null;

  // Mobile browsers change viewport height as the URL bar expands/collapses.
  // visualViewport is more stable when available.
  const getVH = () => (window.visualViewport?.height || window.innerHeight);

  const buildObserver = () => {
    if (io) io.disconnect();

    const isNarrow = mql.matches;
    const vh = getVH();

    // Define an "activation line" down the screen where you want the theme to follow the text.
    const activationY = vh * (isNarrow ? 0.35 : 0.45);

    // Convert your intent into px-based rootMargins so they stay consistent as vh changes.
    const topMargin = Math.round(-activationY);                 // move top boundary up
    const bottomMargin = Math.round(-(vh - activationY));       // move bottom boundary up

    io = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter(e => e.isIntersecting);
        if (!intersecting.length) return;

        // Pick the step whose top is closest to the activation line.
        const best = intersecting.sort((a, b) => {
          const da = Math.abs(a.boundingClientRect.top - activationY);
          const db = Math.abs(b.boundingClientRect.top - activationY);
          return da - db;
        })[0];

        setActive(best.target);
      },
      {
        root: null,
        threshold: 0, // let intersection happen easily; we choose "best" by geometry instead
        rootMargin: `${topMargin}px 0px ${bottomMargin}px 0px`,
      }
    );

    steps.forEach(step => io.observe(step));
  };

  // Rebuild on breakpoint/orientation/viewport changes
  const debounce = (fn, ms = 150) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  buildObserver();

  mql.addEventListener?.("change", buildObserver);
  window.addEventListener("resize", debounce(buildObserver, 150));
  window.visualViewport?.addEventListener("resize", debounce(buildObserver, 150));
})();
