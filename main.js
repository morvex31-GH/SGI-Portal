/**
 * SGI Gurdaspur - Single Page Application (SPA) Engine
 * Slow 6.5s Crossfade Hero Slideshow, Real-Time Dynamic CMS Hydration,
 * Smart Course Autocomplete, Staff Team Profiles, Contact Inquiry & PDF Engine
 */

let loadedNotices = [];
let loadedPrograms = [];
let loadedSiteContent = {};
let loadedStaffProfiles = [];
let currentActiveNotice = null;
let currentSessionString = '2026–27';
let currentCourseFilter = 'all';
let currentCourseSearch = '';
let cmsRefreshInFlight = false;

// Hero Slideshow State
let currentHeroSlide = 0;
let heroSlideInterval = null;

// Default Searchable Courses List (auto-augmented from /api/public-content)
let contactCoursesCatalog = [
  { group: 'Engineering & Technology', title: 'B.Tech in Computer Science & Engineering' },
  { group: 'Engineering & Technology', title: 'B.Tech in Mechanical Engineering' },
  { group: 'Engineering & Technology', title: 'B.Tech in Civil Engineering' },
  { group: 'Engineering & Technology', title: 'B.Tech Lateral Entry (LEET)' },
  { group: 'Pharmacy', title: 'Bachelor of Pharmacy (B.Pharmacy)' },
  { group: 'Pharmacy', title: 'Diploma in Pharmacy (D.Pharmacy)' },
  { group: 'Pharmacy', title: 'B.Pharmacy (Lateral Entry)' },
  { group: 'Nursing & Allied Health', title: 'B.Sc. Nursing (Basic)' },
  { group: 'Nursing & Allied Health', title: 'Post Basic B.Sc. Nursing' },
  { group: 'Nursing & Allied Health', title: 'General Nursing & Midwifery (GNM)' },
  { group: 'Nursing & Allied Health', title: 'B.Sc. Medical Lab Science (MLS)' },
  { group: 'Computer Applications & Vocation', title: 'B.Sc. Computer Science' },
  { group: 'Computer Applications & Vocation', title: 'Bachelor of Computer Applications (BCA)' },
  { group: 'Computer Applications & Vocation', title: 'Bachelor of Vocation (B.Voc)' },
  { group: 'Management & Commerce', title: 'Master of Business Administration (MBA)' },
  { group: 'Management & Commerce', title: 'Bachelor of Business Administration (BBA)' },
  { group: 'Management & Commerce', title: 'Bachelor of Commerce (B.Com Hons)' },
  { group: 'Polytechnic', title: 'Diploma in Computer Science Engineering' },
  { group: 'Polytechnic', title: 'Diploma in Mechanical Engineering' },
  { group: 'Polytechnic', title: 'Diploma in Civil Engineering' },
  { group: 'Polytechnic', title: 'Diploma in Electrical Engineering' },
  { group: 'Ayurveda & General', title: 'Ayurveda & Holistic Health Sciences Inquiry' },
  { group: 'Ayurveda & General', title: 'General Campus / Hostel / Scholarship Inquiry' }
];

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getInitials(name) {
  const clean = (name || 'SG').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function normalizeSearchText(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCourseSearchIndex(title, group = '') {
  const t = normalizeSearchText(title);
  const g = normalizeSearchText(group);
  const compact = t.replace(/\s+/g, '');
  const tokens = [t, compact, g];

  if (t.includes('computer science') && t.includes('engineering')) tokens.push('cse btech computer');
  if (t.includes('mechanical engineering')) tokens.push('me mech btech');
  if (t.includes('civil engineering')) tokens.push('ce civil btech');
  if (t.includes('b tech') || t.includes('btech')) tokens.push('btech engineering');
  if (t.includes('bachelor of pharmacy') || t.includes('b pharmacy')) tokens.push('bpharm b pharma pharmacy');
  if (t.includes('diploma in pharmacy') || t.includes('d pharmacy')) tokens.push('dpharm d pharma diploma pharmacy');
  if (t.includes('b sc nursing') || t.includes('bsc nursing')) tokens.push('bsc nursing bsc');
  if (t.includes('medical lab science') || t.includes('mls')) tokens.push('bmlt mls bsc medical lab');
  if (t.includes('computer applications') || t.includes('bca')) tokens.push('bca computers it');
  if (t.includes('b sc computer science')) tokens.push('bsc cs bsc computer science');
  if (t.includes('business administration') && t.includes('bachelor')) tokens.push('bba management');
  if (t.includes('business administration') && t.includes('master')) tokens.push('mba management pg');
  if (t.includes('commerce') || t.includes('b com')) tokens.push('bcom commerce hons');
  if (t.includes('vocation') || t.includes('b voc')) tokens.push('bvoc vocational skill');
  if (t.includes('diploma in')) tokens.push('polytechnic diploma');

  return tokens.join(' ');
}

function highlightMatch(text, query) {
  const safeText = escapeHTML(text);
  const q = (query || '').trim();
  if (!q) return safeText;
  const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return safeText.replace(regex, '<mark class="combobox-match">$1</mark>');
  } catch (_) {
    return safeText;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try { initLogoAnimations(); } catch (err) { console.warn('Logo animations skipped:', err); document.getElementById('logoPreloader')?.classList.add('is-done'); document.documentElement.classList.remove('is-preloading'); }
  initImageFallbacks();
  initDynamicAcademicYear();
  initRouter();
  initMobileNavigation();
  initHeroSlideshow();
  initHeroCanvas();
  initMagneticButtons();
  initCourseFiltering();
  initAllCourseComboboxes();
  initLeadForm();
  initCustomCursor();
  initDynamicCMS();
  initLiveSyncListeners();
});

/* ========================================================
   1. CLIENT-SIDE ROUTER (SPA PAGE NAVIGATION & VIDEO AUTOPLAY)
   ======================================================== */
function initRouter() {
  const routes = ['home', 'about', 'programs', 'placements', 'campus', 'contact'];

  function navigateTo(routeId) {
    if (!routes.includes(routeId)) {
      routeId = 'home';
    }

    document.querySelectorAll('.page-view').forEach((view) => {
      view.classList.remove('active');
    });

    const activeView = document.getElementById(`view-${routeId}`);
    if (activeView) {
      activeView.classList.add('active');
    }

    document.querySelectorAll('.nav-links .route-link, .mobile-nav-links .route-link').forEach((link) => {
      if (link.getAttribute('data-route') === routeId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    if (routeId !== 'about') {
      pauseAboutVideos();
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  document.querySelectorAll('.route-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetRoute = link.getAttribute('data-route');
      if (targetRoute) {
        e.preventDefault();
        window.location.hash = targetRoute;
        closeMobileNav();
      }
    });
  });

  function handleHashChange() {
    const hash = window.location.hash.replace('#', '').trim() || 'home';
    navigateTo(hash);
  }

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}

/* ========================================================
   2. SLOW HERO BACKGROUND SLIDESHOW (6.5s Interval, 1.4s Crossfade)
   ======================================================== */
function initHeroSlideshow() {
  const slides = document.querySelectorAll('#heroSlideshow .hero-slide');
  const indicators = document.querySelectorAll('.hero-indicator');
  if (!slides.length) return;

  function showSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === index);
    });
    indicators.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
    currentHeroSlide = index;
  }

  function startAutoSlide() {
    clearInterval(heroSlideInterval);
    heroSlideInterval = setInterval(() => {
      const nextIndex = (currentHeroSlide + 1) % slides.length;
      showSlide(nextIndex);
    }, 6500);
  }

  indicators.forEach((dot) => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.getAttribute('data-slide'), 10);
      if (!isNaN(idx)) {
        showSlide(idx);
        startAutoSlide();
      }
    });
  });

  showSlide(0);
  startAutoSlide();
}

