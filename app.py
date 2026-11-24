"""
SGI Gurdaspur - Enterprise Admissions Portal & Multi-User RBAC CRM
Isolated Public Routing, Protected Admin Console, PBKDF2 Hashing,
Dynamic Notices (with PDF Attachments), Degree Programs, Staff Profile Avatars
& Live Site Content Management.
Run: python app.py
"""

from flask import Flask, request, jsonify, send_from_directory, send_file, abort, Response, session, redirect, url_for, make_response
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import sqlite3
import os
import csv
import io
import re
import uuid
import json
import mimetypes
import logging
from datetime import datetime
from functools import wraps

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, "sgi_admissions.db")
UPLOAD_NOTICES_DIR = os.path.join(BASE_DIR, "uploads", "notices")
UPLOAD_AVATARS_DIR = os.path.join(BASE_DIR, "uploads", "avatars")
for _d in (UPLOAD_NOTICES_DIR, UPLOAD_AVATARS_DIR):   # legacy folders only; files now live in the database
    try:
        os.makedirs(_d, exist_ok=True)
    except OSError:
        pass                                           # read-only filesystems are fine

# static_folder=None: Flask's built-in static route would otherwise expose EVERY
# file in this folder (app.py, the .db file, admin.html...). Public assets are
# served by the whitelisted route at the bottom of this file instead.
app = Flask(__name__, static_folder=None)

# ---- Persistence / deployment configuration (all via environment variables) ----
#   DATABASE_URL            -> PostgreSQL connection string (Neon / Supabase / Render PG).
#                              When set, ALL data lives in Postgres and survives restarts,
#                              redeploys, sleep, and host changes.
#   REQUIRE_PERSISTENT_DB=1 -> refuse to start without DATABASE_URL (prevents silently
#                              running on a wipeable local SQLite file in production).
#   SECRET_KEY              -> stable session-signing key (keeps admins logged in across restarts).
#   ADMIN_INITIAL_PASSWORD  -> password for the first-ever 'admin' account (only used once).
#   COOKIE_SECURE=1         -> mark the session cookie HTTPS-only (recommended in production).
app.secret_key = os.environ.get("SECRET_KEY") or "sgi_super_secret_enterprise_portal_2026_gurdaspur"

app.config['SESSION_PERMANENT'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = os.environ.get("COOKIE_SECURE", "").strip() == "1"
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024  # 25 MB max upload

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
ALLOWED_AVATAR_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}

# -------------------------------------------------------------
# Default Seed Data for Notices, Programs & Site Content
# -------------------------------------------------------------
DEFAULT_NOTICES = [
    (
        "ikgptu",
        "IKGPTU Jalandhar",
        "Semester End Regular & Re-appear Theory / Practical Examination Schedule",
        "Active Notification",
        "IKGPTU/EXAM/2026/8941",
        "Office of the Controller of Examinations, IKGPTU",
        "University Exam",
        "badge-urgent",
        "Portal open for fill-up of online examination forms for B.Tech, MBA, BCA and B.Sc streams.",
        "All students of Sukhjinder College of Engineering & Technology (SCET) and SIMT are notified that regular & re-appear examination forms are open on the IKGPTU student portal."
    ),
    (
        "scholarship",
        "Scholarship & Admin",
        "Dr. Ambedkar Post-Matric Scholarship Scheme for SC/ST/OBC Students (Verification Active)",
        "Admissions Cell",
        "SGI/SCH/2026/041",
        "Welfare & Scholarship Nodal Cell, SGI Campus",
        "Govt Scholarship",
        "badge-scholar",
        "Mandatory biometric and document verification for state scholarship recipients.",
        "Eligible SC/ST/OBC scholarship recipients must submit their income certificate and Aadhaar linkage verification to the main office."
    ),
    (
        "pharma",
        "Pharmacy (PCI)",
        "PCI Mandatory Hospital Dispensing Rotations & Drug Formulation Practical Journals",
        "SCOP Department",
        "SCOP/PCI/CLIN/1102",
        "Principal, Sukhjinder College of Pharmacy",
        "PCI Council",
        "badge-pharma",
        "4th Year B.Pharm and Final Year D.Pharm hospital training postings announced.",
        "Clinical hospital postings for pharmacy graduates will start next week in the affiliated civil hospitals."
    ),
    (
        "nursing",
        "Nursing (INC/PNRC)",
        "INC & PNRC Multi-Specialty Clinical Hospital Internship Postings Schedule",
        "SCON Department",
        "SCON/PNRC/2026/302",
        "Office of the Principal, Sukhjinder College of Nursing",
        "Nursing Board",
        "badge-nursing",
        "Clinical hospital postings in ICU, Pediatrics, and Community Health for B.Sc & GNM cohorts.",
        "All student nurses must report in clinical uniform with valid institutional ID cards."
    )
]

DEFAULT_PROGRAMS = [
    ("engineering", "AICTE • IKGPTU • 4 YEARS", "B.Tech in Computer Science & Engineering", "Artificial Intelligence, Cloud Computing, Full-stack software development, cyber security and networking.", "Eligibility: 10+2 with Physics & Mathematics / JEE", 1),
    ("engineering", "AICTE • IKGPTU • 4 YEARS", "B.Tech in Mechanical Engineering", "Thermal engineering, CAD/CAM design, automated manufacturing, and automotive technology.", "Eligibility: 10+2 with Non-Medical", 2),
    ("engineering", "AICTE • IKGPTU • 4 YEARS", "B.Tech in Civil Engineering", "Structural analysis, smart construction materials, surveying, and environmental infrastructure.", "Eligibility: 10+2 with Non-Medical", 3),
    ("pharma", "PCI • IKGPTU • 4 YEARS", "Bachelor of Pharmacy (B.Pharmacy)", "Drug formulation, clinical pharmacology, pharmaceutical chemistry, clinical testing, and dispensary management.", "Eligibility: 10+2 with PCB / PCM", 4),
    ("pharma", "PCI • PSBTE • 2 YEARS", "Diploma in Pharmacy (D.Pharmacy)", "Hospital dispensary operations, community health medications, and retail pharmaceutical licensing.", "Eligibility: 10+2 with Science Stream", 5),
    ("nursing", "INC • BFUHS • PNRC • 4 YEARS", "B.Sc. Nursing (Basic)", "Clinical hospital rotations, critical ICU care, maternal health, pediatrics, and emergency medicine.", "Eligibility: 10+2 with PCB & English", 6),
    ("nursing", "INC • BFUHS • PNRC • 2 YEARS", "Post Basic B.Sc. Nursing", "Advanced clinical nursing administration and specialized hospital management for registered nurses.", "Eligibility: Registered GNM Nurse", 7),
    ("nursing", "IKGPTU • 3 YEARS", "B.Sc. Medical Lab Science (MLS)", "Clinical pathology, hematology, microbiology analysis, and molecular diagnostic laboratory operations.", "Eligibility: 10+2 with PCB / Medical Stream", 8),
    ("vocational", "IKGPTU • 3 YEARS", "B.Sc. Computer Science", "Core algorithmic computer science, data structures, software architecture, and numerical mathematics.", "Eligibility: 10+2 with Mathematics / Computers", 9),
    ("vocational", "IKGPTU • 3 YEARS", "Bachelor of Computer Applications (BCA)", "Python development, relational database systems, full-stack web applications, and mobile app design.", "Eligibility: 10+2 in Any Stream", 10),
    ("mgmt", "IKGPTU • 3 YEARS", "Bachelor of Business Administration (BBA)", "Corporate financial management, brand marketing, human resources, and business communication.", "Eligibility: 10+2 in Any Stream", 11),
    ("mgmt", "IKGPTU • 3 YEARS", "Bachelor of Commerce (B.Com Hons)", "Advanced taxation, accounting standards, corporate law, banking systems, and financial auditing.", "Eligibility: 10+2 with Commerce / Economics / Math", 12),
    ("mgmt", "AICTE • IKGPTU • 2 YEARS", "Master of Business Administration (MBA)", "Dual specializations in Finance, Marketing, HR, Operations, and Business Analytics.", "Eligibility: Graduation in Any Discipline (50%+)", 13),
    ("vocational", "UGC • IKGPTU • 3 YEARS", "Bachelor of Vocation (B.Voc)", "Skill-based vocational curriculum with intensive apprenticeship and direct industry trade certification.", "Eligibility: 10+2 in Any Stream", 14)
]

