# snaps — Phishing Awareness Training Demo

A clearly-labelled training simulation that teaches how credential-phishing
pages work. It serves a Snapchat-style login clone; after the visitor submits
the form they are shown exactly what an attacker would have captured.

> ⚠ This is an educational demo. The login page intentionally carries **no
> warning** — that is the teaching point (deferred disclosure, like real
> simulated-phishing training). It is designed to be shown by an instructor,
> not shared as a public link without context.

## Two ways to run it

### 1. Local classroom demo (full capture) — Flask

Runs the complete experience with an instructor view. Everything stays on
`127.0.0.1`:

```bash
pip install -r requirements.txt
python app.py
```

Then open http://127.0.0.1:5000/login.html

- Submissions are stored in memory and appended to `captured_credentials.txt`
  (git-ignored — never commit or deploy it).
- Instructor dashboard: http://127.0.0.1:5000/captures (localhost only).

### 2. Netlify / static hosting (no capture) — browser-only

Netlify is a static host, so the Flask backend is not used. The static build
reimplements the whole flow **in the browser**:

- No server, no POST, no logs, no files.
- The typed values live in the visitor's own `sessionStorage` and are wiped the
  moment the reveal page renders.
- Passwords are shown masked on the reveal page.

Deploy options:

- **Drag & drop:** zip the folder contents and drop it at
  https://app.netlify.com/drop — or point a GitHub repo at Netlify.
- **CLI:** `netlify deploy --prod --dir=.` (or `npx netlify-cli deploy --prod`)

Static pages: `index.html` → `Acconts.html` → `login.html` →
`processing.html` → `debrief.html`. No build step needed. The login page
auto-detects which build is serving it (via `/api/mode`): on Flask it POSTs
to `/login` so the capture + instructor view work; on static hosting it runs
the browser-only handoff.

## Safety guardrails

- `app.py` binds to `127.0.0.1` only — never expose it on a network.
- `captured_credentials.txt` is git-ignored and must never be deployed.
- The Netlify build never transmits or stores credentials.