/* ========================================================
   3. ABOUT YOUTUBE VIDEO CONTROLLER
   Pauses the embedded promo video when leaving the About page
   ======================================================== */
function pauseAboutVideos() {
  document.querySelectorAll('.about-video-embed').forEach((frame) => {
    if (frame.contentWindow) {
      frame.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        '*'
      );
    }
  });
}

/* ========================================================
   ABOUT PHOTO FALLBACKS
   Tries each path in data-fallback-srcs until an image loads
   ======================================================== */
function initImageFallbacks() {
  document.querySelectorAll('img[data-fallback-srcs]').forEach((img) => {
    const queue = img.getAttribute('data-fallback-srcs').split('|').filter(Boolean);
    const tryNext = () => {
      if (queue.length) img.src = queue.shift();
    };
    img.addEventListener('error', tryNext);
    // Cover the case where the image already failed before this script ran
    if (img.complete && img.naturalWidth === 0) tryNext();
  });
}

/* ========================================================
   4. MOBILE NAVIGATION DRAWER CONTROLLER
   ======================================================== */
function initMobileNavigation() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const closeBtn = document.getElementById('mobileNavClose');
  const backdrop = document.getElementById('mobileNavBackdrop');

  if (toggleBtn) toggleBtn.addEventListener('click', () => openMobileNav());
  if (closeBtn) closeBtn.addEventListener('click', () => closeMobileNav());
  if (backdrop) backdrop.addEventListener('click', () => closeMobileNav());

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileNav();
      closeModal();
      closeNoticeModal();
    }
  });
}

function openMobileNav() {
  const drawer = document.getElementById('mobileNavDrawer');
  if (drawer) {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
}

function closeMobileNav() {
  const drawer = document.getElementById('mobileNavDrawer');
  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}

/* ========================================================
   5. AUTOMATIC ACADEMIC SESSION & COPYRIGHT CALCULATOR
   ======================================================== */
function initDynamicAcademicYear() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const startYear = currentMonth >= 2 ? currentYear : currentYear - 1;
  const nextShortYear = (startYear + 1).toString().slice(-2);
  currentSessionString = `${startYear}–${nextShortYear}`;

  document.querySelectorAll('.dynamic-session').forEach((el) => {
    el.textContent = currentSessionString;
  });

  const yearEl = document.getElementById('dynamic-year');
  if (yearEl) {
    yearEl.textContent = currentYear;
  }
}

/* ========================================================
   6. INTERACTIVE MESH CANVAS (Hero Section)
   ======================================================== */
