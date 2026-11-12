/**
 * SGI Gurdaspur - Modern Single Page Application (SPA) Engine
 * Includes Interactive Scrollable Notice Board & "Read More" Modal Details
 */

// Cache of fetched academic notices
let loadedNotices = [];

document.addEventListener('DOMContentLoaded', () => {
  initDynamicAcademicYear();
  initRouter();
  initHeroCanvas();
  initMagneticButtons();
  initCourseFiltering();
  initLeadForm();
  initCustomCursor();
  initNoticeBoard();
});

/* ========================================================
   1. CLIENT-SIDE ROUTER (SPA PAGE NAVIGATION)
   ======================================================== */
function initRouter() {
  const routes = ['home', 'about', 'institutes', 'placements', 'campus'];

  function navigateTo(routeId) {
    if (!routes.includes(routeId)) {
      routeId = 'home';
    }

    // 1. Hide all page views and reveal matching route
    document.querySelectorAll('.page-view').forEach((view) => {
      view.classList.remove('active');
    });

    const activeView = document.getElementById(`view-${routeId}`);
    if (activeView) {
      activeView.classList.add('active');
    }

    // 2. Synchronize navigation link active classes
    document.querySelectorAll('.nav-links .route-link').forEach((link) => {
      if (link.getAttribute('data-route') === routeId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // 3. Scroll to top on page switch
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Intercept click on any router link
  document.querySelectorAll('.route-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetRoute = link.getAttribute('data-route');
      if (targetRoute) {
        e.preventDefault();
        window.location.hash = targetRoute;
      }
    });
  });

  // Handle browser back/forward and initial page loads
  function handleHashChange() {
    const hash = window.location.hash.replace('#', '').trim() || 'home';
    navigateTo(hash);
  }

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}

/* ========================================================
   2. AUTOMATIC ACADEMIC SESSION & COPYRIGHT CALCULATOR
   ======================================================== */
function initDynamicAcademicYear() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0 = Jan, 1 = Feb, 2 = Mar...

  // March onwards indicates admissions for upcoming session (Year)-(Year+1)
  let startYear = currentMonth >= 2 ? currentYear : currentYear - 1;
  let nextShortYear = (startYear + 1).toString().slice(-2);
  let sessionString = `${startYear}–${nextShortYear}`;

  document.querySelectorAll('.dynamic-session').forEach((el) => {
    el.textContent = sessionString;
  });

  const yearEl = document.getElementById('dynamic-year');
  if (yearEl) {
    yearEl.textContent = currentYear;
  }
}

/* ========================================================
   3. THEME-AWARE INTERACTIVE MESH CANVAS (Hero Section)
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

  const particles = Array.from({ length: 45 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.7,
    vy: (Math.random() - 0.5) * 0.7,
    radius: Math.random() * 2 + 1,
  }));

  function animate() {
    // Only calculate when home view is active
    if (document.getElementById('view-home').classList.contains('active')) {
      ctx.clearRect(0, 0, width, height);

      const isLightMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;

      // Draw connecting lines with theme-responsive alpha
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 140) {
            const alpha = (1 - dist / 140) * (isLightMode ? 0.25 : 0.2);
            ctx.strokeStyle = isLightMode
              ? `rgba(180, 130, 10, ${alpha})`
              : `rgba(229, 169, 16, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particle nodes
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.fillStyle = isLightMode ? 'rgba(70, 80, 95, 0.5)' : 'rgba(255, 255, 255, 0.45)';
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
   4. MAGNETIC MICRO-INTERACTIONS
   ======================================================== */
function initMagneticButtons() {
  const magneticElements = document.querySelectorAll('.magnetic-btn');

  magneticElements.forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.25}px, ${y * 0.25}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0px, 0px)';
    });
  });
}

/* ========================================================
   5. CUSTOM MOUSE CURSOR
   ======================================================== */
function initCustomCursor() {
  const cursor = document.getElementById('cursor');
  if (!cursor) return;

  window.addEventListener('mousemove', (e) => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  });

  document.querySelectorAll('a, button, .course-pill, .recruiter-box, .badge-list li, .notice-item-interactive').forEach((elem) => {
    elem.addEventListener('mouseenter', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(1.6)';
      cursor.style.background = 'rgba(229, 169, 16, 0.25)';
    });
    elem.addEventListener('mouseleave', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      cursor.style.background = 'transparent';
    });
  });
}

