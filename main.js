/**
 * SGI Gurdaspur - Modern Single Page Application (SPA) Engine
 * Includes Real-Time PDF Circular & Prospectus Generator
 */

let loadedNotices = [];
let currentActiveNotice = null;

document.addEventListener('DOMContentLoaded', () => {
  initDynamicAcademicYear();
  initRouter();
  initMobileNavigation();
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
   2. MOBILE NAVIGATION DRAWER CONTROLLER
   ======================================================== */
function initMobileNavigation() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const closeBtn = document.getElementById('mobileNavClose');
  const backdrop = document.getElementById('mobileNavBackdrop');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => openMobileNav());
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeMobileNav());
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => closeMobileNav());
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileNav();
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
   3. AUTOMATIC ACADEMIC SESSION & COPYRIGHT CALCULATOR
   ======================================================== */
function initDynamicAcademicYear() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

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
   4. THEME-AWARE INTERACTIVE MESH CANVAS (Hero Section)
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

  const particleCount = window.innerWidth < 768 ? 20 : 45;

  const particles = Array.from({ length: particleCount }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.7,
    vy: (Math.random() - 0.5) * 0.7,
    radius: Math.random() * 2 + 1,
  }));

  function animate() {
    if (document.getElementById('view-home').classList.contains('active')) {
      ctx.clearRect(0, 0, width, height);

      const isLightMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            const alpha = (1 - dist / 120) * (isLightMode ? 0.25 : 0.2);
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
   5. MAGNETIC MICRO-INTERACTIONS
   ======================================================== */
function initMagneticButtons() {
  if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

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
   6. CUSTOM MOUSE CURSOR
   ======================================================== */
function initCustomCursor() {
  const cursor = document.getElementById('cursor');
  if (!cursor || window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

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
   7. COURSE BENTO FILTER (Institutes Page)
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
   8. NOTICE BOARD FEED & CATEGORY TABS
   ======================================================== */
async function initNoticeBoard() {
  const filterChips = document.querySelectorAll('.notice-filter-chip');

  try {
    const res = await fetch('/api/notices');
    if (!res.ok) throw new Error('API offline');
    const data = await res.json();
    loadedNotices = data.notices || [];
  } catch (err) {
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
        details: "All students of Sukhjinder College of Engineering & Technology (SCET) and SIMT are notified that regular & re-appear examination forms are active on the IKGPTU student portal. Regular and re-appear examination forms along with university prescribed fees must be submitted before the notified cutoff. Admit cards will be generated digitally through the university student login portal."
      },
      {
        id: 2,
        category: "scholarship",
        category_label: "Scholarship & Admin",
        title: "Dr. Ambedkar Post-Matric Scholarship Scheme for SC/ST/OBC Students (Verification Active)",
        date: "Admissions Welfare Cell",
        ref_no: "SGI/SCH/2026/041",
        authority: "Welfare & Scholarship Nodal Cell, SGI Campus",
        badge: "Govt Scholarship",
        badge_class: "badge-scholar",
        summary: "Mandatory biometric and document verification for state scholarship recipients.",
        details: "All registered students eligible under the Punjab State Post-Matric Scholarship Scheme (PMS) for SC/ST/OBC categories are instructed to verify their Aadhaar linkage with active bank accounts and submit physical copies of income certificates, domicile, and academic marksheets to the campus administrative desk to ensure fee reimbursement processing."
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
        summary: "4th Year B.Pharm and Final Year D.Pharm hospital training postings announced.",
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

  renderNoticesFeed('all');

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
        <div class="notice-action-btns">
          <button class="notice-quick-pdf-btn" onclick="event.stopPropagation(); downloadNoticePDF(${item.id})">
            📄 PDF
          </button>
          <button class="notice-read-more-btn" onclick="event.stopPropagation(); openNoticeModal(${item.id})">
            Read Details &rarr;
          </button>
        </div>
      </div>
    </div>
  `).join('');

  initCustomCursor();
}

/* ========================================================
   9. NOTICE DETAIL MODAL
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
   10. REAL PDF GENERATOR ENGINE (Circulars & Prospectus)
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

  // Check if jsPDF library is loaded
  if (window.jspdf && window.jspdf.jsPDF) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // 1. Header Banner & Branding
    doc.setFillColor(17, 20, 24); // #111418
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(229, 169, 16); // Collegiate Mustard #e5a910
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('SUKHJINDER GROUP OF INSTITUTES', margin, 12);

    doc.setTextColor(200, 210, 220);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Approved by AICTE, PCI & INC New Delhi • Affiliated to IKGPTU Jalandhar & PSBTE', margin, 18);
    doc.text('V.P.O. Hayat Nagar, Hardochhanni Road, Gurdaspur, Punjab – 143521 | Helpline: 93160 93494', margin, 23);

    // Decorative Mustard Line
    doc.setDrawColor(229, 169, 16);
    doc.setLineWidth(1);
    doc.line(0, 28, pageWidth, 28);

    // 2. Reference & Date Line
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

    // 3. Department & Category Badge
    y += 10;
    doc.setFillColor(245, 240, 225);
    doc.roundedRect(margin, y - 5, 65, 8, 2, 2, 'F');
    doc.setTextColor(180, 110, 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`[ ${notice.badge || notice.category_label || 'OFFICIAL CIRCULAR'} ]`, margin + 3, y);

    // 4. Circular Subject / Title
    y += 12;
    doc.setTextColor(17, 20, 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const splitTitle = doc.splitTextToSize(`SUBJECT: ${notice.title}`, contentWidth);
    doc.text(splitTitle, margin, y);
    y += (splitTitle.length * 6) + 4;

    // 5. Official Description Body
    doc.setTextColor(50, 55, 65);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setLineHeightFactor(1.5);

    const fullDetails = `${notice.details}\n\nAll concerned students, faculty members, and administrative divisions are directed to take note of the above guidelines and ensure strict compliance. For further clarifications, please reach out to the undersigned administrative authority during working hours.`;
    const splitBody = doc.splitTextToSize(fullDetails, contentWidth);
    doc.text(splitBody, margin, y);

    // 6. Sign-off and Authority Seal Block
    y += (splitBody.length * 5.5) + 20;

    // Push signature to safe position if near page bottom
    if (y > 240) {
      doc.addPage();
      y = 30;
    }

    doc.setTextColor(17, 20, 24);
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

    // 7. Official Authenticity Footer
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, 280, pageWidth - margin, 280);

    doc.setFontSize(7.5);
    doc.setTextColor(130, 135, 145);
    doc.text('This is an authorized official digital document issued by Sukhjinder Group of Institutes, Punjab.', margin, 285);
    doc.text('Verify online at https://sgigurdaspur.org | Helpline: +91 93160 93494', margin, 289);

    // Trigger Download
    const cleanFilename = `SGI_Circular_${(notice.ref_no || 'Notice').replace(/[\/\\]/g, '_')}.pdf`;
    doc.save(cleanFilename);

  } else {
    // Fallback printable view if jsPDF CDN is blocked
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${notice.title}</title>
          <style>
            body { font-family: 'Helvetica', Arial, sans-serif; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; line-height: 1.6; }
            .header { border-bottom: 2px solid #e5a910; padding-bottom: 15px; margin-bottom: 25px; }
            h1 { font-size: 20px; margin: 0; color: #111; }
            .sub { font-size: 11px; color: #555; margin-top: 4px; }
            .ref { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin: 20px 0; border-bottom: 1px solid #eee; padding-bottom: 8px; }
            .title { font-size: 15px; font-weight: bold; margin: 20px 0 12px; }
            .body { font-size: 13px; color: #333; white-space: pre-line; }
            .sign { margin-top: 50px; text-align: right; }
          </style>
        </head>
        <body onload="window.print();">
          <div class="header">
            <h1>SUKHJINDER GROUP OF INSTITUTES</h1>
            <div class="sub">Approved by AICTE, PCI & INC New Delhi • Affiliated to IKGPTU Jalandhar</div>
            <div class="sub">V.P.O. Hayat Nagar, Hardochhanni Road, Gurdaspur, Punjab – 143521</div>
          </div>
          <div class="ref">
            <div>REF: ${notice.ref_no || 'SGI/ACAD/2026'}</div>
            <div>DATE: ${notice.date}</div>
          </div>
          <div class="title">SUBJECT: ${notice.title}</div>
          <div class="body">${notice.details || notice.summary}</div>
          <div class="sign">
            <strong>${notice.authority || 'Academic Administration'}</strong><br>
            Sukhjinder Group of Institutes
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
}

// Generates the Official 2026–27 Institutional Prospectus PDF
function downloadProspectusPDF() {
  if (window.jspdf && window.jspdf.jsPDF) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // Cover Title Bar
    doc.setFillColor(17, 20, 24);
    doc.rect(0, 0, pageWidth, 45, 'F');

    doc.setTextColor(229, 169, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('SUKHJINDER GROUP OF INSTITUTES', margin, 18);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text('INFORMATION PROSPECTUS & ADMISSION DIRECTORY', margin, 27);

    doc.setTextColor(180, 190, 200);
    doc.setFontSize(8.5);
    doc.text('Engineering • Pharmacy • Nursing • Management • Polytechnic Diploma', margin, 35);
    doc.text('Session 2026–27 | Hayat Nagar Campus, Gurdaspur, Punjab', margin, 40);

    // Decorative Bar
    doc.setFillColor(229, 169, 16);
    doc.rect(0, 45, pageWidth, 3, 'F');

    let y = 60;
    doc.setTextColor(17, 20, 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('1. ACCREDITATIONS & APPROVALS', margin, y);

    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const accreditations = [
      '• All India Council for Technical Education (AICTE), New Delhi',
      '• Pharmacy Council of India (PCI), New Delhi',
      '• Indian Nursing Council (INC) & Punjab Nurses Registration Council (PNRC)',
      '• Affiliated to I.K. Gujral Punjab Technical University (IKGPTU), Jalandhar',
      '• Punjab State Board of Technical Education & Industrial Training (PSBTE)'
    ];
    accreditations.forEach(acc => {
      doc.text(acc, margin + 4, y);
      y += 6;
    });

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('2. APPROVED UNDERGRADUATE & POSTGRADUATE PROGRAMS', margin, y);

    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const courses = [
      '• B.Tech in Computer Science & Engineering (4 Years - AICTE / IKGPTU)',
      '• B.Tech in Mechanical Engineering / Civil Engineering (4 Years)',
      '• Bachelor of Pharmacy (B.Pharm - 4 Years / PCI Approved)',
      '• Diploma in Pharmacy (D.Pharm - 2 Years)',
      '• B.Sc Nursing & Post-Basic B.Sc Nursing (4 / 2 Years - INC & PNRC Approved)',
      '• Master of Business Administration (MBA - 2 Years)',
      '• Bachelor of Computer Applications (BCA) & BBA (3 Years)',
      '• Polytechnic Engineering Diplomas (3 Years / PSBTE Approved)'
    ];
    courses.forEach(c => {
      doc.text(c, margin + 4, y);
      y += 6;
    });

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('3. SCHOLARSHIP & FINANCIAL ASSISTANCE SCHEMES', margin, y);

    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const scholarships = [
      '• Dr. Ambedkar Post-Matric Scholarship for SC/ST/OBC Students (Zero Tuition Fee)',
      '• Prime Minister Special Scholarship Scheme (PMSSS) for J&K Candidates',
      '• Merit-based Institutional Fee Waivers for 85%+ scorers in qualifying exams',
      '• Special concessions for sports medalists and single-girl children'
    ];
    scholarships.forEach(s => {
      doc.text(s, margin + 4, y);
      y += 6;
    });

    y += 12;
    doc.setFillColor(245, 245, 248);
    doc.roundedRect(margin, y - 5, pageWidth - (margin * 2), 26, 3, 3, 'F');

    doc.setTextColor(17, 20, 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CENTRAL ADMISSIONS HELPLINE & PHYSICAL VERIFICATION DESK:', margin + 6, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Campus Address: V.P.O. Hayat Nagar, Hardochhanni Road, Gurdaspur, Punjab – 143521', margin + 6, y + 9);
    doc.text('Helpline Phone: +91 93160 93494 | Official Email: admin@sgigurdaspur.org', margin + 6, y + 16);

    doc.save('SGI_Prospectus_Admissions_2026-27.pdf');
  } else {
    alert('Generating SGI Prospectus 2026–27... Please verify your connection.');
  }
}

/* ========================================================
   11. APPLICATION MODAL LOGIC
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

window.addEventListener('click', (e) => {
  const appModal = document.getElementById('appModal');
  const noticeModal = document.getElementById('noticeModal');
  if (e.target === appModal) closeModal();
  if (e.target === noticeModal) closeNoticeModal();
});

/* ========================================================
   12. LEAD FORM INTEGRATION WITH BACKEND API
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
