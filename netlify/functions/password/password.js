// Netlify Function — GET /password
//
// Instructor dashboard for the deployed demo: shows what the public page
// captured, including the real passwords (the instructor opted into storing
// them for the full demo experience). Anyone with the passcode can read every
// captured password — keep DEMO_INSTRUCTOR_PASS secret and hard to guess.
//
// Protected with HTTP Basic Auth (browser shows a login prompt):
//   username: "instructor"
//   password: DEMO_INSTRUCTOR_PASS env var
//
// Env vars (set in Netlify): SUPABASE_URL, SUPABASE_SERVICE_KEY,
// DEMO_INSTRUCTOR_PASS
exports.handler = async (event) => {
  const pass = process.env.DEMO_INSTRUCTOR_PASS;
  if (!pass) {
    // Without a passcode the dashboard would accept an empty password — fail
    // closed instead of open.
    return { statusCode: 500, body: "password backend not configured" };
  }
  const expected = "Basic " + Buffer.from(`instructor:${pass}`).toString("base64");
  if ((event.headers.authorization || "") !== expected) {
    return {
      statusCode: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Demo instructor dashboard"' },
      body: "Unauthorized — enter the instructor passcode.",
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: "password backend not configured" };
  }

  let rows = [];
  try {
    const url = `${supabaseUrl}/rest/v1/captures?select=username,password_masked,password,created_at,ip&order=created_at.desc&limit=200`;
    const resp = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (!resp.ok) throw new Error(`supabase ${resp.status}`);
    rows = await resp.json();
  } catch (err) {
    return { statusCode: 502, body: `failed to load captures: ${err.message}` };
  }

  const esc = (v) =>
    String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);

  const rowsHtml = rows.length
    ? rows
        .map(
          (r) =>
            `<tr><td>${esc(r.created_at)}</td><td>${esc(r.username)}</td>` +
            `<td class="bad">${esc(r.password || r.password_masked)}</td><td>${esc(r.ip)}</td></tr>`
        )
        .join("\n")
    : '<tr><td colspan="4" class="empty">No submissions yet.</td></tr>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Captured submissions — training demo</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Avenir Next", "Segoe UI", Arial, sans-serif; background: #f5f5f5; color: #111; line-height: 1.6; padding: 24px 16px 64px; }
  .wrap { max-width: 760px; margin: 0 auto; }
  .top-banner { background: #1a1a2e; color: #ffd166; text-align: center; font-weight: 700; padding: 10px; border-radius: 10px; margin-bottom: 20px; font-size: 14px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .sub { color: #555; font-size: 13px; margin-bottom: 18px; }
  .card { background: #fff; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 10px rgba(0,0,0,.08); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #eee; word-break: break-word; vertical-align: top; }
  th { color: #777; font-weight: 600; }
  .empty { color: #999; font-size: 14px; padding: 20px 0; text-align: center; }
  .bad { color: #c0392b; }
  .btn { display: inline-block; margin-top: 16px; text-decoration: none; background: #00A6FF; color: #fff; padding: 10px 22px; border-radius: 25px; font-weight: 700; font-size: 14px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="top-banner">⚠ TRAINING SIMULATION — captured passwords below</div>
  <h1>Captured submissions</h1>
  <p class="sub">
    The "attacker's dashboard" for the deployed demo. It shows the real
    passwords captured by the login page (the instructor opted in). The
    dashboard itself is protected by HTTP Basic Auth — keep the passcode
    secret. Rows are also mirrored to the local classroom mode's
    <code>captured_credentials.txt</code> when the Flask server is used.
  </p>
  <div class="card">
    <table>
      <tr><th>Time</th><th>Username / email</th><th>Password</th><th>IP</th></tr>
      ${rowsHtml}
    </table>
    <a class="btn" href="/login.html">Back to the demo page</a>
  </div>
</div>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: html,
  };
};
