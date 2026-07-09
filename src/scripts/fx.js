// NARROW. motion — pure CSS/vanilla JS, no libraries.
// Three systems: scroll-driven 3D reveals (.reveal), pointer-tracking 3D
// tilt (.tilt), and the hero mark cube (CSS keyframes, no JS needed).
// Everything is off under prefers-reduced-motion.

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- scroll reveals ---------- */

function initReveals() {
  const targets = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  targets.forEach((el, i) => {
    // Stagger siblings so grids cascade instead of popping at once.
    el.style.transitionDelay = `${(i % 5) * 70}ms`;
    io.observe(el);
  });
}

/* ---------- pointer tilt ---------- */

function initTilt() {
  if (reduced || window.matchMedia('(hover: none)').matches) return;
  document.querySelectorAll('.tilt').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--tilt-x', `${(-y * 10).toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${(x * 12).toFixed(2)}deg`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    });
  });
}

initReveals();
initTilt();