function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particleCount = window.innerWidth < 768 ? 18 : 40;
  const particles = Array.from({ length: particleCount }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.55,
    vy: (Math.random() - 0.5) * 0.55,
    radius: Math.random() * 1.8 + 1,
  }));

  function animate() {
    const homeView = document.getElementById('view-home');
    if (homeView && homeView.classList.contains('active')) {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.22;
            ctx.strokeStyle = `rgba(244, 180, 0, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    requestAnimationFrame(animate);
  }
  animate();
}

/* ========================================================
   7. MAGNETIC MICRO-INTERACTIONS
   ======================================================== */
function initMagneticButtons() {
  if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

  document.querySelectorAll('.magnetic-btn').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.22}px, ${y * 0.22}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0px, 0px)';
    });
  });
}

/* ========================================================
   8. CUSTOM MOUSE CURSOR
   ======================================================== */
function initCustomCursor() {
  const cursor = document.getElementById('cursor');
  if (!cursor || window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

  if (!cursor.dataset.boundMouse) {
    window.addEventListener('mousemove', (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    });
    cursor.dataset.boundMouse = '1';
  }

  document.querySelectorAll('a, button, .course-pill, .recruiter-box, .emblem-card, .notice-item-interactive, .media-card, .preview-stream-card, .public-staff-card').forEach((elem) => {
    if (elem.dataset.cursorBound) return;
    elem.dataset.cursorBound = '1';
    elem.addEventListener('mouseenter', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(1.6)';
      cursor.style.background = 'rgba(244, 180, 0, 0.25)';
    });
    elem.addEventListener('mouseleave', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      cursor.style.background = 'transparent';
    });
  });
}

/* ========================================================
   9. DEGREE PROGRAMS RENDERER, LIVE SEARCH & FILTERING
   ======================================================== */
function initCourseFiltering() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const searchInput = document.getElementById('programSearchInput');
  const searchClear = document.getElementById('programSearchClear');

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentCourseFilter = btn.getAttribute('data-filter');
      applyCourseFilter();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentCourseSearch = searchInput.value.trim();
      if (searchClear) {
        searchClear.style.display = currentCourseSearch ? 'flex' : 'none';
      }
      applyCourseFilter();
    });
  }

  if (searchClear && searchInput) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      currentCourseSearch = '';
      searchClear.style.display = 'none';
      applyCourseFilter();
      searchInput.focus();
    });
  }
}

function resetProgramSearch() {
  const searchInput = document.getElementById('programSearchInput');
  const searchClear = document.getElementById('programSearchClear');
  const allBtn = document.querySelector('.filter-btn[data-filter="all"]');

  if (searchInput) searchInput.value = '';
  if (searchClear) searchClear.style.display = 'none';
  currentCourseSearch = '';
  currentCourseFilter = 'all';

  document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
  if (allBtn) allBtn.classList.add('active');

  applyCourseFilter();
}

function applyCourseFilter() {
  const coursePills = document.querySelectorAll('.course-pill');
  const emptyState = document.getElementById('programsEmptyState');
  const normQuery = normalizeSearchText(currentCourseSearch);
  const compactQuery = normQuery.replace(/\s+/g, '');
  let visibleCount = 0;

  coursePills.forEach((card) => {
    const matchesCategory = currentCourseFilter === 'all' || card.getAttribute('data-category') === currentCourseFilter;
    const rawText = card.textContent || '';
    const titleEl = card.querySelector('h4');
    const searchIndex = `${normalizeSearchText(rawText)} ${getCourseSearchIndex(titleEl ? titleEl.textContent : '', card.getAttribute('data-category') || '')}`;

    const matchesSearch = !normQuery ||
      searchIndex.includes(normQuery) ||
      (compactQuery && searchIndex.replace(/\s+/g, '').includes(compactQuery));

    if (matchesCategory && matchesSearch) {
      card.style.display = 'flex';
      card.style.opacity = '1';
      visibleCount++;
    } else {
      card.style.opacity = '0';
      card.style.display = 'none';
    }
  });

  if (emptyState) {
    emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
  }
}

function populateContactCourseDropdown(programs) {
  if (!Array.isArray(programs) || programs.length === 0) return;

  const groupLabels = {
    engineering: 'Engineering & Technology',
    pharma: 'Pharmacy',
    nursing: 'Nursing & Allied Health',
    mgmt: 'Management & Commerce',
    vocational: 'Computer Applications & Vocation'
  };

  const merged = [];
  const seen = new Set();

  programs.forEach((prog) => {
    const title = (prog.title || '').trim();
    if (!title || seen.has(title.toLowerCase())) return;
    seen.add(title.toLowerCase());
    merged.push({
      group: groupLabels[prog.category] || 'Other Programs',
      title
    });
  });

  const extras = [
    { group: 'Engineering & Technology', title: 'B.Tech Lateral Entry (LEET)' },
    { group: 'Pharmacy', title: 'B.Pharmacy (Lateral Entry)' },
    { group: 'Nursing & Allied Health', title: 'General Nursing & Midwifery (GNM)' },
    { group: 'Polytechnic', title: 'Diploma in Computer Science Engineering' },
    { group: 'Polytechnic', title: 'Diploma in Mechanical Engineering' },
    { group: 'Polytechnic', title: 'Diploma in Civil Engineering' },
    { group: 'Polytechnic', title: 'Diploma in Electrical Engineering' },
    { group: 'Ayurveda & General', title: 'Ayurveda & Holistic Health Sciences Inquiry' },
    { group: 'Ayurveda & General', title: 'General Campus / Hostel / Scholarship Inquiry' }
  ];

  extras.forEach((item) => {
    if (!seen.has(item.title.toLowerCase())) {
      seen.add(item.title.toLowerCase());
      merged.push(item);
    }
  });

  contactCoursesCatalog = merged;
}

function renderDynamicPrograms(programs) {
  const grid = document.getElementById('coursesGrid');
  if (!grid || !Array.isArray(programs) || programs.length === 0) return;

  grid.innerHTML = programs.map(prog => `
    <div class="course-pill" data-category="${escapeHTML(prog.category)}">
      <div>
        <span class="course-code">${escapeHTML(prog.code)}</span>
        <h4>${escapeHTML(prog.title)}</h4>
        <p>${escapeHTML(prog.description)}</p>
      </div>
      <span class="duration">${escapeHTML(prog.eligibility)}</span>
    </div>
  `).join('');

  populateContactCourseDropdown(programs);
  applyCourseFilter();
  initCustomCursor();
}

/* ========================================================
   9B. REUSABLE SEARCHABLE COURSE AUTOCOMPLETE COMBOBOX
   ======================================================== */
function createSearchableCourseCombobox({ wrapperId, inputId, dropdownId, toggleId, clearId }) {
  const wrapper = document.getElementById(wrapperId);
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  const toggleBtn = document.getElementById(toggleId);
  const clearBtn = document.getElementById(clearId);
  if (!wrapper || !input || !dropdown) return;

  let activeIndex = -1;

  function updateClearVisibility() {
    if (clearBtn) {
      clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
    }
  }

  function renderDropdown(query = '') {
    const rawQuery = query.trim();
    const normQ = normalizeSearchText(rawQuery);
    const compactQ = normQ.replace(/\s+/g, '');

    const matches = contactCoursesCatalog.filter((item) => {
      if (!normQ) return true;
      const index = getCourseSearchIndex(item.title, item.group);
      return index.includes(normQ) || (compactQ && index.replace(/\s+/g, '').includes(compactQ));
    });

    activeIndex = -1;

    if (matches.length === 0) {
      dropdown.innerHTML = `
        <div class="combobox-empty">
          No preset course matched "<strong>${escapeHTML(rawQuery)}</strong>". You can continue submitting your typed course name.
        </div>
      `;
      return;
    }

    const grouped = {};
    matches.forEach((item) => {
      if (!grouped[item.group]) grouped[item.group] = [];
      grouped[item.group].push(item.title);
    });

    let html = '';
    Object.keys(grouped).forEach((groupName) => {
      html += `<div class="combobox-group-label">${escapeHTML(groupName)}</div>`;
      grouped[groupName].forEach((title) => {
        const isSelected = input.value.trim().toLowerCase() === title.toLowerCase();
        html += `<button type="button" class="combobox-option${isSelected ? ' selected' : ''}" role="option" data-value="${escapeHTML(title)}">${highlightMatch(title, rawQuery)}</button>`;
      });
    });

    dropdown.innerHTML = html;

    dropdown.querySelectorAll('.combobox-option').forEach((opt) => {
      opt.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectOption(opt.getAttribute('data-value'));
      });
    });
  }

  function openDropdown(showAll = false) {
    renderDropdown(showAll ? '' : input.value);
    dropdown.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
    input.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
  }

  function selectOption(value) {
    input.value = value;
    updateClearVisibility();
    closeDropdown();
  }

  input.addEventListener('focus', () => {
    openDropdown(input.value.trim() === '');
  });

  input.addEventListener('input', () => {
    updateClearVisibility();
    openDropdown(false);
  });

  input.addEventListener('keydown', (e) => {
    const options = Array.from(dropdown.querySelectorAll('.combobox-option'));
    if (!dropdown.classList.contains('open') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      openDropdown(false);
      return;
    }

    if (e.key === 'ArrowDown' && options.length > 0) {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % options.length;
      options.forEach((o, i) => o.classList.toggle('highlighted', i === activeIndex));
      options[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp' && options.length > 0) {
      e.preventDefault();
      activeIndex = activeIndex <= 0 ? options.length - 1 : activeIndex - 1;
      options.forEach((o, i) => o.classList.toggle('highlighted', i === activeIndex));
      options[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && dropdown.classList.contains('open') && options.length > 0) {
      const target = activeIndex >= 0 ? options[activeIndex] : options[0];
      if (target) {
        e.preventDefault();
        selectOption(target.getAttribute('data-value'));
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropdown.classList.contains('open')) {
        closeDropdown();
      } else {
        openDropdown(true);
        input.focus();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      input.value = '';
      updateClearVisibility();
      openDropdown(true);
      input.focus();
    });
  }

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      closeDropdown();
    }
  });
}

function initAllCourseComboboxes() {
  createSearchableCourseCombobox({
    wrapperId: 'routeCourseCombobox',
    inputId: 'routeCourse',
    dropdownId: 'routeCourseList',
    toggleId: 'routeCourseToggle',
    clearId: 'routeCourseClear'
  });

  createSearchableCourseCombobox({
    wrapperId: 'applyCourseCombobox',
    inputId: 'programInterest',
    dropdownId: 'applyCourseList',
    toggleId: 'applyCourseToggle',
    clearId: 'applyCourseClear'
  });
}

/* ========================================================
   10. DYNAMIC CMS HYDRATION & REAL-TIME CROSS-TAB SYNC
   ======================================================== */
let activeNoticeFilterCategory = 'all';

// Renders a /api/public-content payload (from the database) into the page.
function applyPublicContent(data) {
  if (!data || typeof data !== 'object') return;
  loadedNotices = data.notices || [];
  loadedPrograms = data.programs || [];
  loadedSiteContent = data.site_content || {};
  loadedStaffProfiles = data.staff_profiles || [];

  applyDynamicSiteContent(loadedSiteContent);
  if (loadedPrograms.length > 0) {
    renderDynamicPrograms(loadedPrograms);
  }
  renderNoticesFeed(activeNoticeFilterCategory);
  renderPublicStaffProfiles(loadedStaffProfiles);
}

// The server embeds the latest database content in the page (<script id="sgi-boot">),
// so the first paint already shows saved values instead of the hardcoded HTML text.
function readBootPayload() {
  try {
    const el = document.getElementById('sgi-boot');
    return el ? JSON.parse(el.textContent) : null;
  } catch (_) {
    return null;
  }
}

async function fetchAndHydratePublicContent() {
  if (cmsRefreshInFlight) return;
  cmsRefreshInFlight = true;

  try {
    const res = await fetch(`/api/public-content?_=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Public content API unavailable');
    const data = await res.json();
    applyPublicContent(data);
  } catch (err) {
    if (loadedNotices.length === 0) {
      loadedNotices = [
        {
          id: 1,
          category: "ikgptu",
          category_label: "IKGPTU Jalandhar",
          title: "Semester End Regular & Re-appear Theory / Practical Examination Schedule",
          date: "Academic Session Notification",
          ref_no: "IKGPTU/EXAM/2026/8941",
          authority: "Office of the Controller of Examinations, IKGPTU",
          badge: "University Exam",
          badge_class: "badge-urgent",
          summary: "Portal open for fill-up of online examination forms for B.Tech, MBA, BCA and B.Sc streams.",
          details: "All students of Sukhjinder College of Engineering & Technology (SCET) and SIMT are notified that regular & re-appear examination forms are active on the IKGPTU student portal."
        }
      ];
      renderNoticesFeed(activeNoticeFilterCategory);
    }
  } finally {
    cmsRefreshInFlight = false;
  }
}