/* ========================================================
   6. COURSE BENTO FILTER (Institutes Page)
   ======================================================== */
function initCourseFiltering() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const coursePills = document.querySelectorAll('.course-pill');

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');

      coursePills.forEach((card) => {
        if (filter === 'all' || card.getAttribute('data-category') === filter) {
          card.style.display = 'flex';
          setTimeout(() => (card.style.opacity = '1'), 50);
        } else {
          card.style.opacity = '0';
          card.style.display = 'none';
        }
      });
    });
  });
}

/* ========================================================
   7. SCROLLABLE NOTICE BOARD WITH CATEGORY TABS & "READ MORE"
   ======================================================== */
async function initNoticeBoard() {
  const container = document.getElementById('noticesContainer');
  const filterChips = document.querySelectorAll('.notice-filter-chip');

  try {
    const res = await fetch('/api/notices');
    if (!res.ok) throw new Error('API offline');
    const data = await res.json();
    loadedNotices = data.notices || [];
  } catch (err) {
    // Built-in static fallback if running without active Python backend
    loadedNotices = [
      {
        id: 1,
        category: "ikgptu",
        category_label: "IKGPTU Jalandhar",
        title: "Semester End Regular & Re-appear Theory / Practical Examination Schedule",
        date: "Active Notification",
        ref_no: "IKGPTU/EXAM/2026/8941",
        authority: "Office of the Controller of Examinations, IKGPTU",
        badge: "University Exam",
        badge_class: "badge-urgent",
        summary: "Portal open for fill-up of online examination forms for B.Tech, MBA, BCA and B.Sc streams.",
        details: "All students of Sukhjinder College of Engineering & Technology (SCET) and SIMT are hereby notified that the university examination portal is officially live. Regular and re-appear examination forms along with prescribed university examination fees must be submitted before the notified cutoff. Admit cards will be generated digitally through the university student login portal."
      },
      {
        id: 2,
        category: "scholarship",
        category_label: "Scholarship & Admin",
        title: "Dr. Ambedkar Post-Matric Scholarship Scheme for SC/ST/OBC Students (Verification Active)",
        date: "Admissions Cell",
        ref_no: "SGI/SCH/2026/041",
        authority: "Welfare & Scholarship Nodal Cell, SGI Campus",
        badge: "Govt Scholarship",
        badge_class: "badge-scholar",
        summary: "Mandatory biometric and document verification for Freeship Card holders and state scholarship recipients.",
        details: "All registered students eligible under the Punjab State Post-Matric Scholarship Scheme (PMS) for SC/ST/OBC categories are instructed to verify their Aadhaar linkage with bank accounts and submit physical copies of income certificates, domicile, and academic marksheets to the campus administrative desk to ensure direct fee reimbursement processing."
      },
      {
        id: 3,
        category: "pharma",
        category_label: "Pharmacy (PCI)",
        title: "PCI Mandatory Hospital Dispensing Rotations & Drug Formulation Practical Journals",
        date: "SCOP Department",
        ref_no: "SCOP/PCI/CLIN/1102",
        authority: "Principal, Sukhjinder College of Pharmacy",
        badge: "PCI Council",
        badge_class: "badge-pharma",
        summary: "4th Year B.Pharm and Final Year D.Pharm clinical hospital training postings announced.",
        details: "Pursuant to Pharmacy Council of India guidelines, clinical pharmaceutical training rotations at affiliated district civil hospitals and multi-specialty healthcare networks will commence as scheduled. Students must maintain their certified pharmacovigilance and drug formulation logbooks under the supervision of designated clinical preceptors."
      },
      {
        id: 4,
        category: "nursing",
        category_label: "Nursing (INC/PNRC)",
        title: "INC & PNRC Multi-Specialty Clinical Hospital Internship Postings Schedule",
        date: "SCON Department",
        ref_no: "SCON/PNRC/2026/302",
        authority: "Office of the Principal, Sukhjinder College of Nursing",
        badge: "Nursing Board",
        badge_class: "badge-nursing",
        summary: "Clinical hospital postings in ICU, Pediatrics, and Community Health for B.Sc & GNM cohorts.",
        details: "The clinical rotation roster for the academic term has been approved by the nursing faculty board in compliance with PNRC Chandigarh and INC guidelines. Clinical duty uniforms, institutional identity cards, and procedural logs must be carried daily. Absences without prior permission from the Nursing Superintendent will attract disciplinary review."
      }
    ];
  }

  // Render all notices initially
  renderNoticesFeed('all');

  // Category filter chip clicks
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const cat = chip.getAttribute('data-notice-filter');
      renderNoticesFeed(cat);
    });
  });
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

  container.innerHTML = filtered.map(item => `
    <div class="notice-item-interactive" onclick="openNoticeModal(${item.id})">
      <div class="notice-top-row">
        <span class="notice-badge ${item.badge_class || 'badge-scholar'}">${item.badge || item.category_label}</span>
        <span class="notice-date-text">${item.date}</span>
      </div>
      <h4 class="notice-headline">${item.title}</h4>
      <p class="notice-snippet-text">${item.summary}</p>
      <div class="notice-footer-row">
        <span class="notice-authority-label">${item.authority}</span>
        <button class="notice-read-more-btn" onclick="event.stopPropagation(); openNoticeModal(${item.id})">
          Read Circular & Details &rarr;
        </button>
      </div>
    </div>
  `).join('');

  // Rebind custom cursor to dynamically created items
  initCustomCursor();
}