DEFAULT_SITE_CONTENT = {
    "hero_pill": "AICTE • IKGPTU • PCI • INC • BFUHS Approved • Punjab",
    "hero_title_highlight": "#Push Beyond",
    "hero_title_rest": "Boundaries",
    "hero_subheadline": "Where Learning Meets Lifestyle",
    "hero_subtitle": "Pioneering higher education across Engineering, Pharmacy, Nursing, Allied Health, Computer Applications & Management on a lush 10+ acre campus in Gurdaspur.",
    "cta_heading": "Admissions Open for {session} Session",
    "cta_desc": "Direct merit allotments and scholarship counseling are currently active. Early applicants receive priority hostel and branch choices.",
    "stat_years": "25+",
    "stat_years_title": "Years of Academic Excellence",
    "stat_years_sub": "Est. under S. Sukhjinder Singh Memorial Education Society",
    "stat_alumni": "500,000+",
    "stat_alumni_title": "Global SGI Alumni & Community",
    "stat_alumni_sub": "Thriving across India, Canada, UK, USA & Australia",
    "stat_students": "3,000+",
    "stat_students_title": "International & Out-of-State Students",
    "stat_students_sub": "Punjab, Himachal Pradesh, J&K, Ladakh & Global Cohorts",
    "stat_tieups": "150+",
    "stat_tieups_title": "Programs & 200+ Industry Tie-Ups",
    "stat_tieups_sub": "Multi-disciplinary UG, PG & Diplomas with Fortune 500 links",
    "stat_awards": "Awarded",
    "stat_awards_title": "National Education Awards",
    "stat_awards_sub": "Merit scholarships for Punjab, HP, J&K & SC/ST students",
    "placement_rate": "94%",
    "placement_desc": "The centralized Training & Placement (T&P) cell at SGI operates round the year, conducting aptitude coaching, mock technical interview sessions, industrial plant visits, and soft-skill bootcamps.",
    "placement_partners_count": "200+",
    "campus_life_title": "Shivalik Hills Campus & Holistic Growth",
    "campus_life_caption": "Shivalik Foothills • Smart Labs & Student Hub",
    "campus_life_img": "campus-wing-b.jpeg",
    "campus_life_desc": "Set amidst clean, green surroundings near the Shivalik Hills foothills, SGI combines smart digital classrooms, dedicated clinical nursing & pharma simulation labs, cultural fests, inter-college sports, NSS camps, and technical hackathons for complete holistic student development.",
    "helpline_phone": "+91 93160 93494",
    "contact_email": "admin@sgigurdaspur.org",
    "campus_address": "V.P.O. Hayat Nagar, Hardochhani Road, Gurdaspur, Punjab – 143521",
    "office_hours": "Monday – Saturday: 9:00 AM – 5:00 PM"
}


# -------------------------------------------------------------
# 1. Persistent Database Layer (PostgreSQL in production, SQLite for local dev)
# -------------------------------------------------------------
log = logging.getLogger("sgi")

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if DATABASE_URL.startswith("postgres://"):          # some hosts still hand out the legacy scheme
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]
USE_PG = DATABASE_URL.startswith("postgresql://")

if USE_PG:
    import psycopg2
    DBIntegrityError = psycopg2.IntegrityError
else:
    DBIntegrityError = sqlite3.IntegrityError
    if os.environ.get("REQUIRE_PERSISTENT_DB", "").strip() == "1":
        raise RuntimeError(
            "REQUIRE_PERSISTENT_DB=1 but DATABASE_URL is not set. Refusing to start on a "
            "local SQLite file, which is wiped on most cloud hosts. Set DATABASE_URL."
        )
    log.warning("Using LOCAL SQLite file (%s). This is NOT persistent on hosts with an "
                "ephemeral disk (Render/Heroku/Railway/Vercel...). Set DATABASE_URL.", DB_NAME)

# Tables whose INSERTs should report the new row id (emulates sqlite's cursor.lastrowid on Postgres)
_AUTOID_TABLES = {"users", "leads", "notices", "programs"}
_INSERT_RE = re.compile(r"^\s*INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+(\w+)", re.IGNORECASE)


def _normalize_value(v):
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")      # same text format SQLite produced
    if isinstance(v, memoryview):
        return bytes(v)
    return v


def _normalize_row(row):
    return None if row is None else tuple(_normalize_value(v) for v in row)


class _Cursor:
    """Tiny adapter so the existing sqlite-style code runs unchanged on PostgreSQL."""

    def __init__(self, raw_cursor):
        self._c = raw_cursor
        self.lastrowid = None

    @staticmethod
    def _translate(sql, want_id=True):
        stripped = sql.strip()
        if stripped.upper().startswith("PRAGMA"):
            return None
        ignore = bool(re.match(r"^\s*INSERT\s+OR\s+IGNORE", stripped, re.IGNORECASE))
        sql = re.sub(r"INSERT\s+OR\s+IGNORE\s+INTO", "INSERT INTO", sql, flags=re.IGNORECASE)
        sql = sql.replace("%", "%%").replace("?", "%s")
        sql = re.sub(r"\bLIKE\b", "ILIKE", sql)          # SQLite LIKE is case-insensitive
        sql = sql.rstrip().rstrip(";")
        if ignore:
            sql += " ON CONFLICT DO NOTHING"
        m = _INSERT_RE.match(sql)
        returning = False
        if want_id and m and m.group(1).lower() in _AUTOID_TABLES and "RETURNING" not in sql.upper():
            sql += " RETURNING id"
            returning = True
        return sql, returning

    def execute(self, sql, params=()):
        if not USE_PG:
            self._c.execute(sql, params)
            self.lastrowid = self._c.lastrowid
            return self
        translated = self._translate(sql)
        if translated is None:
            return self
        sql, returning = translated
        params = tuple(psycopg2.Binary(p) if isinstance(p, (bytes, bytearray)) else p for p in params)
        self._c.execute(sql, params)
        if returning:
            row = self._c.fetchone()
            self.lastrowid = row[0] if row else None
        return self

    def executemany(self, sql, seq):
        if not USE_PG:
            self._c.executemany(sql, seq)
            return self
        translated = self._translate(sql, want_id=False)
        if translated is None:
            return self
        for params in seq:
            self._c.execute(translated[0], tuple(params))
        return self

    def fetchone(self):
        return _normalize_row(self._c.fetchone())

    def fetchall(self):
        return [_normalize_row(r) for r in self._c.fetchall()]

    @property
    def rowcount(self):
        return self._c.rowcount


class _Connection:
    def __init__(self, raw):
        self._raw = raw

    def cursor(self):
        return _Cursor(self._raw.cursor())

    def execute(self, sql, params=()):
        return self.cursor().execute(sql, params)

    def commit(self):
        self._raw.commit()

    def rollback(self):
        self._raw.rollback()

    def close(self):
        try:
            self._raw.close()
        except Exception:
            pass


def get_db():
    if USE_PG:
        raw = psycopg2.connect(
            DATABASE_URL,
            connect_timeout=15,
            options="-c timezone=UTC",
            keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=5,
        )
        return _Connection(raw)
    raw = sqlite3.connect(DB_NAME, timeout=15.0)
    raw.execute("PRAGMA busy_timeout=5000;")
    return _Connection(raw)


