"""
SGI Gurdaspur - Authenticated Backend & Admin CRM
With Right-Side Profile Support and Dedicated Session Invalidation.
Run: python app.py
"""

from flask import Flask, request, jsonify, send_from_directory, Response, session, redirect, url_for, make_response
import sqlite3
import os
import csv
import io
from datetime import datetime
from functools import wraps

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, "sgi_admissions.db")

app = Flask(__name__, static_folder=BASE_DIR)
app.secret_key = "sgi_super_secret_admin_key_2026_gurdaspur"

# Non-permanent cookie: wiped when browser closes
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# =====================================================================
# 🔑 SET YOUR MASTER ADMIN PASSWORD HERE
# =====================================================================
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "SGI@Admin2026")
# =====================================================================

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_authenticated'):
            if request.path.startswith('/api/'):
                return jsonify({"error": "Unauthorized"}), 401
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated_function

@app.after_request
def add_security_headers(response):
    """Prevents browser back-button caching of admin data."""
    if request.path.startswith('/admin') or request.path.startswith('/api/leads') or request.path.startswith('/api/admin') or request.path.startswith('/api/export'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '-1'
    return response

# -------------------------------------------------------------
# Database Setup
# -------------------------------------------------------------
def categorize_program(program_name):
    p = program_name.lower()
    if "pharm" in p:
        return "Pharmacy"
    elif "nurs" in p:
        return "Nursing"
    elif "tech" in p or "mech" in p or "civil" in p or "cse" in p or "engine" in p:
        return "Engineering"
    elif "mba" in p or "bba" in p or "bca" in p or "mca" in p or "manage" in p:
        return "Management & IT"
    elif "poly" in p or "diploma" in p:
        return "Polytechnic"
    return "General"

def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                program TEXT NOT NULL,
                branch TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()

init_db()

# -------------------------------------------------------------
# Public Website Routes
# -------------------------------------------------------------
@app.route('/')
def serve_index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/api/apply', methods=['POST'])
def handle_application():
    data = request.get_json() or {}
    full_name = data.get('full_name', '').strip()
    phone = data.get('phone', '').strip()
    program = data.get('program', '').strip()

    if not full_name or not phone or not program:
        return jsonify({"success": False, "message": "All fields required."}), 400

    branch = categorize_program(program)

    try:
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO leads (full_name, phone, program, branch) VALUES (?, ?, ?, ?)",
                (full_name, phone, program, branch)
            )
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

@app.route('/api/notices', methods=['GET'])
def get_live_notices():
    notices = [
        {
            "id": 1,
            "category": "ikgptu",
            "category_label": "IKGPTU Jalandhar",
            "title": "Semester End Regular & Re-appear Theory / Practical Examination Schedule",
            "date": "Active Notification",
            "ref_no": "IKGPTU/EXAM/2026/8941",
            "authority": "Office of the Controller of Examinations, IKGPTU",
            "badge": "University Exam",
            "badge_class": "badge-urgent",
            "summary": "Portal open for fill-up of online examination forms for B.Tech, MBA, BCA and B.Sc streams.",
            "details": "All students of SCET and SIMT are notified that regular & re-appear exam forms are open on the IKGPTU student portal."
        },
        {
            "id": 2,
            "category": "scholarship",
            "category_label": "Scholarship & Admin",
            "title": "Dr. Ambedkar Post-Matric Scholarship Scheme for SC/ST/OBC Students (Verification Active)",
            "date": "Admissions Cell",
            "ref_no": "SGI/SCH/2026/041",
            "authority": "Welfare & Scholarship Nodal Cell, SGI Campus",
            "badge": "Govt Scholarship",
            "badge_class": "badge-scholar",
            "summary": "Mandatory biometric and document verification for state scholarship recipients.",
            "details": "Eligible SC/ST/OBC scholarship recipients must submit their income certificate and Aadhaar linkage verification to the main office."
        },
        {
            "id": 3,
            "category": "pharma",
            "category_label": "Pharmacy (PCI)",
            "title": "PCI Mandatory Hospital Dispensing Rotations & Drug Formulation Practical Journals",
            "date": "SCOP Department",
            "ref_no": "SCOP/PCI/CLIN/1102",
            "authority": "Principal, Sukhjinder College of Pharmacy",
            "badge": "PCI Council",
            "badge_class": "badge-pharma",
            "summary": "4th Year B.Pharm and Final Year D.Pharm hospital training postings announced.",
            "details": "Clinical hospital postings for pharmacy graduates will start next week in the affiliated civil hospitals."
        },
        {
            "id": 4,
            "category": "nursing",
            "category_label": "Nursing (INC/PNRC)",
            "title": "INC & PNRC Multi-Specialty Clinical Hospital Internship Postings Schedule",
            "date": "SCON Department",
            "ref_no": "SCON/PNRC/2026/302",
            "authority": "Office of the Principal, Sukhjinder College of Nursing",
            "badge": "Nursing Board",
            "badge_class": "badge-nursing",
            "summary": "Clinical hospital postings in ICU, Pediatrics, and Community Health for B.Sc & GNM cohorts.",
            "details": "All student nurses must report in clinical uniform with valid institutional ID cards."
        }
    ]
    return jsonify({"notices": notices})