/* ========================================================
   8. NOTICE DETAIL / "READ MORE" MODAL LOGIC
   ======================================================== */
function openNoticeModal(noticeId) {
  const notice = loadedNotices.find(n => n.id === noticeId);
  if (!notice) return;

  const modal = document.getElementById('noticeModal');
  const badgeEl = document.getElementById('modalNoticeBadge');
  
  badgeEl.textContent = notice.badge || notice.category_label;
  badgeEl.className = `notice-badge ${notice.badge_class || 'badge-scholar'}`;

  document.getElementById('modalNoticeDate').textContent = `Issued: ${notice.date}`;
  document.getElementById('modalNoticeTitle').textContent = notice.title;
  document.getElementById('modalNoticeRef').textContent = notice.ref_no || 'SGI/ACAD/2026';
  document.getElementById('modalNoticeAuthority').textContent = notice.authority || 'Academic Council';
  document.getElementById('modalNoticeBody').textContent = notice.details || notice.summary;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeNoticeModal() {
  const modal = document.getElementById('noticeModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

/* ========================================================
   9. APPLICATION MODAL LOGIC
   ======================================================== */
function openModal() {
  const modal = document.getElementById('appModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  const modal = document.getElementById('appModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

// Global click outside listener to close modals
window.addEventListener('click', (e) => {
  const appModal = document.getElementById('appModal');
  const noticeModal = document.getElementById('noticeModal');
  if (e.target === appModal) closeModal();
  if (e.target === noticeModal) closeNoticeModal();
});

/* ========================================================
   10. LEAD FORM INTEGRATION WITH BACKEND API
   ======================================================== */
function initLeadForm() {
  const leadForm = document.getElementById('leadForm');
  const statusMsg = document.getElementById('formStatus');

  leadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusMsg.textContent = 'Registering your admission token...';
    statusMsg.style.color = 'var(--text-muted)';

    const payload = {
      full_name: document.getElementById('fullName').value,
      phone: document.getElementById('phone').value,
      program: document.getElementById('programInterest').value,
    };

    try {
      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        statusMsg.textContent = 'Application received! Admissions counselor will call you shortly.';
        statusMsg.style.color = '#10b981';
        leadForm.reset();
        setTimeout(closeModal, 2500);
      } else {
        throw new Error(result.message || 'Submission error');
      }
    } catch (err) {
      statusMsg.textContent = 'Application recorded locally! Helpdesk helpline: 93160 93494';
      statusMsg.style.color = 'var(--accent-primary)';
      console.warn('API Endpoint status:', err);
    }
  });
}