# ---- File storage: PDFs & avatars live IN THE DATABASE (not on the web server's disk) ----
def store_file(name, kind, mimetype, data):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO files (name, kind, mimetype, data) VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET kind = excluded.kind, mimetype = excluded.mimetype, data = excluded.data
        """, (name, kind, mimetype, data))
        conn.commit()
    finally:
        conn.close()


def load_file(name):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT mimetype, data FROM files WHERE name = ?", (name,))
        return cur.fetchone()
    finally:
        conn.close()


def delete_file(name):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM files WHERE name = ?", (name,))
        conn.commit()
    finally:
        conn.close()


_SCHEMA_PG = [
    """CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL, role TEXT NOT NULL, department TEXT NOT NULL,
        avatar_url TEXT DEFAULT '', is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC'))""",
    """CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY, full_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT DEFAULT '',
        city TEXT DEFAULT '', program TEXT NOT NULL, branch TEXT NOT NULL,
        inquiry_type TEXT DEFAULT 'Admission Application', status TEXT DEFAULT 'New Inquiry',
        last_contacted_by TEXT DEFAULT 'Unassigned', counselor_notes TEXT DEFAULT '',
        timestamp TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC'))""",
    """CREATE TABLE IF NOT EXISTS notices (
        id SERIAL PRIMARY KEY, category TEXT NOT NULL, category_label TEXT NOT NULL, title TEXT NOT NULL,
        date TEXT NOT NULL, ref_no TEXT NOT NULL, authority TEXT NOT NULL, badge TEXT NOT NULL,
        badge_class TEXT DEFAULT 'badge-scholar', summary TEXT DEFAULT '', details TEXT DEFAULT '',
        pdf_url TEXT DEFAULT '', pdf_filename TEXT DEFAULT '', is_active INTEGER DEFAULT 1,
        created_by TEXT DEFAULT 'Admin', created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC'))""",
    """CREATE TABLE IF NOT EXISTS programs (
        id SERIAL PRIMARY KEY, category TEXT NOT NULL, code TEXT NOT NULL, title TEXT NOT NULL,
        description TEXT NOT NULL, eligibility TEXT NOT NULL, is_active INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC'))""",
    """CREATE TABLE IF NOT EXISTS site_content (
        key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_by TEXT DEFAULT 'Admin',
        updated_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC'))""",
    """CREATE TABLE IF NOT EXISTS files (
        name TEXT PRIMARY KEY, kind TEXT NOT NULL, mimetype TEXT DEFAULT '', data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC'))""",
    """CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)""",
]

_SCHEMA_SQLITE = [
    """CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL, role TEXT NOT NULL, department TEXT NOT NULL,
        avatar_url TEXT DEFAULT '', is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT DEFAULT '',
        city TEXT DEFAULT '', program TEXT NOT NULL, branch TEXT NOT NULL,
        inquiry_type TEXT DEFAULT 'Admission Application', status TEXT DEFAULT 'New Inquiry',
        last_contacted_by TEXT DEFAULT 'Unassigned', counselor_notes TEXT DEFAULT '',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, category_label TEXT NOT NULL,
        title TEXT NOT NULL, date TEXT NOT NULL, ref_no TEXT NOT NULL, authority TEXT NOT NULL,
        badge TEXT NOT NULL, badge_class TEXT DEFAULT 'badge-scholar', summary TEXT DEFAULT '',
        details TEXT DEFAULT '', pdf_url TEXT DEFAULT '', pdf_filename TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1, created_by TEXT DEFAULT 'Admin', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, code TEXT NOT NULL, title TEXT NOT NULL,
        description TEXT NOT NULL, eligibility TEXT NOT NULL, is_active INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS site_content (
        key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_by TEXT DEFAULT 'Admin',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS files (
        name TEXT PRIMARY KEY, kind TEXT NOT NULL, mimetype TEXT DEFAULT '', data BLOB NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)""",
]


def _seed_once(cursor, flag, table, seed_fn):
    """Seed hardcoded defaults ONLY on the very first launch of an empty store.

    A flag row in app_meta remembers that seeding happened, so if an admin later
    deletes every notice/program on purpose, a restart will NOT bring the defaults back.
    """
    cursor.execute("SELECT value FROM app_meta WHERE key = ?", (flag,))
    if cursor.fetchone():
        return
    cursor.execute(f"SELECT COUNT(*) FROM {table}")
    if cursor.fetchone()[0] == 0:
        seed_fn()
    cursor.execute("INSERT INTO app_meta (key, value) VALUES (?, '1') ON CONFLICT(key) DO NOTHING", (flag,))


def init_db():
    conn = get_db()
    try:
        cursor = conn.cursor()
        if USE_PG:
            # Serialises first-time setup when several gunicorn workers boot at once.
            cursor.execute("SELECT pg_advisory_xact_lock(727274001)")
        else:
            conn._raw.execute("PRAGMA journal_mode=WAL;")

        for stmt in (_SCHEMA_PG if USE_PG else _SCHEMA_SQLITE):
            cursor.execute(stmt)

        if not USE_PG:
            # Safe migrations for databases created by older versions (SQLite only;
            # a fresh Postgres schema already has every column).
            cursor.execute("PRAGMA table_info(users)")
            user_cols = {row[1] for row in cursor.fetchall()}
            if 'avatar_url' not in user_cols:
                cursor.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''")

            cursor.execute("PRAGMA table_info(leads)")
            existing_cols = {row[1] for row in cursor.fetchall()}
            if 'email' not in existing_cols:
                cursor.execute("ALTER TABLE leads ADD COLUMN email TEXT DEFAULT ''")
            if 'city' not in existing_cols:
                cursor.execute("ALTER TABLE leads ADD COLUMN city TEXT DEFAULT ''")
            if 'inquiry_type' not in existing_cols:
                cursor.execute("ALTER TABLE leads ADD COLUMN inquiry_type TEXT DEFAULT 'Admission Application'")

            cursor.execute("PRAGMA table_info(notices)")
            notice_cols = {row[1] for row in cursor.fetchall()}
            if 'pdf_url' not in notice_cols:
                cursor.execute("ALTER TABLE notices ADD COLUMN pdf_url TEXT DEFAULT ''")
            if 'pdf_filename' not in notice_cols:
                cursor.execute("ALTER TABLE notices ADD COLUMN pdf_filename TEXT DEFAULT ''")

        def seed_admin():
            pwd = os.environ.get("ADMIN_INITIAL_PASSWORD", "").strip() or "SGI@Admin2026"
            cursor.execute("""
                INSERT INTO users (username, password_hash, full_name, role, department, avatar_url)
                VALUES (?, ?, ?, ?, ?, '')
            """, ('admin', generate_password_hash(pwd), 'Director of Admissions', 'super_admin', 'All'))

        def seed_notices():
            cursor.executemany("""
                INSERT INTO notices (category, category_label, title, date, ref_no, authority, badge, badge_class, summary, details, is_active, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'System Seed')
            """, DEFAULT_NOTICES)

        def seed_programs():
            cursor.executemany("""
                INSERT INTO programs (category, code, title, description, eligibility, display_order, is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            """, DEFAULT_PROGRAMS)

        _seed_once(cursor, "seeded_admin", "users", seed_admin)
        _seed_once(cursor, "seeded_notices", "notices", seed_notices)
        _seed_once(cursor, "seeded_programs", "programs", seed_programs)

        # Add any site_content keys that don't exist yet. NEVER overwrites a saved value.
        for k, v in DEFAULT_SITE_CONTENT.items():
            cursor.execute("""
                INSERT OR IGNORE INTO site_content (key, value, updated_by)
                VALUES (?, ?, 'System Seed')
            """, (k, v))

        # One-time import of any legacy files that were previously stored on local disk.
        for folder, kind in ((UPLOAD_NOTICES_DIR, "notice"), (UPLOAD_AVATARS_DIR, "avatar")):
            try:
                for fname in os.listdir(folder):
                    fpath = os.path.join(folder, fname)
                    if os.path.isfile(fpath):
                        with open(fpath, "rb") as fh:
                            blob = fh.read()
                        cursor.execute("""
                            INSERT OR IGNORE INTO files (name, kind, mimetype, data) VALUES (?, ?, ?, ?)
                        """, (fname, kind, mimetypes.guess_type(fname)[0] or "application/octet-stream", blob))
            except OSError:
                pass

        conn.commit()
    finally:
        conn.close()


init_db()


def categorize_program(program_name, department_hint=""):
    p = f"{program_name} {department_hint}".lower()
    if "pharm" in p:
        return "Pharmacy"
    elif "nurs" in p or "gnm" in p:
        return "Nursing"
    elif "ayurved" in p:
        return "Ayurveda"
    elif "diploma in" in p or "poly" in p:
        return "Polytechnic"
    elif "tech" in p or "mech" in p or "civil" in p or "cse" in p or "engine" in p:
        return "Engineering"
    elif "mba" in p or "bba" in p or "bca" in p or "b.com" in p or "b.voc" in p or "computer science" in p or "manage" in p:
        return "Management & IT"
    elif "mls" in p or "paramed" in p or "medical lab" in p:
        return "Paramedical & Sciences"
    return "General"


