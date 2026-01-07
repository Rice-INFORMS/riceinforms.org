// main.js
(() => {
  // Navbar "scrolled" state
  const navbar = document.querySelector('.navbar');
  const onScroll = () => {
    if (!navbar) return;
    navbar.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Active nav link based on current page
  const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('[data-nav]').forEach(a => {
    const target = (a.getAttribute('href') || '').toLowerCase();
    if (target === current) a.classList.add('active');
  });

  // Fade-up reveal
  const els = document.querySelectorAll('.fade-up');
  if ('IntersectionObserver' in window && els.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('is-visible');
      });
    }, { threshold: 0.12 });
    els.forEach(el => io.observe(el));
  } else {
    // fallback
    els.forEach(el => el.classList.add('is-visible'));
  }

  // (Optional) Contact form demo handler
  const contactForm = document.querySelector('#contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const status = document.querySelector('#formStatus');
      if (status) {
        status.textContent = 'Thanks — your message is queued. (Demo only; wire to your backend.)';
        status.classList.remove('d-none');
      }

      contactForm.reset();
    });
  }

  // (Optional) Events filter
  const filter = document.querySelector('#eventFilter');
  if (filter) {
    filter.addEventListener('input', () => {
      const q = filter.value.trim().toLowerCase();
      document.querySelectorAll('[data-event]').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.classList.toggle('d-none', q && !text.includes(q));
      });
    });
  }
})();
