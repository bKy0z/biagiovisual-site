// ─── URGENCY BAR ───
function closeUrgency(e) {
  e.stopPropagation();
  const bar = document.getElementById('urgencyBar');
  bar.style.display = 'none';
  document.documentElement.style.setProperty('--urgency-h', '0px');
  document.getElementById('header').classList.add('no-urgency');
  document.querySelector('.hero').classList.add('no-urgency');
  document.querySelector('nav').classList.add('no-urgency');
  closeMenu();
}

// ─── HEADER SCROLL ───
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 30);
}, { passive: true });

// ─── MENU TOGGLE ───
function toggleMenu() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('menuToggle');
  const overlay = document.getElementById('navOverlay');
  const isOpen = nav.classList.contains('show');
  if (isOpen) {
    closeMenu();
  } else {
    nav.classList.add('show');
    toggle.classList.add('open');
    overlay.classList.add('show');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
}
function closeMenu() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('menuToggle');
  const overlay = document.getElementById('navOverlay');
  nav.classList.remove('show');
  toggle.classList.remove('open');
  overlay.classList.remove('show');
  toggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}
document.addEventListener('click', (e) => {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('menuToggle');
  if (nav.classList.contains('show') && !nav.contains(e.target) && !toggle.contains(e.target)) closeMenu();
});

// ─── SMOOTH SCROLL ───
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    const urgH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--urgency-h')) || 0;
    const hdrH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
    const top = el.getBoundingClientRect().top + window.scrollY - hdrH - urgH;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

// ─── CHIP SELECTOR ───
function chipSelect(el) {
  document.querySelectorAll('.form-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('eventType').value = el.dataset.value;
}

// Supporto tastiera per i chip
document.querySelectorAll('.form-chip').forEach(chip => {
  chip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chipSelect(chip); }
  });
});

// ─── PRE-SELEZIONA SERVIZIO DAI LINK NELLE CARD ───
function selectService(value) {
  const chip = document.querySelector(`.form-chip[data-value="${value}"]`);
  if (chip) chipSelect(chip);
}

// ─── FAQ ACCORDION ───
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  // Chiudi tutti
  document.querySelectorAll('.faq-item.open').forEach(i => {
    i.classList.remove('open');
    i.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
  });
  if (!isOpen) {
    item.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
}

// ─── INTERSECTION OBSERVER ───
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('show');
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.fade, .card, .service-card, .process-step, .testimonial-card').forEach(el => observer.observe(el));