def save_notice_pdf(file_storage):
    """Validates an uploaded PDF and stores it in the database. Returns (pdf_url, original_filename)."""
    original_name = (file_storage.filename or "").strip()
    if not original_name:
        return None, None
    if not original_name.lower().endswith('.pdf'):
        raise ValueError("Only PDF (.pdf) files are allowed.")

    data = file_storage.read()
    if not data or b'%PDF-' not in data[:1024]:
        raise ValueError("The uploaded file is not a valid PDF document.")

    safe_orig = secure_filename(original_name) or "circular.pdf"
    unique_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}_{safe_orig}"
    store_file(unique_name, "notice", "application/pdf", data)
    return f"/uploads/notices/{unique_name}", original_name


def remove_notice_pdf_file(pdf_url):
    """Removes a previously uploaded notice PDF (database copy + any legacy disk copy)."""
    if not pdf_url or not pdf_url.startswith("/uploads/notices/"):
        return
    filename = os.path.basename(pdf_url.split("?")[0])
    delete_file(filename)
    legacy = os.path.join(UPLOAD_NOTICES_DIR, filename)
    if os.path.isfile(legacy):
        try:
            os.remove(legacy)
        except OSError:
            pass


def save_avatar_image(file_storage, user_id_hint="staff"):
    """Validates a staff avatar image (JPG/PNG/WebP) and stores it in the database."""
    original_name = (file_storage.filename or "avatar.png").strip()
    ext = os.path.splitext(original_name)[1].lower()
    if ext not in ALLOWED_AVATAR_EXTS:
        # Check mimetype fallback for cropped canvas blobs
        mimetype = (file_storage.mimetype or "").lower()
        if "png" in mimetype:
            ext = ".png"
        elif "webp" in mimetype:
            ext = ".webp"
        elif "jpeg" in mimetype or "jpg" in mimetype:
            ext = ".jpg"
        else:
            raise ValueError("Only JPG, PNG, and WebP images are supported.")

    data = file_storage.read()
    if not data:
        raise ValueError("The uploaded image is empty.")

    unique_name = f"staff_{user_id_hint}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}{ext}"
    store_file(unique_name, "avatar", mimetypes.guess_type(unique_name)[0] or "image/png", data)
    return f"/uploads/avatars/{unique_name}"


def remove_avatar_file(avatar_url):
    """Removes a previously uploaded avatar (database copy + any legacy disk copy)."""
    if not avatar_url or not avatar_url.startswith("/uploads/avatars/"):
        return
    filename = os.path.basename(avatar_url.split("?")[0])
    delete_file(filename)
    legacy = os.path.join(UPLOAD_AVATARS_DIR, filename)
    if os.path.isfile(legacy):
        try:
            os.remove(legacy)
        except OSError:
            pass


def row_to_notice_dict(r):
    return {
        "id": r[0],
        "category": r[1],
        "category_label": r[2],
        "title": r[3],
        "date": r[4],
        "ref_no": r[5],
        "authority": r[6],
        "badge": r[7],
        "badge_class": r[8],
        "summary": r[9] or "",
        "details": r[10] or "",
        "pdf_url": r[11] or "",
        "pdf_filename": r[12] or "",
        "is_active": bool(r[13]),
        "created_by": r[14],
        "created_at": r[15]
    }


def row_to_program_dict(r):
    return {
        "id": r[0],
        "category": r[1],
        "code": r[2],
        "title": r[3],
        "description": r[4],
        "eligibility": r[5],
        "is_active": bool(r[6]),
        "display_order": r[7]
    }


def fetch_site_content_dict():
    content = dict(DEFAULT_SITE_CONTENT)
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM site_content")
        for k, v in cursor.fetchall():
            content[k] = v
    finally:
        conn.close()
    return content


# -------------------------------------------------------------
# 2. Authentication Guards (Live DB Enforcement)
# -------------------------------------------------------------
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            if request.path.startswith('/api/'):
                return jsonify({"error": "Unauthorized"}), 401
            return redirect(url_for('admin_login'))

        conn = get_db()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT is_active, role, department, full_name FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
        finally:
            conn.close()

        if not row or row[0] == 0:
            session.clear()
            if request.path.startswith('/api/'):
                return jsonify({"error": "Account disabled or removed."}), 401
            return redirect(url_for('admin_login'))

        session['role'] = row[1]
        session['department'] = row[2]
        session['full_name'] = row[3]
        return f(*args, **kwargs)
    return decorated_function


def super_admin_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if session.get('role') != 'super_admin':
            return jsonify({"error": "Access Denied. Super Admin only."}), 403
        return f(*args, **kwargs)
    return decorated_function


def academic_editor_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if session.get('role') not in ('super_admin', 'hod'):
            return jsonify({"error": "Access Denied. Super Admin or HOD required."}), 403
        return f(*args, **kwargs)
    return decorated_function


@app.after_request
def add_security_headers(response):
    no_store_paths = (
        '/',
        '/index.html',
        '/main.js',
        '/styles.css',
        '/admin.html',
    )
    if (
        request.path in no_store_paths
        or request.path.startswith('/admin')
        or request.path.startswith('/api/')
    ):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '-1'
    return response


# -------------------------------------------------------------
# 3. Public Front-End Routes
# -------------------------------------------------------------
@app.route('/')
def serve_index():
    """Serve index.html with the CURRENT database content embedded, so the very first
    paint shows saved values (no flash of hardcoded text). main.js then refreshes it."""
    with open(os.path.join(BASE_DIR, 'index.html'), 'r', encoding='utf-8') as fh:
        html = fh.read()
    try:
        payload = json.dumps(build_public_payload(), ensure_ascii=False)
        payload = payload.replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
        boot = f'<script id="sgi-boot" type="application/json">{payload}</script>'
        html = html.replace('</head>', boot + '\n</head>', 1)
    except Exception:
        log.exception("could not embed boot payload; serving plain page")
    return Response(html, mimetype='text/html')


ONE_YEAR = 31536000  # upload filenames are unique per upload, so they are safe to cache forever


def _serve_stored_file(filename, legacy_dir, default_mime, as_download=False, download_name=None):
    safe_name = os.path.basename(filename)
    row = load_file(safe_name)
    if row:
        mimetype, data = row
        return send_file(
            io.BytesIO(data),
            mimetype=mimetype or default_mime,
            as_attachment=as_download,
            download_name=(download_name or safe_name) if as_download else None,
            max_age=ONE_YEAR,
        )
    legacy_path = os.path.join(legacy_dir, safe_name)       # pre-migration files still on disk
    if os.path.isfile(legacy_path):
        return send_from_directory(legacy_dir, safe_name, as_attachment=as_download,
                                   download_name=download_name if as_download else None)
    abort(404)


@app.route('/uploads/notices/<path:filename>')
def serve_notice_pdf(filename):
    as_download = request.args.get('download', '').lower() in ('1', 'true', 'yes')
    download_name = None
    if as_download:
        pdf_url = f"/uploads/notices/{filename}"
        conn = get_db()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT pdf_filename FROM notices WHERE pdf_url = ? LIMIT 1", (pdf_url,))
            row = cursor.fetchone()
            if row and row[0]:
                download_name = row[0]
        finally:
            conn.close()
    return _serve_stored_file(filename, UPLOAD_NOTICES_DIR, "application/pdf", as_download, download_name)


@app.route('/uploads/avatars/<path:filename>')
def serve_avatar_image(filename):
    return _serve_stored_file(filename, UPLOAD_AVATARS_DIR, "image/png")


@app.route('/healthz')
def healthz():
    """Cheap liveness + database check (also handy for an uptime pinger)."""
    try:
        conn = get_db()
        try:
            conn.cursor().execute("SELECT 1")
        finally:
            conn.close()
        return jsonify({"status": "ok", "database": "postgresql" if USE_PG else "sqlite"})
    except Exception as exc:
        log.exception("health check failed")
        return jsonify({"status": "error", "database": "unreachable"}), 503


