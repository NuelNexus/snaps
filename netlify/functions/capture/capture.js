// Netlify Function — POST /api/capture
//
// Receives a submission from the static demo login page and stores it in the
// class Supabase project so the instructor has a live "attacker's dashboard"
// on the deployed site. SECURITY: the real password never leaves the visitor's
// browser — login.js only ever sends password_masked = "********", so no usable
// credential is ever stored or transmitted by this backend.
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

  const ip = (event.headers["x-nf-client-connection-ip"] || "unknown").slice(0, 45);

  // The backend NEVER stores a password field from the client — the mask is
  // hardcoded, so even a caller that posts a real value in any password field
  // can only ever persist "********".
  const payload = {
    username,
    password_masked: "********",
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
