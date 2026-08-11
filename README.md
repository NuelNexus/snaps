# snaps — Phishing Awareness Training Demo

A clearly-labelled training simulation that teaches how credential-phishing
pages work. It serves a Snapchat-style login clone; after the visitor submits
the form they are bounced **straight to the genuine snapchat.com** — the exact
experience a real phishing victim has. There is no reveal on the way through:
the instructor reviews what was captured afterwards at `/password` (local
classroom mode only).

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
- Instructor dashboards (localhost only): http://127.0.0.1:5000/password and
  `/captures` — both show the real captured values, so the class can see
  exactly what an attacker would have harvested.
- Optional cloud mirror: each submission is also POSTed to the class Supabase
  project with a **masked** password (`********`) so the instructor gets a
  live "attacker's dashboard" in the Supabase UI. Run `supabase_setup.sql`
  once in the project's SQL editor first (creates the table + RLS policy;
  the public key can INSERT but never SELECT). The mirror is best-effort —
  if it fails the demo keeps working and the error is logged.
- The `/debrief/<id>` page (educational reveal, real password) is kept as an
  instructor tool for after-class discussion; it is not part of the live flow.

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

Static pages: `index.html` → `Acconts.html` → `login.html`. No build step
needed. The login page auto-detects which build is serving it (via
`/api/mode`): on Flask it POSTs to `/login` so the capture + instructor views
work; on static hosting it bounces the visitor straight to snapchat.com with
nothing transmitted, stored or persisted. The static site has **no** capture,
no `/password` page and no Supabase sync — those exist only in the local
classroom mode, on purpose: a public page that stores real passwords would be
a working phishing kit, which is exactly what this demo teaches people to
avoid.

## Safety guardrails

- `app.py` binds to `127.0.0.1` only — never expose it on a network.
- `captured_credentials.txt` is git-ignored and must never be deployed.
- The Netlify build never transmits or stores credentials.
- The Supabase mirror sends masked passwords only and must keep the RLS
  policy from `supabase_setup.sql` (anon = INSERT-only) so the public key can
  never read submissions.