@app.route('/api/apply', methods=['POST'])
def handle_application():
    data = request.get_json() or {}
    full_name = data.get('full_name', '').strip()
    phone = data.get('phone', '').strip()
    email = data.get('email', '').strip()
    city = data.get('city', '').strip()
    program = data.get('program', '').strip()

    if not full_name or not phone or not email or not city or not program:
        return jsonify({"success": False, "message": "All fields (Name, Phone, Email, City, Program) are required."}), 400

    if not EMAIL_REGEX.match(email):
        return jsonify({"success": False, "message": "Please enter a valid email address."}), 400

    branch = categorize_program(program)

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO leads (full_name, phone, email, city, program, branch, inquiry_type, status)
            VALUES (?, ?, ?, ?, ?, ?, 'Admission Application', 'New Inquiry')
        """, (full_name, phone, email, city, program, branch))
        conn.commit()
        lead_id = cursor.lastrowid

        return jsonify({
            "success": True,
            "message": "Application stored successfully.",
            "lead_id": lead_id,
            "branch": branch,
            "recorded_at": datetime.utcnow().isoformat()
        }), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/contact', methods=['POST'])
def handle_contact_routing():
    data = request.get_json() or {}
    full_name = data.get('full_name', '').strip()
    phone = data.get('phone', '').strip()
    email = data.get('email', '').strip()
    city = data.get('city', '').strip()
    program = data.get('program', '').strip()
    department = data.get('department', '').strip() or categorize_program(program)
    desk = data.get('desk', 'Contact Desk').strip()
    message = data.get('message', '').strip()

    if not full_name or not phone or not email or not city or not program:
        return jsonify({"success": False, "message": "Please fill in all required contact and course fields."}), 400

    if not EMAIL_REGEX.match(email):
        return jsonify({"success": False, "message": "Please enter a valid email address."}), 400

    branch = categorize_program(program, department)

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO leads (full_name, phone, email, city, program, branch, inquiry_type, counselor_notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New Inquiry')
        """, (full_name, phone, email, city, program, branch, f"Routed: {desk}", message))
        conn.commit()
        lead_id = cursor.lastrowid

        return jsonify({
            "success": True,
            "message": f"Inquiry submitted for {program}.",
            "lead_id": lead_id,
            "branch": branch
        }), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/notices', methods=['GET'])
def get_live_notices():
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, category, category_label, title, date, ref_no, authority, badge, badge_class, summary, details, pdf_url, pdf_filename, is_active, created_by, created_at
            FROM notices
            WHERE is_active = 1
            ORDER BY id DESC
        """)
        notices = [row_to_notice_dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()
    return jsonify({"notices": notices})


def build_public_payload():
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, category, category_label, title, date, ref_no, authority, badge, badge_class, summary, details, pdf_url, pdf_filename, is_active, created_by, created_at
            FROM notices
            WHERE is_active = 1
            ORDER BY id DESC
        """)
        notices = [row_to_notice_dict(r) for r in cursor.fetchall()]

        cursor.execute("""
            SELECT id, category, code, title, description, eligibility, is_active, display_order
            FROM programs
            WHERE is_active = 1
            ORDER BY display_order ASC, id ASC
        """)
        programs = [row_to_program_dict(r) for r in cursor.fetchall()]

        cursor.execute("""
            SELECT id, full_name, role, department, COALESCE(avatar_url, '')
            FROM users
            WHERE is_active = 1
            ORDER BY
                CASE role
                    WHEN 'super_admin' THEN 1
                    WHEN 'hod' THEN 2
                    ELSE 3
                END,
                id ASC
        """)
        staff_profiles = [
            {
                "id": r[0],
                "full_name": r[1],
                "role": r[2],
                "department": r[3],
                "avatar_url": r[4] or ""
            }
            for r in cursor.fetchall()
        ]
    finally:
        conn.close()

    site_content = fetch_site_content_dict()
    return {
        "notices": notices,
        "programs": programs,
        "site_content": site_content,
        "staff_profiles": staff_profiles
    }


@app.route('/api/public-content', methods=['GET'])
def get_public_content():
    return jsonify(build_public_payload())


