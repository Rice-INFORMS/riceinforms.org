(() => {
    const figure = document.querySelector(".about-figure");
    const steps = Array.from(document.querySelectorAll(".step"));
    if (!steps.length) return;
    const tint = document.getElementById("aboutTint");

    function setThemeFromStep(stepEl){
        if (!figure) return;
        const theme = stepEl?.dataset?.theme || "orange";

        figure.classList.remove("theme-orange", "theme-green", "theme-blue");
        figure.classList.add(`theme-${theme}`);
        }

    const setActive = (el) => {
        steps.forEach(s => s.classList.toggle("is-active", s === el));
        setThemeFromStep(el);
    }

    // Default: first step active
    setActive(steps[0]);

    const isNarrow = window.matchMedia("(max-width: 576px)").matches;

    const io = new IntersectionObserver(
    (entries) => {
        const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible) setActive(visible.target);
    },
    {
        root: null,
        threshold: [0.15, 0.3, 0.45, 0.6],
        rootMargin: isNarrow
        ? "-10% 0px -70% 0px"   // mobile: activate later, keeps theme aligned with text
        : "-20% 0px -55% 0px",  // desktop: your original zone
    }
    );


    steps.forEach(step => io.observe(step));
})();