# -------------------------------------------------------------
# Admin Authentication Gate & Profile Endpoints
# -------------------------------------------------------------
LOGIN_PAGE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SGI Admin | Protected Authentication</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Syne:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0c10;
      --card-bg: rgba(22, 27, 34, 0.95);
      --border: rgba(255, 255, 255, 0.1);
      --accent: #e5a910;
      --text: #f0f6fc;
      --text-muted: #8b949e;
      --error: #ff4d4f;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc;
        --card-bg: rgba(255, 255, 255, 0.98);
        --border: rgba(15, 23, 42, 0.1);
        --accent: #d49504;
        --text: #0f172a;
        --text-muted: #64748b;
        --error: #dc2626;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
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
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      text-align: center;
    }
    .badge-lock {
      background: rgba(229, 169, 16, 0.12);
      border: 1px solid var(--accent);
      color: var(--accent);
      padding: 5px 14px;
      border-radius: 30px;
      font-size: 0.78rem;
      font-weight: 800;
      display: inline-block;
      margin-bottom: 1.2rem;
    }
    h2 { font-family: 'Syne', sans-serif; font-size: 1.8rem; margin-bottom: 0.5rem; }
    p { font-size: 0.88rem; color: var(--text-muted); margin-bottom: 1.8rem; }
    .input-group { text-align: left; margin-bottom: 1.2rem; }
    label { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.4rem; }
    input[type="password"] {
      width: 100%;
      padding: 0.85rem 1rem;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: rgba(125,125,125,0.06);
      color: var(--text);
      font-size: 1rem;
      outline: none;
      font-family: inherit;
    }
    input[type="password"]:focus { border-color: var(--accent); }
    .btn-login {
      width: 100%;
      background: var(--accent);
      color: #111418;
      border: none;
      padding: 0.9rem;
      border-radius: 10px;
      font-weight: 800;
      font-size: 0.95rem;
      cursor: pointer;
      margin-top: 0.5rem;
      font-family: inherit;
    }
    .btn-login:hover { opacity: 0.92; }
    .error-msg {
      background: rgba(255, 77, 79, 0.12);
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
    .back-link:hover { color: var(--text); }
  </style>
</head>
<body>
  <div class="login-box">
    <span class="badge-lock">🔒 CONFIDENTIAL ACCESS</span>
    <h2>Administrator Login</h2>
    <p>Authentication required. Enter the master passkey to access student admissions.</p>

    {{ERROR_ALERT}}

    <form method="POST" action="/admin/login">
      <div class="input-group">
        <label for="pwd">Admin Passkey</label>
        <input type="password" id="pwd" name="password" placeholder="••••••••••••" autofocus required autocomplete="off">
      </div>
      <button type="submit" class="btn-login">Unlock Console &rarr;</button>
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
        entered_pwd = request.form.get('password', '').strip()
        if entered_pwd == ADMIN_PASSWORD:
            session['admin_authenticated'] = True
            session['admin_name'] = "Director of Admissions"
            session['admin_role'] = "Chief Administrator"
            session['login_time'] = datetime.now().strftime('%d %b %Y, %I:%M %p')
            return SUCCESS_REDIRECT_SCRIPT
        
        err_html = '<div class="error-msg">⚠️ Invalid Passkey. Access Denied.</div>'
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

@app.route('/api/admin/profile', methods=['GET'])
@login_required
def get_admin_profile():
    return jsonify({
        "name": session.get('admin_name', 'Director of Admissions'),
        "role": session.get('admin_role', 'Super Admin • SGI Portal'),
        "campus": "Hayat Nagar, Gurdaspur",
        "session_time": session.get('login_time', datetime.now().strftime('%d %b %Y, %I:%M %p'))
    })

@app.route('/api/leads', methods=['GET'])
@login_required
def get_leads():
    branch_filter = request.args.get('branch', '').strip()
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        if branch_filter and branch_filter.lower() != 'all':
            cursor.execute(
                "SELECT id, full_name, phone, program, branch, timestamp FROM leads WHERE branch LIKE ? ORDER BY timestamp DESC",
                (f"%{branch_filter}%",)
            )
        else:
            cursor.execute("SELECT id, full_name, phone, program, branch, timestamp FROM leads ORDER BY timestamp DESC")
        rows = cursor.fetchall()

    leads = [
        {"id": r[0], "name": r[1], "phone": r[2], "program": r[3], "branch": r[4], "timestamp": r[5]}
        for r in rows
    ]
    return jsonify({"leads": leads, "count": len(leads)})

@app.route('/api/admin/stats', methods=['GET'])
@login_required
def get_admin_stats():
    with sqlite3.connect(DB_NAME) as conn:
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

    return jsonify({
        "total": total,
        "engineering": engineering,
        "pharmacy": pharmacy,
        "nursing": nursing,
        "management": management
    })

@app.route('/api/export-leads', methods=['GET'])
@login_required
def export_leads_csv():
    branch_filter = request.args.get('branch', 'all').strip()
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        if branch_filter.lower() != 'all':
            cursor.execute(
                "SELECT id, full_name, phone, program, branch, timestamp FROM leads WHERE branch LIKE ? ORDER BY timestamp DESC",
                (f"%{branch_filter}%",)
            )
        else:
            cursor.execute("SELECT id, full_name, phone, program, branch, timestamp FROM leads ORDER BY timestamp DESC")
        rows = cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Student Name", "Phone Number", "Program Interest", "Branch / Department", "Date & Time"])
    for row in rows:
        writer.writerow(row)

    output.seek(0)
    branch_slug = branch_filter.replace(' ', '_').capitalize()
    filename = f"SGI_{branch_slug}_Admissions_{datetime.now().strftime('%Y%m%d')}.csv"

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )

@app.route('/<path:path>')
def serve_static_or_spa(path):
    target = os.path.join(BASE_DIR, path)
    if os.path.exists(target):
        return send_from_directory(BASE_DIR, path)
    return send_from_directory(BASE_DIR, 'index.html')

if __name__ == '__main__':
    print("==================================================================")
    print("🚀 SGI ADMISSIONS & ADMIN ENGINE RUNNING (PASSWORD PROTECTED)")
    print(f"📁 Root Directory: {BASE_DIR}")
    print("🌐 Public Website: http://127.0.0.1:5000")
    print("🔐 Private Admin:  http://127.0.0.1:5000/admin")
    print(f"🔑 Passkey:        {ADMIN_PASSWORD}")
    print("==================================================================")
    app.run(debug=True, port=5000)