# -------------------------------------------------------------
# 4. Admin Authentication (Branded Deep Navy & Amber)
# -------------------------------------------------------------
LOGIN_PAGE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SGI Staff Portal | Authentication</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Syne:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0B2545;
      --card-bg: rgba(19, 49, 92, 0.96);
      --border: rgba(255, 255, 255, 0.14);
      --accent: #F4B400;
      --text: #FFFFFF;
      --text-muted: #CBD5E1;
      --error: #ff6b6b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at top right, #13315C 0%, #0B2545 65%, #071930 100%);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .login-box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 2.5rem;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.45);
      text-align: center;
    }
    .badge-lock {
      background: rgba(244, 180, 0, 0.15);
      border: 1px solid var(--accent);
      color: #FFC107;
      padding: 5px 14px;
      border-radius: 30px;
      font-size: 0.78rem;
      font-weight: 800;
      display: inline-block;
      margin-bottom: 1.2rem;
    }
    h2 { font-family: 'Syne', sans-serif; font-size: 1.8rem; margin-bottom: 0.5rem; }
    p { font-size: 0.88rem; color: var(--text-muted); margin-bottom: 1.8rem; }
    .input-group { text-align: left; margin-bottom: 1.1rem; }
    label { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.4rem; }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 0.85rem 1rem;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: rgba(11, 37, 69, 0.75);
      color: var(--text);
      font-size: 0.95rem;
      outline: none;
      font-family: inherit;
    }
    input[type="text"]:focus, input[type="password"]:focus { border-color: var(--accent); }
    .btn-login {
      width: 100%;
      background: linear-gradient(135deg, #F4B400, #FFC107);
      color: #0B2545;
      border: none;
      padding: 0.9rem;
      border-radius: 10px;
      font-weight: 800;
      font-size: 0.95rem;
      cursor: pointer;
      margin-top: 0.6rem;
      font-family: inherit;
      transition: opacity 0.2s;
    }
    .btn-login:hover { opacity: 0.92; }
    .error-msg {
      background: rgba(255, 107, 107, 0.14);
      border: 1px solid var(--error);
      color: var(--error);
      padding: 0.65rem;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 1.2rem;
    }
    .back-link {
      display: inline-block;
      margin-top: 1.5rem;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.82rem;
    }
    .back-link:hover { color: #FFC107; }
  </style>
</head>
<body>
  <div class="login-box">
    <span class="badge-lock">🔒 SGI FACULTY & STAFF CRM</span>
    <h2>Staff Authentication</h2>
    <p>Sign in with your institutional credentials to access student admissions.</p>

    {{ERROR_ALERT}}

    <form method="POST" action="/admin/login">
      <div class="input-group">
        <label for="username">Username or Institutional Email</label>
        <input type="text" id="username" name="username" placeholder="e.g. admin or dr.sharma" autofocus required autocomplete="off">
      </div>
      <div class="input-group">
        <label for="password">Account Password</label>
        <input type="password" id="password" name="password" placeholder="••••••••••••" required autocomplete="off">
      </div>
      <button type="submit" class="btn-login">Sign In to Dashboard &rarr;</button>
    </form>

    <a href="/" class="back-link">&larr; Return to SGI Home</a>
  </div>

  <script>
    sessionStorage.removeItem('sgi_admin_active');
  </script>
</body>
</html>"""

SUCCESS_REDIRECT_SCRIPT = """<!DOCTYPE html>
<html>
<head><title>Authenticating...</title></head>
<body>
  <script>
    sessionStorage.setItem('sgi_admin_active', '1');
    window.location.replace('/admin');
  </script>
</body>
</html>"""


@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        conn = get_db()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, password_hash, full_name, role, department, is_active FROM users WHERE username = ?", (username,))
            user = cursor.fetchone()
        finally:
            conn.close()

        if user and check_password_hash(user[2], password):
            if user[6] == 0:
                err_html = '<div class="error-msg">⚠️ Account deactivated. Please contact the Director.</div>'
                return LOGIN_PAGE_HTML.replace('{{ERROR_ALERT}}', err_html)

            session['user_id'] = user[0]
            session['username'] = user[1]
            session['full_name'] = user[3]
            session['role'] = user[4]
            session['department'] = user[5]
            session['login_time'] = datetime.now().strftime('%d %b %Y, %I:%M %p')

            return SUCCESS_REDIRECT_SCRIPT

        err_html = '<div class="error-msg">⚠️ Invalid Username or Password.</div>'
        return LOGIN_PAGE_HTML.replace('{{ERROR_ALERT}}', err_html)

    session.clear()
    resp = make_response(LOGIN_PAGE_HTML.replace('{{ERROR_ALERT}}', ''))
    resp.delete_cookie(app.config.get('SESSION_COOKIE_NAME', 'session'))
    return resp


@app.route('/admin/logout')
def admin_logout():
    session.clear()
    resp = redirect(url_for('admin_login'))
    resp.delete_cookie(app.config.get('SESSION_COOKIE_NAME', 'session'))
    return resp


@app.route('/admin', strict_slashes=False)
@app.route('/admin/', strict_slashes=False)
@login_required
def serve_admin():
    return send_from_directory(BASE_DIR, 'admin.html')


# -------------------------------------------------------------
# 5. APIs for Profile, CRM Dashboard, Notices, Programs, Site Content & Staff
# -------------------------------------------------------------
@app.route('/api/admin/storage-status', methods=['GET'])
@login_required
def admin_storage_status():
    conn = get_db()
    try:
        cursor = conn.cursor()
        counts = {}
        for table in ('site_content', 'notices', 'programs', 'users', 'files'):
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            counts[table] = cursor.fetchone()[0]
        cursor.execute("SELECT MAX(updated_at) FROM site_content")
        last_update = cursor.fetchone()[0]
    finally:
        conn.close()
    return jsonify({
        "backend": "postgresql" if USE_PG else "sqlite",
        "persistent": USE_PG,
        "counts": counts,
        "content_last_updated_utc": last_update,
    })


@app.route('/api/admin/profile', methods=['GET'])
@login_required
def get_admin_profile():
    user_id = session.get('user_id')
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, full_name, username, role, department, COALESCE(avatar_url, '') FROM users WHERE id = ?",
            (user_id,)
        )
        row = cursor.fetchone()
    finally:
        conn.close()

    if not row:
        return jsonify({"error": "Unauthorized"}), 401

    return jsonify({
        "id": row[0],
        "name": row[1],
        "username": row[2],
        "role": row[3],
        "department": row[4],
        "avatar_url": row[5] or "",
        "session_time": session.get('login_time', datetime.now().strftime('%d %b %Y, %I:%M %p'))
    })


@app.route('/api/admin/profile/avatar', methods=['POST', 'DELETE'])
@login_required
def update_own_profile_avatar():
    user_id = session.get('user_id')
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COALESCE(avatar_url, '') FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"success": False, "message": "User not found."}), 404
        old_avatar_url = row[0]

        if request.method == 'DELETE' or request.form.get('remove') == '1':
            remove_avatar_file(old_avatar_url)
            cursor.execute("UPDATE users SET avatar_url = '' WHERE id = ?", (user_id,))
            conn.commit()
            return jsonify({"success": True, "avatar_url": "", "message": "Profile photo removed."})

        if 'avatar_file' not in request.files:
            return jsonify({"success": False, "message": "No image file provided."}), 400

        uploaded_file = request.files['avatar_file']
        if not uploaded_file or not uploaded_file.filename:
            return jsonify({"success": False, "message": "No image file selected."}), 400

        try:
            new_avatar_url = save_avatar_image(uploaded_file, user_id_hint=str(user_id))
        except ValueError as ve:
            return jsonify({"success": False, "message": str(ve)}), 400

        remove_avatar_file(old_avatar_url)
        cursor.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (new_avatar_url, user_id))
        conn.commit()
        return jsonify({"success": True, "avatar_url": new_avatar_url, "message": "Profile photo updated!"})
    finally:
        conn.close()


@app.route('/api/leads', methods=['GET'])
@login_required
def get_leads():
    user_dept = session.get('department', 'All')
    requested_branch = request.args.get('branch', '').strip()

    conn = get_db()
    try:
        cursor = conn.cursor()
        base_select = """
            SELECT id, full_name, phone, email, city, program, branch, inquiry_type, status, last_contacted_by, counselor_notes, timestamp
            FROM leads
        """
        if user_dept != 'All':
            cursor.execute(
                f"{base_select} WHERE branch LIKE ? ORDER BY timestamp DESC",
                (f"%{user_dept}%",)
            )
        else:
            if requested_branch and requested_branch.lower() != 'all':
                cursor.execute(
                    f"{base_select} WHERE branch LIKE ? ORDER BY timestamp DESC",
                    (f"%{requested_branch}%",)
                )
            else:
                cursor.execute(f"{base_select} ORDER BY timestamp DESC")

        rows = cursor.fetchall()
    finally:
        conn.close()

    leads = [
        {
            "id": r[0],
            "name": r[1],
            "phone": r[2],
            "email": r[3] or "—",
            "city": r[4] or "—",
            "program": r[5],
            "branch": r[6],
            "inquiry_type": r[7] or "Admission Application",
            "status": r[8] or "New Inquiry",
            "last_contacted_by": r[9] or "Unassigned",
            "notes": r[10] or "",
            "timestamp": r[11]
        }
        for r in rows
    ]
    return jsonify({"leads": leads, "count": len(leads)})


@app.route('/api/leads/update-status/<int:lead_id>', methods=['POST'])
@login_required
def update_lead_status(lead_id):
    data = request.get_json() or {}
    new_status = data.get('status', 'Contacted').strip()
    counselor_name = session.get('full_name', 'Admissions Desk')

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE leads SET status = ?, last_contacted_by = ? WHERE id = ?",
            (new_status, counselor_name, lead_id)
        )
        conn.commit()
    finally:
        conn.close()

    return jsonify({"success": True, "status": new_status, "updated_by": counselor_name})


@app.route('/api/admin/stats', methods=['GET'])
@login_required
def get_admin_stats():
    user_dept = session.get('department', 'All')

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM leads")
        total = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM leads WHERE branch = 'Engineering'")
        engineering = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM leads WHERE branch = 'Pharmacy'")
        pharmacy = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM leads WHERE branch = 'Nursing'")
        nursing = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM leads WHERE branch = 'Management & IT'")
        management = cursor.fetchone()[0]
    finally:
        conn.close()

    return jsonify({
        "total": total,
        "engineering": engineering,
        "pharmacy": pharmacy,
        "nursing": nursing,
        "management": management,
        "user_department": user_dept
    })


@app.route('/api/export-leads', methods=['GET'])
@login_required
def export_leads_csv():
    user_dept = session.get('department', 'All')
    requested_branch = request.args.get('branch', 'all').strip()

    conn = get_db()
    try:
        cursor = conn.cursor()
        base_select = """
            SELECT id, full_name, phone, email, city, program, branch, inquiry_type, status, last_contacted_by, counselor_notes, timestamp
            FROM leads
        """
        if user_dept != 'All':
            cursor.execute(
                f"{base_select} WHERE branch LIKE ? ORDER BY timestamp DESC",
                (f"%{user_dept}%",)
            )
            export_title = user_dept
        else:
            if requested_branch.lower() != 'all':
                cursor.execute(
                    f"{base_select} WHERE branch LIKE ? ORDER BY timestamp DESC",
                    (f"%{requested_branch}%",)
                )
                export_title = requested_branch
            else:
                cursor.execute(f"{base_select} ORDER BY timestamp DESC")
                export_title = "Master"

        rows = cursor.fetchall()
    finally:
        conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Student Name", "Phone Number", "Email", "City/District",
        "Program", "Branch", "Inquiry Type", "Status", "Assigned Counselor",
        "Notes", "Submission Date"
    ])
    for row in rows:
        writer.writerow(row)

    output.seek(0)
    slug = export_title.replace(' ', '_')
    filename = f"SGI_{slug}_Admissions_{datetime.now().strftime('%Y%m%d')}.csv"

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )


# -------------------------------------------------------------
# 6. Admin Notices & Circulars CRUD APIs (Supports PDF FormData + JSON)
# -------------------------------------------------------------
@app.route('/api/admin/notices', methods=['GET'])
@login_required
def admin_list_notices():
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, category, category_label, title, date, ref_no, authority, badge, badge_class, summary, details, pdf_url, pdf_filename, is_active, created_by, created_at
            FROM notices
            ORDER BY id DESC
        """)
        notices = [row_to_notice_dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()
    return jsonify({"notices": notices})


@app.route('/api/admin/notices', methods=['POST'])
@login_required
def admin_create_notice():
    is_multipart = bool(request.content_type and 'multipart/form-data' in request.content_type)
    data = request.form if is_multipart else (request.get_json(silent=True) or {})

    category = (data.get('category') or 'ikgptu').strip()
    category_label = (data.get('category_label') or 'Academic Notice').strip()
    title = (data.get('title') or '').strip()
    date_label = (data.get('date') or '').strip() or datetime.now().strftime('%d %b %Y')
    ref_no = (data.get('ref_no') or '').strip()
    authority = (data.get('authority') or '').strip()
    badge = (data.get('badge') or '').strip() or category_label
    badge_class = (data.get('badge_class') or 'badge-scholar').strip()
    summary = (data.get('summary') or f"Official circular issued by {authority} (Ref: {ref_no}).").strip()
    details = (data.get('details') or title).strip()

    raw_active = str(data.get('is_active', '1')).strip().lower()
    is_active = 1 if raw_active in ('1', 'true', 'yes', 'on') else 0
    created_by = session.get('full_name', 'Admin')

    if not title or not ref_no or not authority:
        return jsonify({"success": False, "message": "Headline, Reference Number, and Issuing Authority are required."}), 400

    pdf_url = ""
    pdf_filename = ""
    if is_multipart and 'pdf_file' in request.files:
        uploaded_file = request.files['pdf_file']
        if uploaded_file and uploaded_file.filename:
            try:
                pdf_url, pdf_filename = save_notice_pdf(uploaded_file)
            except ValueError as ve:
                return jsonify({"success": False, "message": str(ve)}), 400

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO notices (category, category_label, title, date, ref_no, authority, badge, badge_class, summary, details, pdf_url, pdf_filename, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (category, category_label, title, date_label, ref_no, authority, badge, badge_class, summary, details, pdf_url, pdf_filename, is_active, created_by))
        conn.commit()
        new_id = cursor.lastrowid
    finally:
        conn.close()

    return jsonify({"success": True, "id": new_id, "pdf_url": pdf_url}), 201


@app.route('/api/admin/notices/<int:notice_id>', methods=['PUT'])
@login_required
def admin_update_notice(notice_id):
    is_multipart = bool(request.content_type and 'multipart/form-data' in request.content_type)
    data = request.form if is_multipart else (request.get_json(silent=True) or {})

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT category, category_label, title, date, ref_no, authority, badge, badge_class, summary, details, pdf_url, pdf_filename, is_active
            FROM notices WHERE id = ?
        """, (notice_id,))
        existing = cursor.fetchone()
        if not existing:
            return jsonify({"success": False, "message": "Notice not found."}), 404

        category = (data.get('category') if 'category' in data else existing[0]).strip()
        category_label = (data.get('category_label') if 'category_label' in data else existing[1]).strip()
        title = (data.get('title') if 'title' in data else existing[2]).strip()
        date_label = (data.get('date') if 'date' in data else existing[3]).strip()
        ref_no = (data.get('ref_no') if 'ref_no' in data else existing[4]).strip()
        authority = (data.get('authority') if 'authority' in data else existing[5]).strip()
        badge = (data.get('badge') if 'badge' in data else existing[6]).strip()
        badge_class = (data.get('badge_class') if 'badge_class' in data else existing[7]).strip()
        summary = (data.get('summary') if 'summary' in data else (existing[8] or '')).strip()
        details = (data.get('details') if 'details' in data else (existing[9] or '')).strip()
        pdf_url = existing[10] or ""
        pdf_filename = existing[11] or ""

        if 'is_active' in data:
            raw_active = str(data.get('is_active')).strip().lower()
            is_active = 1 if raw_active in ('1', 'true', 'yes', 'on') else 0
        else:
            is_active = existing[12]

        if is_multipart and 'pdf_file' in request.files:
            uploaded_file = request.files['pdf_file']
            if uploaded_file and uploaded_file.filename:
                try:
                    new_url, new_filename = save_notice_pdf(uploaded_file)
                    remove_notice_pdf_file(pdf_url)
                    pdf_url, pdf_filename = new_url, new_filename
                except ValueError as ve:
                    return jsonify({"success": False, "message": str(ve)}), 400

        cursor.execute("""
            UPDATE notices
            SET category = ?, category_label = ?, title = ?, date = ?, ref_no = ?,
                authority = ?, badge = ?, badge_class = ?, summary = ?, details = ?,
                pdf_url = ?, pdf_filename = ?, is_active = ?
            WHERE id = ?
        """, (
            category, category_label, title, date_label, ref_no,
            authority, badge, badge_class, summary, details,
            pdf_url, pdf_filename, is_active, notice_id
        ))
        conn.commit()
    finally:
        conn.close()

    return jsonify({"success": True, "pdf_url": pdf_url})


@app.route('/api/admin/notices/<int:notice_id>', methods=['DELETE'])
@login_required
def admin_delete_notice(notice_id):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT pdf_url FROM notices WHERE id = ?", (notice_id,))
        row = cursor.fetchone()
        if row and row[0]:
            remove_notice_pdf_file(row[0])
        cursor.execute("DELETE FROM notices WHERE id = ?", (notice_id,))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True})


# -------------------------------------------------------------
# 7. Admin Degree Programs CRUD APIs
# -------------------------------------------------------------
@app.route('/api/admin/programs', methods=['GET'])
@login_required
def admin_list_programs():
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, category, code, title, description, eligibility, is_active, display_order
            FROM programs
            ORDER BY display_order ASC, id ASC
        """)
        programs = [row_to_program_dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()
    return jsonify({"programs": programs})


@app.route('/api/admin/programs', methods=['POST'])
@academic_editor_required
def admin_create_program():
    data = request.get_json() or {}
    category = data.get('category', 'engineering').strip()
    code = data.get('code', '').strip()
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    eligibility = data.get('eligibility', '').strip()
    is_active = 1 if data.get('is_active', 1) else 0
    display_order = int(data.get('display_order', 0) or 0)

    if not code or not title or not description or not eligibility:
        return jsonify({"success": False, "message": "All degree program fields are required."}), 400

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO programs (category, code, title, description, eligibility, is_active, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (category, code, title, description, eligibility, is_active, display_order))
        conn.commit()
        new_id = cursor.lastrowid
    finally:
        conn.close()

    return jsonify({"success": True, "id": new_id}), 201


@app.route('/api/admin/programs/<int:prog_id>', methods=['PUT'])
@academic_editor_required
def admin_update_program(prog_id):
    data = request.get_json() or {}
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE programs
            SET category = ?, code = ?, title = ?, description = ?, eligibility = ?, is_active = ?, display_order = ?
            WHERE id = ?
        """, (
            data.get('category', 'engineering').strip(),
            data.get('code', '').strip(),
            data.get('title', '').strip(),
            data.get('description', '').strip(),
            data.get('eligibility', '').strip(),
            1 if data.get('is_active', 1) else 0,
            int(data.get('display_order', 0) or 0),
            prog_id
        ))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True})


@app.route('/api/admin/programs/<int:prog_id>', methods=['DELETE'])
@academic_editor_required
def admin_delete_program(prog_id):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM programs WHERE id = ?", (prog_id,))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True})


# -------------------------------------------------------------
# 8. Admin Dynamic Site Content & Highlights APIs
# -------------------------------------------------------------
@app.route('/api/admin/content', methods=['GET'])
@login_required
def admin_get_site_content():
    return jsonify({"content": fetch_site_content_dict()})


@app.route('/api/admin/content', methods=['PUT'])
@super_admin_required
def admin_update_site_content():
    data = request.get_json(silent=True) or {}
    updates = data.get('content', data)
    if not isinstance(updates, dict) or not updates:
        return jsonify({"success": False, "message": "Invalid content payload."}), 400

    updated_by = session.get('full_name', 'Director')
    saved_keys = 0
    conn = get_db()
    try:
        cursor = conn.cursor()
        for key, value in updates.items():
            if key in DEFAULT_SITE_CONTENT:
                cursor.execute("""
                    INSERT INTO site_content (key, value, updated_by, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(key) DO UPDATE SET
                        value = excluded.value,
                        updated_by = excluded.updated_by,
                        updated_at = CURRENT_TIMESTAMP
                """, (key, str(value).strip(), updated_by))
                saved_keys += 1
        conn.commit()
    finally:
        conn.close()

    if saved_keys == 0:
        return jsonify({"success": False, "message": "No valid site content fields were provided."}), 400

    return jsonify({
        "success": True,
        "saved_keys": saved_keys,
        "content": fetch_site_content_dict()
    })


@app.route('/api/admin/content/reset', methods=['POST'])
@super_admin_required
def admin_reset_site_content():
    updated_by = session.get('full_name', 'Director')
    conn = get_db()
    try:
        cursor = conn.cursor()
        for key, value in DEFAULT_SITE_CONTENT.items():
            cursor.execute("""
                INSERT INTO site_content (key, value, updated_by, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_by = excluded.updated_by,
                    updated_at = CURRENT_TIMESTAMP
            """, (key, value, updated_by))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True, "content": fetch_site_content_dict()})


# -------------------------------------------------------------
# 9. Admin Staff Management APIs (Add, Enable/Disable, Avatar Upload, Delete)
# -------------------------------------------------------------
@app.route('/api/admin/staff', methods=['GET'])
@super_admin_required
def get_all_staff():
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, full_name, role, department, COALESCE(avatar_url, ''), is_active, created_at
            FROM users
            ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
    finally:
        conn.close()

    staff_list = [
        {
            "id": r[0],
            "username": r[1],
            "full_name": r[2],
            "role": r[3],
            "department": r[4],
            "avatar_url": r[5] or "",
            "is_active": bool(r[6]),
            "created_at": r[7]
        }
        for r in rows
    ]
    return jsonify({"staff": staff_list})


@app.route('/api/admin/staff/create', methods=['POST'])
@super_admin_required
def create_staff_account():
    is_multipart = bool(request.content_type and 'multipart/form-data' in request.content_type)
    data = request.form if is_multipart else (request.get_json(silent=True) or {})

    full_name = (data.get('full_name') or '').strip()
    username = (data.get('username') or '').strip().lower()
    password = (data.get('password') or '').strip()
    role = (data.get('role') or 'counselor').strip()
    department = (data.get('department') or 'General').strip()

    if not full_name or not username or not password:
        return jsonify({"success": False, "message": "All fields required."}), 400

    if role not in ('counselor', 'hod', 'super_admin'):
        return jsonify({"success": False, "message": "Invalid staff role."}), 400

    avatar_url = ""
    if is_multipart and 'avatar_file' in request.files:
        uploaded_file = request.files['avatar_file']
        if uploaded_file and uploaded_file.filename:
            try:
                avatar_url = save_avatar_image(uploaded_file, user_id_hint=secure_filename(username) or "new")
            except ValueError as ve:
                return jsonify({"success": False, "message": str(ve)}), 400

    hashed_pwd = generate_password_hash(password)

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (username, password_hash, full_name, role, department, avatar_url, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        """, (username, hashed_pwd, full_name, role, department, avatar_url))
        conn.commit()
        new_id = cursor.lastrowid

        return jsonify({
            "success": True,
            "message": f"Account created for {full_name} ({username}).",
            "user_id": new_id,
            "avatar_url": avatar_url
        }), 201
    except DBIntegrityError:
        remove_avatar_file(avatar_url)
        return jsonify({"success": False, "message": f"Username '{username}' already exists."}), 400
    except Exception as e:
        remove_avatar_file(avatar_url)
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/admin/staff/<int:user_id>/avatar', methods=['POST', 'DELETE'])
@super_admin_required
def update_staff_avatar(user_id):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT full_name, COALESCE(avatar_url, '') FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"success": False, "message": "Staff user not found."}), 404
        full_name, old_avatar_url = row

        if request.method == 'DELETE' or request.form.get('remove') == '1':
            remove_avatar_file(old_avatar_url)
            cursor.execute("UPDATE users SET avatar_url = '' WHERE id = ?", (user_id,))
            conn.commit()
            return jsonify({"success": True, "avatar_url": "", "message": f"Removed photo for {full_name}."})

        if 'avatar_file' not in request.files:
            return jsonify({"success": False, "message": "No image file provided."}), 400

        uploaded_file = request.files['avatar_file']
        if not uploaded_file or not uploaded_file.filename:
            return jsonify({"success": False, "message": "No image file selected."}), 400

        try:
            new_avatar_url = save_avatar_image(uploaded_file, user_id_hint=str(user_id))
        except ValueError as ve:
            return jsonify({"success": False, "message": str(ve)}), 400

        remove_avatar_file(old_avatar_url)
        cursor.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (new_avatar_url, user_id))
        conn.commit()
        return jsonify({"success": True, "avatar_url": new_avatar_url, "message": f"Updated photo for {full_name}."})
    finally:
        conn.close()