async function initDynamicCMS() {
  const filterChips = document.querySelectorAll('.notice-filter-chip');

  const bootPayload = readBootPayload();
  if (bootPayload) applyPublicContent(bootPayload);   // instant: data already in the page
  await fetchAndHydratePublicContent();               // then confirm with a fresh no-store fetch

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeNoticeFilterCategory = chip.getAttribute('data-notice-filter') || 'all';
      renderNoticesFeed(activeNoticeFilterCategory);
    });
  });
}

function initLiveSyncListeners() {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('sgi_cms_sync');
      channel.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'sync') {
          fetchAndHydratePublicContent();
        }
      });
    } catch (_) {}
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'sgi_cms_sync_ts') {
      fetchAndHydratePublicContent();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fetchAndHydratePublicContent();
    }
  });

  window.addEventListener('focus', () => {
    fetchAndHydratePublicContent();
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      fetchAndHydratePublicContent();
    }
  });
}

function setTextIfPresent(id, value) {
  if (value === undefined || value === null || value === '') return;
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function applyDynamicSiteContent(c) {
  if (!c || typeof c !== 'object') return;

  Object.keys(c).forEach((key) => {
    const val = c[key];
    if (val === undefined || val === null || val === '') return;
    document.querySelectorAll(`[data-cms="${key}"]`).forEach((el) => {
      el.textContent = val;
    });
    document.querySelectorAll(`[data-cms-src="${key}"]`).forEach((el) => {
      el.src = val;
    });
  });

  // Hero section
  setTextIfPresent('dynHeroPill', c.hero_pill);
  setTextIfPresent('dynHeroTitleHighlight', c.hero_title_highlight);
  setTextIfPresent('dynHeroTitleRest', c.hero_title_rest);
  setTextIfPresent('dynHeroSubheadline', c.hero_subheadline);
  setTextIfPresent('dynHeroSubtitle', c.hero_subtitle);

  // National Highlights Ribbon + About Facts sync
  setTextIfPresent('dynStatYears', c.stat_years);
  setTextIfPresent('dynFactYears', c.stat_years);
  setTextIfPresent('dynStatYearsTitle', c.stat_years_title);
  setTextIfPresent('dynStatYearsSub', c.stat_years_sub);

  setTextIfPresent('dynStatAlumni', c.stat_alumni);
  setTextIfPresent('dynFactAlumni', c.stat_alumni);
  setTextIfPresent('dynStatAlumniTitle', c.stat_alumni_title);
  setTextIfPresent('dynStatAlumniSub', c.stat_alumni_sub);

  setTextIfPresent('dynStatStudents', c.stat_students);
  setTextIfPresent('dynFactStudents', c.stat_students);
  setTextIfPresent('dynStatStudentsTitle', c.stat_students_title);
  setTextIfPresent('dynStatStudentsSub', c.stat_students_sub);

  setTextIfPresent('dynStatTieups', c.stat_tieups);
  setTextIfPresent('dynFactTieups', c.stat_tieups);
  setTextIfPresent('dynStatTieupsTitle', c.stat_tieups_title);
  setTextIfPresent('dynStatTieupsSub', c.stat_tieups_sub);

  setTextIfPresent('dynStatAwards', c.stat_awards);
  setTextIfPresent('dynStatAwardsTitle', c.stat_awards_title);
  setTextIfPresent('dynStatAwardsSub', c.stat_awards_sub);

  // Admissions Banner
  if (c.cta_heading) {
    setTextIfPresent('dynCtaHeading', c.cta_heading.replace(/\{session\}/g, currentSessionString));
  }
  setTextIfPresent('dynCtaDesc', c.cta_desc);

  // Placements
  setTextIfPresent('dynPlacementRate', c.placement_rate);
  setTextIfPresent('dynPlacementDesc', c.placement_desc);
  setTextIfPresent('dynPlacementPartners', c.placement_partners_count);

  // Campus Life Card
  setTextIfPresent('dynCampusLifeTitle', c.campus_life_title);
  setTextIfPresent('dynCampusLifeCaption', c.campus_life_caption);
  setTextIfPresent('dynCampusLifeDesc', c.campus_life_desc);
  if (c.campus_life_img) {
    const imgEl = document.getElementById('dynCampusLifeImg');
    if (imgEl) imgEl.src = c.campus_life_img;
  }

  // Contact & Footer Info
  if (c.helpline_phone) {
    const cleanDigits = c.helpline_phone.replace(/[^0-9+]/g, '');
    const shortDisplay = c.helpline_phone.replace(/^\+91\s*/, '');
    const headerCall = document.getElementById('dynHeaderCall');
    if (headerCall) {
      headerCall.href = `tel:${cleanDigits}`;
      headerCall.textContent = `Call: ${shortDisplay}`;
    }
    const mobileCall = document.getElementById('dynMobileCall');
    if (mobileCall) {
      mobileCall.href = `tel:${cleanDigits}`;
      mobileCall.textContent = `📞 Helpline: ${shortDisplay}`;
    }
    const contactPhone = document.getElementById('dynContactPhone');
    if (contactPhone) {
      contactPhone.href = `tel:${cleanDigits}`;
      contactPhone.textContent = c.helpline_phone;
    }
    setTextIfPresent('dynFooterPhone', c.helpline_phone);
  }

  if (c.contact_email) {
    const contactEmail = document.getElementById('dynContactEmail');
    if (contactEmail) {
      contactEmail.href = `mailto:${c.contact_email}`;
      contactEmail.textContent = c.contact_email;
    }
    const footerEmail = document.getElementById('dynFooterEmail');
    if (footerEmail) {
      footerEmail.href = `mailto:${c.contact_email}`;
      footerEmail.textContent = c.contact_email;
    }
  }

  setTextIfPresent('dynContactAddress', c.campus_address);
  setTextIfPresent('dynFooterAddress', c.campus_address);
  setTextIfPresent('dynOfficeHours', c.office_hours);
}

function formatStaffRoleLabel(role) {
  if (role === 'super_admin') return 'Admissions Director';
  if (role === 'hod') return 'Head of Department';
  return 'Admissions Counselor';
}

function renderPublicStaffProfiles(staffList) {
  const container = document.getElementById('publicStaffGrid');
  if (!container) return;

  if (!Array.isArray(staffList) || staffList.length === 0) {
    container.innerHTML = '<p class="bento-desc">Admissions desk counselors are available Monday–Saturday, 9:00 AM – 5:00 PM.</p>';
    return;
  }

  container.innerHTML = staffList.map(member => {
    const initials = getInitials(member.full_name);
    const roleLabel = formatStaffRoleLabel(member.role);
    const deptLabel = member.department === 'All' ? 'All Academic Wings' : member.department;
    const hasAvatar = Boolean(member.avatar_url);

    return `
      <div class="public-staff-card">
        <div class="public-staff-avatar">
          ${hasAvatar
            ? `<img src="${escapeHTML(member.avatar_url)}" alt="${escapeHTML(member.full_name)}" class="public-staff-avatar-img" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
            : ''}
          <span class="public-staff-avatar-fallback" style="display:${hasAvatar ? 'none' : 'flex'};">${escapeHTML(initials)}</span>
        </div>
        <div class="public-staff-meta">
          <h4>${escapeHTML(member.full_name)}</h4>
          <span class="staff-role-badge">${escapeHTML(roleLabel)}</span>
          <p class="staff-dept-line">${escapeHTML(deptLabel)}</p>
        </div>
      </div>
    `;
  }).join('');

  initCustomCursor();
}

function renderNoticesFeed(category) {
  const container = document.getElementById('noticesContainer');
  if (!container) return;

  const filtered = category === 'all'
    ? loadedNotices
    : loadedNotices.filter(n => n.category === category);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
        No active notifications found for this discipline. Check back soon.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const hasAttachedPdf = Boolean(item.pdf_url);
    const pdfButtonLabel = hasAttachedPdf ? '📄 Attached PDF' : '📄 PDF';
    const pdfTooltip = hasAttachedPdf
      ? `Download attached circular: ${escapeHTML(item.pdf_filename || 'Circular.pdf')}`
      : 'Download generated circular PDF';

    return `
      <div class="notice-item-interactive" onclick="openNoticeModal(${Number(item.id)})">
        <div class="notice-top-row">
          <span class="notice-badge ${escapeHTML(item.badge_class || 'badge-scholar')}">${escapeHTML(item.badge || item.category_label)}</span>
          <span class="notice-date-text">${escapeHTML(item.date)}</span>
        </div>
        <h4 class="notice-headline">${escapeHTML(item.title)}</h4>
        <p class="notice-snippet-text">${escapeHTML(item.summary)}</p>
        <div class="notice-footer-row">
          <span class="notice-authority-label">${escapeHTML(item.authority)}</span>
          <div class="notice-action-btns">
            <button class="notice-quick-pdf-btn" title="${pdfTooltip}" onclick="event.stopPropagation(); downloadNoticePDF(${Number(item.id)})">
              ${pdfButtonLabel}
            </button>
            <button class="notice-read-more-btn" onclick="event.stopPropagation(); openNoticeModal(${Number(item.id)})">
              ${hasAttachedPdf ? 'View PDF & Details' : 'Read Details'} &rarr;
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  initCustomCursor();
}

/* ========================================================
   11. NOTICE DETAIL MODAL (WITH ATTACHED PDF PREVIEW)
   ======================================================== */
function openNoticeModal(noticeId) {
  const notice = loadedNotices.find(n => n.id === noticeId);
  if (!notice) return;

  currentActiveNotice = notice;

  const modal = document.getElementById('noticeModal');
  const badgeEl = document.getElementById('modalNoticeBadge');
  
  badgeEl.textContent = notice.badge || notice.category_label;
  badgeEl.className = `notice-badge ${notice.badge_class || 'badge-scholar'}`;

  document.getElementById('modalNoticeDate').textContent = `Issued: ${notice.date}`;
  document.getElementById('modalNoticeTitle').textContent = notice.title;
  document.getElementById('modalNoticeRef').textContent = notice.ref_no || 'SGI/ACAD/2026';
  document.getElementById('modalNoticeAuthority').textContent = notice.authority || 'Academic Council';
  document.getElementById('modalNoticeBody').textContent = notice.details || notice.summary;

  const pdfContainer = document.getElementById('modalNoticePdfContainer');
  const pdfFrame = document.getElementById('modalNoticePdfFrame');
  const pdfOpenLink = document.getElementById('modalNoticeOpenPdfLink');
  const pdfFilenameEl = document.getElementById('modalNoticePdfFilename');
  const downloadBtn = document.getElementById('modalDownloadPdfBtn');

  if (notice.pdf_url) {
    pdfFilenameEl.textContent = `📄 ${notice.pdf_filename || 'Attached Circular.pdf'}`;
    pdfOpenLink.href = notice.pdf_url;
    pdfFrame.src = notice.pdf_url;
    pdfContainer.style.display = 'block';
    downloadBtn.textContent = 'Download Attached PDF 📄';
  } else {
    pdfFrame.src = '';
    pdfOpenLink.href = '#';
    pdfContainer.style.display = 'none';
    downloadBtn.textContent = 'Download Circular (PDF) 📄';
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeNoticeModal() {
  const modal = document.getElementById('noticeModal');
  const pdfFrame = document.getElementById('modalNoticePdfFrame');
  if (pdfFrame) {
    pdfFrame.src = '';
  }
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

/* ========================================================
   12. REAL PDF DOWNLOADER & FALLBACK GENERATOR ENGINE
   ======================================================== */
function downloadCurrentNoticePDF() {
  if (currentActiveNotice) {
    downloadNoticePDF(currentActiveNotice.id);
  } else if (loadedNotices.length > 0) {
    downloadNoticePDF(loadedNotices[0].id);
  }
}

function downloadNoticePDF(noticeId) {
  const notice = loadedNotices.find(n => n.id === noticeId);
  if (!notice) return;

  if (notice.pdf_url) {
    const separator = notice.pdf_url.includes('?') ? '&' : '?';
    const downloadUrl = `${notice.pdf_url}${separator}download=1`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = notice.pdf_filename || `SGI_Circular_${(notice.ref_no || 'Notice').replace(/[\/\\]/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  if (window.jspdf && window.jspdf.jsPDF) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    const address = loadedSiteContent.campus_address || 'V.P.O. Hayat Nagar, Hardochhani Road, Gurdaspur, Punjab – 143521';
    const helpline = loadedSiteContent.helpline_phone || '+91 93160 93494';

    doc.setFillColor(11, 37, 69);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(244, 180, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('SUKHJINDER GROUP OF INSTITUTES', margin, 12);

    doc.setTextColor(225, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Approved by AICTE, PCI & INC New Delhi • Affiliated to IKGPTU Jalandhar, BFUHS & PSBTE', margin, 18);
    doc.text(`${address} | Helpline: ${helpline}`, margin, 23);

    doc.setDrawColor(244, 180, 0);
    doc.setLineWidth(1);
    doc.line(0, 28, pageWidth, 28);

    let y = 38;
    doc.setTextColor(60, 65, 75);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`REF NO: ${notice.ref_no || 'SGI/ACAD/2026/01'}`, margin, y);

    const dateStr = `DATE: ${notice.date || 'Active Session'}`;
    const dateWidth = doc.getTextWidth(dateStr);
    doc.text(dateStr, pageWidth - margin - dateWidth, y);

    y += 8;
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);

    y += 10;
    doc.setFillColor(245, 240, 225);
    doc.roundedRect(margin, y - 5, 65, 8, 2, 2, 'F');
    doc.setTextColor(11, 37, 69);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`[ ${notice.badge || notice.category_label || 'OFFICIAL CIRCULAR'} ]`, margin + 3, y);

    y += 12;
    doc.setTextColor(11, 37, 69);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const splitTitle = doc.splitTextToSize(`SUBJECT: ${notice.title}`, contentWidth);
    doc.text(splitTitle, margin, y);
    y += (splitTitle.length * 6) + 4;

    doc.setTextColor(50, 55, 65);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setLineHeightFactor(1.5);

    const fullDetails = `${notice.details}\n\nAll concerned students, faculty members, and administrative divisions are directed to take note of the above guidelines and ensure strict compliance. For further clarifications, please reach out to the undersigned administrative authority during working hours.`;
    const splitBody = doc.splitTextToSize(fullDetails, contentWidth);
    doc.text(splitBody, margin, y);

    y += (splitBody.length * 5.5) + 20;

    if (y > 240) {
      doc.addPage();
      y = 30;
    }

    doc.setTextColor(11, 37, 69);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BY ORDER OF:', pageWidth - margin - 75, y);
    y += 6;
    doc.setFontSize(9.5);
    doc.text(notice.authority || 'Competent Authority', pageWidth - margin - 75, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Sukhjinder Group of Institutes, Gurdaspur', pageWidth - margin - 75, y);

    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, 280, pageWidth - margin, 280);

    doc.setFontSize(7.5);
    doc.setTextColor(130, 135, 145);
    doc.text('This is an authorized official digital document issued by Sukhjinder Group of Institutes, Punjab.', margin, 285);
    doc.text(`Verify online at https://sgigurdaspur.org | Helpline: ${helpline}`, margin, 289);

    const cleanFilename = `SGI_Circular_${(notice.ref_no || 'Notice').replace(/[\/\\]/g, '_')}.pdf`;
    doc.save(cleanFilename);
  }
}

function downloadProspectusPDF() {
  if (window.jspdf && window.jspdf.jsPDF) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    const address = loadedSiteContent.campus_address || 'V.P.O. Hayat Nagar, Hardochhani Road, Gurdaspur, Punjab – 143521';
    const helpline = loadedSiteContent.helpline_phone || '+91 93160 93494';
    const email = loadedSiteContent.contact_email || 'admin@sgigurdaspur.org';

    doc.setFillColor(11, 37, 69);
    doc.rect(0, 0, pageWidth, 45, 'F');

    doc.setTextColor(244, 180, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('SUKHJINDER GROUP OF INSTITUTES', margin, 18);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text('INFORMATION PROSPECTUS & DEGREE PROGRAMS DIRECTORY', margin, 27);

    doc.setTextColor(200, 210, 225);
    doc.setFontSize(8.5);
    doc.text('Engineering • Pharmacy • Nursing • Allied Health • Management • Polytechnic', margin, 35);
    doc.text(`Session ${currentSessionString} | ${address}`, margin, 40);

    doc.setFillColor(244, 180, 0);
    doc.rect(0, 45, pageWidth, 3, 'F');

    let y = 60;
    doc.setTextColor(11, 37, 69);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('1. ACCREDITATIONS & STATUTORY APPROVALS', margin, y);

    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const accreditations = [
      '• All India Council for Technical Education (AICTE), New Delhi',
      '• Pharmacy Council of India (PCI), New Delhi',
      '• Indian Nursing Council (INC) & Punjab Nurses Registration Council (PNRC)',
      '• I.K. Gujral Punjab Technical University (IKGPTU), Jalandhar',
      '• Baba Farid University of Health Sciences (BFUHS), Faridkot',
      '• Punjab State Board of Technical Education & Industrial Training (PSBTE & IT)'
    ];
    accreditations.forEach(acc => {
      doc.text(acc, margin + 4, y);
      y += 6;
    });

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('2. APPROVED DEGREE & DIPLOMA PROGRAMS', margin, y);

    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const courses = loadedPrograms.length > 0
      ? loadedPrograms.map(p => `• ${p.title} (${p.code})`)
      : [
          '• B.Tech (Computer Science & Engineering, Mechanical, Civil - 4 Years)',
          '• Bachelor of Pharmacy (B.Pharmacy - 4 Years) & D.Pharmacy (2 Years)',
          '• B.Sc. Nursing & Post Basic B.Sc. Nursing (INC / BFUHS Approved)',
          '• B.Sc. Medical Lab Science (MLS) & B.Sc. Computer Science (3 Years)',
          '• BCA, BBA, B.Com (Hons), B.Voc (3 Years) & MBA (2 Years)'
        ];
    courses.forEach(c => {
      if (y > 250) {
        doc.addPage();
        y = 25;
      }
      doc.text(c, margin + 4, y);
      y += 6;
    });

    y += 6;
    if (y > 220) {
      doc.addPage();
      y = 25;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('3. SCHOLARSHIP & FINANCIAL ASSISTANCE SCHEMES', margin, y);

    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const scholarships = [
      '• Dr. Ambedkar Post-Matric Scholarship for SC/ST/OBC Students (Zero Tuition Fee)',
      '• Prime Minister Special Scholarship Scheme (PMSSS) for J&K Candidates',
      '• Merit-based Institutional Fee Waivers for Punjab & Himachal Pradesh scholars',
      '• Special concessions for sports medalists and single-girl children'
    ];
    scholarships.forEach(s => {
      doc.text(s, margin + 4, y);
      y += 6;
    });

    y += 12;
    doc.setFillColor(242, 245, 250);
    doc.roundedRect(margin, y - 5, pageWidth - (margin * 2), 26, 3, 3, 'F');

    doc.setTextColor(11, 37, 69);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CENTRAL ADMISSIONS HELPLINE & PHYSICAL VERIFICATION DESK:', margin + 6, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Campus Address: ${address}`, margin + 6, y + 9);
    doc.text(`Helpline Phone: ${helpline} | Official Email: ${email}`, margin + 6, y + 16);

    doc.save(`SGI_Prospectus_Admissions_${currentSessionString}.pdf`);
  }
}

/* ========================================================
   13. APPLICATION MODAL LOGIC
   ======================================================== */
function openModal() {
  const modal = document.getElementById('appModal');
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeModal() {
  const modal = document.getElementById('appModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

window.addEventListener('click', (e) => {
  const appModal = document.getElementById('appModal');
  const noticeModal = document.getElementById('noticeModal');
  if (e.target === appModal) closeModal();
  if (e.target === noticeModal) closeNoticeModal();
});

/* ========================================================
   14. LEAD APPLICATION FORM (WITH EMAIL & CITY VALIDATION)
   ======================================================== */
function initLeadForm() {
  const leadForm = document.getElementById('leadForm');
  const statusMsg = document.getElementById('formStatus');
  if (!leadForm) return;

  leadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const city = document.getElementById('city').value.trim();
    const program = document.getElementById('programInterest').value.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      statusMsg.textContent = 'Please enter a valid email address.';
      statusMsg.style.color = '#ff6b6b';
      return;
    }

    statusMsg.textContent = 'Registering your admission token...';
    statusMsg.style.color = 'var(--text-muted)';

    const payload = {
      full_name: fullName,
      phone,
      email,
      city,
      program
    };

    try {
      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        statusMsg.textContent = `Application #${result.lead_id} received! Counselor for ${result.branch} will reach out shortly.`;
        statusMsg.style.color = '#34d399';
        leadForm.reset();
        const clearBtn = document.getElementById('applyCourseClear');
        if (clearBtn) clearBtn.style.display = 'none';
        setTimeout(closeModal, 2500);
      } else {
        throw new Error(result.message || 'Submission error');
      }
    } catch (err) {
      statusMsg.textContent = 'Application recorded! Admissions Helpline: +91 93160 93494';
      statusMsg.style.color = 'var(--accent-secondary)';
      console.warn('API Endpoint status:', err);
    }
  });
}

/* ========================================================
   15. CONTACT DESK FORM SUBMISSION
   ======================================================== */
function inferDepartmentFromCourse(courseName) {
  const c = (courseName || '').toLowerCase();
  if (c.includes('pharm')) return 'Pharmacy';
  if (c.includes('nurs') || c.includes('gnm')) return 'Nursing';
  if (c.includes('ayurved')) return 'Ayurveda';
  if (c.includes('diploma in') || c.includes('polytechnic')) return 'Polytechnic';
  if (c.includes('b.tech') || c.includes('btech') || c.includes('engineering')) return 'Engineering';
  if (c.includes('mls') || c.includes('medical lab')) return 'Paramedical & Sciences';
  if (c.includes('mba') || c.includes('bba') || c.includes('b.com') || c.includes('bca') || c.includes('b.voc') || c.includes('computer science')) {
    return 'Management & IT';
  }
  return 'General';
}

async function handleContactRouting(e) {
  e.preventDefault();
  const statusEl = document.getElementById('contactFormStatus');
  const form = document.getElementById('contactRoutingForm');

  const fullName = document.getElementById('contactName').value.trim();
  const phone = document.getElementById('contactPhone').value.trim();
  const email = document.getElementById('contactEmail').value.trim();
  const city = document.getElementById('contactCity').value.trim();
  const course = document.getElementById('routeCourse').value.trim();
  const message = document.getElementById('contactMessage').value.trim();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    statusEl.textContent = 'Please provide a valid email address.';
    statusEl.style.color = '#ff6b6b';
    return;
  }

  if (!course) {
    statusEl.textContent = 'Please type or select a course or degree program.';
    statusEl.style.color = '#ff6b6b';
    return;
  }

  const department = inferDepartmentFromCourse(course);

  statusEl.textContent = `Submitting your inquiry for ${course}...`;
  statusEl.style.color = 'var(--text-muted)';

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        phone,
        email,
        city,
        department,
        program: course,
        desk: 'Contact Desk',
        message
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      statusEl.textContent = `✓ Inquiry submitted for ${course}. Ref #${result.lead_id}.`;
      statusEl.style.color = '#34d399';
      form.reset();
      const clearBtn = document.getElementById('routeCourseClear');
      if (clearBtn) clearBtn.style.display = 'none';
    } else {
      throw new Error(result.message || 'Submission failed');
    }
  } catch (err) {
    statusEl.textContent = `✓ Inquiry logged for ${course}. Call +91 93160 93494 for urgent help.`;
    statusEl.style.color = 'var(--accent-secondary)';
    console.warn('Contact form status:', err);
  }
}


/* ========================================================
   LOGO ANIMATIONS (GSAP): preloader glide, idle float,
   hover tilt + aura, scroll-shrink header
   ======================================================== */
function initLogoAnimations() {
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const preloader = document.getElementById('logoPreloader');
  const brandImg = document.querySelector('.site-header .brand-logo-img');
  const brandBadge = document.getElementById('fallbackLogoBadge');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const finishPreloader = () => {
    if (preloader) preloader.classList.add('is-done');
    root.classList.remove('is-preloading');
  };

  // Header background/shadow state works even without GSAP
  const scrollY = () => window.scrollY || document.documentElement.scrollTop || 0;
  if (!header || typeof gsap === 'undefined') {
    finishPreloader();
    if (header) {
      const toggle = () => header.classList.toggle('is-scrolled', scrollY() > 40);
      window.addEventListener('scroll', toggle, { passive: true });
      toggle();
    }
    return;
  }

  // The logo that is actually visible (image, or the SGI badge if the image failed)
  const getLogoEl = () => (brandImg && brandImg.style.display !== 'none') ? brandImg : (brandBadge || null);

  // Brand colour -> rgb for the aura (falls back to the SGI amber)
  const accentHex = getComputedStyle(root).getPropertyValue('--accent-primary').trim().replace('#', '');
  const hex = accentHex.length === 3 ? accentHex.split('').map((c) => c + c).join('') : accentHex;
  const n = parseInt(hex, 16);
  const rgb = (hex.length === 6 && !isNaN(n)) ? `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}` : '244,180,0';
  const GLOW_LOW = `drop-shadow(0 0 4px rgba(${rgb},0.20)) drop-shadow(0 0 8px rgba(${rgb},0.08))`;
  const GLOW_HIGH = `drop-shadow(0 0 8px rgba(${rgb},0.50)) drop-shadow(0 0 16px rgba(${rgb},0.24))`;
  const GLOW_HOVER = `drop-shadow(0 0 10px rgba(${rgb},0.90)) drop-shadow(0 0 26px rgba(${rgb},0.55))`;

  /* ---------- Scroll-shrink (logo + sticky header) ---------- */
  let shrunk = false;
  let baseSize = null;
  const measureBase = () => {
    const el = getLogoEl();
    if (!el || baseSize) return;
    const cs = getComputedStyle(el);
    baseSize = (el === brandImg)
      ? { prop: 'height', base: parseFloat(cs.height) || 40 }
      : { prop: 'fontSize', base: parseFloat(cs.fontSize) || 14.4 };
  };
  const applyScrollState = (instant) => {
    const y = scrollY();
    const want = shrunk ? y > 20 : y > 60; // hysteresis avoids flicker near the threshold
    if (want === shrunk && !instant) return;
    shrunk = want;
    header.classList.toggle('is-scrolled', shrunk);
    const el = getLogoEl();
    measureBase();
    if (!el || !baseSize) return;
    const to = baseSize.base * (shrunk ? 0.75 : 1);
    gsap.to(el, { [baseSize.prop]: to + 'px', duration: instant ? 0 : 0.45, ease: 'power3.out', overwrite: 'auto' });
  };
  measureBase();
  window.addEventListener('scroll', () => applyScrollState(false), { passive: true });
  applyScrollState(true);

  /* ---------- Hover: 3D tilt + aura + rotate/scale ---------- */
  let glowTween = null;
  let hoverBound = false;
  const initHover = (el) => {
    if (!canHover || reduceMotion || hoverBound) return;
    hoverBound = true;
    gsap.set(el, { transformPerspective: 700, transformOrigin: '50% 50%' });
    const rotX = gsap.quickTo(el, 'rotationX', { duration: 0.4, ease: 'power3.out' });
    const rotY = gsap.quickTo(el, 'rotationY', { duration: 0.4, ease: 'power3.out' });
    let rect = null;

    el.addEventListener('mouseenter', () => {
      rect = el.getBoundingClientRect();
      if (glowTween) glowTween.pause();
      gsap.to(el, { scale: 1.14, rotation: -4, duration: 0.45, ease: 'back.out(2)', overwrite: 'auto' });
      gsap.to(el, { filter: GLOW_HOVER, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
    });
    el.addEventListener('mousemove', (e) => {
      if (!rect || !rect.width) return;
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      rotY(nx * 28);
      rotX(-ny * 28);
    });
    el.addEventListener('mouseleave', () => {
      rotX(0);
      rotY(0);
      gsap.to(el, { scale: 1, rotation: 0, duration: 0.7, ease: 'elastic.out(1, 0.55)', overwrite: 'auto' });
      gsap.to(el, {
        filter: GLOW_LOW, duration: 0.4, ease: 'power2.out', overwrite: 'auto',
        onComplete: () => { if (glowTween) glowTween.restart(); }
      });
    });
  };

  /* ---------- Idle float + breathing glow ---------- */
  let idleStarted = false;
  const startIdle = () => {
    const el = getLogoEl();
    if (!el || idleStarted || reduceMotion) return;
    idleStarted = true;
    gsap.to(el, { y: -3, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    glowTween = gsap.fromTo(el, { filter: GLOW_LOW }, { filter: GLOW_HIGH, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    initHover(el);
  };

  /* ---------- Preloader: centre -> navbar glide ---------- */
  const headerParts = ['.site-header .brand-titles', '.site-header .nav-links', '.site-header .nav-cta']
    .map((s) => document.querySelector(s)).filter(Boolean);
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    const el = getLogoEl();
    if (el) gsap.set(el, { opacity: 1 });
    finishPreloader();
    startIdle();
  };

  const runPreloader = () => {
    const logoEl = getLogoEl();
    const pImg = document.getElementById('preloaderLogoImg');
    const pBadge = document.getElementById('preloaderLogoBadge');
    if (!preloader || !logoEl || !pImg || !pBadge || reduceMotion) { reveal(); return; }

    const useBadge = (logoEl === brandBadge);
    const pLogo = useBadge ? pBadge : pImg;
    if (useBadge) { pImg.style.display = 'none'; pBadge.style.display = 'inline-flex'; }

    root.classList.add('is-preloading');
    gsap.set(logoEl, { opacity: 0 });
    gsap.set(headerParts, { opacity: 0 });
    gsap.set(pLogo, { opacity: 0, scale: 0.55, transformOrigin: '50% 50%' });
    gsap.set('.preloader-aura', { opacity: 0, scale: 0.6 });

    // Hard failsafe so the page can never stay hidden
    const failsafe = setTimeout(() => {
      gsap.killTweensOf([pLogo, '.preloader-aura', '.preloader-bg', ...headerParts]);
      gsap.set(headerParts, { clearProps: 'opacity,transform' });
      reveal();
    }, 7000);

    const flyToNavbar = () => {
      const target = logoEl.getBoundingClientRect();
      const from = pLogo.getBoundingClientRect();
      const s = target.height / from.height;
      const dx = (target.left + target.width / 2) - (from.left + from.width / 2);
      const dy = (target.top + target.height / 2) - (from.top + from.height / 2);

      gsap.set(headerParts, { y: -8 });
      const fly = gsap.timeline({
        onComplete: () => { clearTimeout(failsafe); gsap.set(pLogo, { opacity: 0 }); reveal(); }
      });
      fly.to(pLogo, { x: dx, y: dy, scale: s, borderRadius: (6 / s) + 'px', duration: 1.05, ease: 'power3.inOut' }, 0)
         .to('.preloader-aura', { x: dx, y: dy, scale: 0.35, opacity: 0, duration: 1.05, ease: 'power3.inOut' }, 0)
         .to('.preloader-bg', { opacity: 0, duration: 0.8, ease: 'power2.inOut' }, 0.3)
         .set(logoEl, { opacity: 1 }, 1.03) // hand-off: the real navbar logo takes over where the clone lands
         .to(headerParts, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out', clearProps: 'opacity,transform' }, 0.55);
    };

    gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: flyToNavbar })
      .to('.preloader-aura', { opacity: 1, scale: 1, duration: 1.1 }, 0)
      .to(pLogo, { opacity: 1, scale: 1, duration: 0.9, ease: 'back.out(1.6)' }, 0.1)
      .to('.preloader-aura', { scale: 1.12, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 1.0)
      .to({}, { duration: 0.15 }); // brief hold before the glide
  };

  // Wait (max 2.5s) for the navbar logo so the glide targets its real size/position
  let started = false;
  const go = () => { if (started) return; started = true; runPreloader(); };
  if (!brandImg || brandImg.complete) {
    go();
  } else {
    brandImg.addEventListener('load', go, { once: true });
    brandImg.addEventListener('error', go, { once: true }); // inline onerror (badge swap) has already run
    setTimeout(go, 2500);
  }
}
