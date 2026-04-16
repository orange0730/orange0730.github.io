/* ============================================================
   TYPEWRITER EFFECT
   ============================================================
   在這裡填入你想輪播的身份/專長，用中文或英文都可以
   ============================================================ */
const typewriterTexts = [
  '教學與知識分享',    // ← 改成你的專長
  '課程設計',
  '專案開發',
  '問題解決',
  '[填入你的特色]',    // ← 換成真實內容
];

let twIndex = 0;
let charIndex = 0;
let isDeleting = false;
const twEl = document.getElementById('typewriter');

function typeWrite() {
  if (!twEl) return;
  const text = typewriterTexts[twIndex % typewriterTexts.length];

  if (isDeleting) {
    twEl.textContent = text.slice(0, charIndex - 1);
    charIndex--;
  } else {
    twEl.textContent = text.slice(0, charIndex + 1);
    charIndex++;
  }

  let delay = isDeleting ? 45 : 95;

  if (!isDeleting && charIndex === text.length) {
    delay = 2200;
    isDeleting = true;
  } else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    twIndex++;
    delay = 400;
  }

  setTimeout(typeWrite, delay);
}

/* ============================================================
   STARS CANVAS BACKGROUND
   ============================================================ */
function initStars() {
  const canvas = document.getElementById('starsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    buildStars();
  }

  function buildStars() {
    stars = [];
    const n = Math.floor((canvas.width * canvas.height) / 5500);
    for (let i = 0; i < n; i++) {
      stars.push({
        x:      Math.random() * canvas.width,
        y:      Math.random() * canvas.height,
        r:      Math.random() * 1.3 + 0.2,
        base:   Math.random() * 0.65 + 0.15,
        phase:  Math.random() * Math.PI * 2,
        speed:  Math.random() * 0.6 + 0.15,
      });
    }
  }

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;
    stars.forEach(s => {
      s.phase += s.speed * 0.015;
      const alpha = s.base * (0.65 + 0.35 * Math.sin(s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(190, 170, 255, ${alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  draw();
}

/* ============================================================
   NAVBAR SCROLL EFFECT
   ============================================================ */
const navbar = document.getElementById('navbar');

function onScroll() {
  if (!navbar) return;
  navbar.classList.toggle('scrolled', window.scrollY > 48);
}

/* ============================================================
   MOBILE MENU
   ============================================================ */
const mobileBtn = document.getElementById('mobileMenuBtn');
const navLinks  = document.getElementById('navLinks');

function toggleMenu() {
  const open = navLinks?.classList.toggle('open');
  const spans = mobileBtn?.querySelectorAll('span');
  if (!spans) return;
  if (open) {
    spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
    spans[1].style.opacity   = '0';
    spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
  } else {
    spans[0].style.transform = '';
    spans[1].style.opacity   = '';
    spans[2].style.transform = '';
  }
}

function closeMenu() {
  navLinks?.classList.remove('open');
  const spans = mobileBtn?.querySelectorAll('span');
  spans?.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
}

/* ============================================================
   SCROLL REVEAL — Intersection Observer
   ============================================================ */
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.08, rootMargin: '-40px' });

/* ============================================================
   FILTER BUTTONS (teaching & projects pages)
   ============================================================ */
function initFilters() {
  document.querySelectorAll('.filter-row').forEach(row => {
    const btns  = row.querySelectorAll('.filter-btn');
    const items = row.dataset.target
      ? document.querySelectorAll(row.dataset.target)
      : null;

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (!items) return;
        const cat = btn.dataset.filter;
        items.forEach(item => {
          if (cat === 'all' || item.dataset.cat?.split(',').includes(cat)) {
            item.style.display = '';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Typewriter
  setTimeout(typeWrite, 700);

  // Stars
  initStars();

  // Scroll
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu
  mobileBtn?.addEventListener('click', toggleMenu);
  navLinks?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

  // Scroll reveal
  document.querySelectorAll('.reveal, .reveal-right, .stagger').forEach(el => revealObs.observe(el));

  // Filters
  initFilters();

  // Active nav link highlight based on current page
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === page || (page === '' && href === 'index.html') ||
        (page === 'index.html' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
});