@app.route('/api/admin/staff/toggle/<int:user_id>', methods=['POST'])
@super_admin_required
def toggle_staff_account(user_id):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT username, full_name, is_active FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"success": False, "message": "Staff user not found."}), 404
        if row[0] == 'admin':
            return jsonify({"success": False, "message": "Cannot disable the master admin account."}), 400
        if user_id == session.get('user_id'):
            return jsonify({"success": False, "message": "Cannot disable your own active account."}), 400
        new_status = 0 if row[2] == 1 else 1
        cursor.execute("UPDATE users SET is_active = ? WHERE id = ?", (new_status, user_id))
        conn.commit()
    finally:
        conn.close()
    state_label = "enabled" if new_status == 1 else "disabled"
    return jsonify({"success": True, "is_active": bool(new_status), "message": f"Account '{row[1]}' {state_label}."})


@app.route('/api/admin/staff/<int:user_id>', methods=['DELETE'])
@super_admin_required
def delete_staff_account(user_id):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT username, full_name, COALESCE(avatar_url, '') FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"success": False, "message": "Staff user not found."}), 404
        if row[0] == 'admin':
            return jsonify({"success": False, "message": "Cannot delete the master admin account."}), 400
        if user_id == session.get('user_id'):
            return jsonify({"success": False, "message": "Cannot delete your own active account."}), 400
        remove_avatar_file(row[2])
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True, "message": f"Staff member '{row[1]}' ({row[0]}) deleted permanently."})


PUBLIC_STATIC_EXTS = {
    '.css', '.js', '.png', '.jpg', '.jpeg', '.jfif', '.webp', '.gif', '.svg', '.ico', '.avif',
    '.pdf', '.woff', '.woff2', '.ttf', '.mp4', '.webm', '.txt', '.xml', '.webmanifest',
}


@app.route('/<path:path>')
def serve_static_or_spa(path):
    """Serves ONLY public front-end assets. Source code, the database file and admin.html
    are never served from here (admin.html is reachable only through the login-protected /admin)."""
    if path.startswith('api/'):
        return jsonify({"error": "Not found"}), 404
    ext = os.path.splitext(path)[1].lower()
    if ext:
        target = os.path.join(BASE_DIR, path)
        if ext in PUBLIC_STATIC_EXTS and os.path.isfile(target) and not os.path.basename(path).startswith('.'):
            return send_from_directory(BASE_DIR, path)
        abort(404)
    return serve_index()


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    print("==================================================================")
    print("🚀 SGI ENTERPRISE SERVER READY")
    print(f"🗄️  Storage: {'PostgreSQL (persistent)' if USE_PG else 'LOCAL SQLite (not persistent on cloud hosts)'}")
    print(f"🌐 Public Website: http://127.0.0.1:{port}")
    print(f"🔐 Private Admin:  http://127.0.0.1:{port}/admin")
    print("🔑 First-run admin: username 'admin' (password from ADMIN_INITIAL_PASSWORD, or the default in the docs)")
    print("==================================================================")
    app.run(debug=os.environ.get("FLASK_DEBUG", "1") == "1", host=os.environ.get("HOST", "127.0.0.1"), port=port)
