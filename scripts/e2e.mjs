#!/usr/bin/env node
// End-to-end test of the ISACS console BFF against the real API.
//
//   node scripts/e2e.mjs                 # contract + proxy tests (no auth)
//   CARD_CODE=<card> node scripts/e2e.mjs   # full flow incl. MFA enrollment
//
// Talks to the same-origin BFF (http://localhost:3000/api) exactly as the
// browser does, carrying the httpOnly session cookies through a manual jar.

import crypto from "node:crypto";

const BASE = process.env.BASE || "http://localhost:3000";
const CARD = process.env.CARD_CODE || "";
const jar = new Map();

let pass = 0;
let fail = 0;
const ok = (m) => (pass++, console.log(`  \x1b[32mPASS\x1b[0m ${m}`));
const bad = (m) => (fail++, console.log(`  \x1b[31mFAIL\x1b[0m ${m}`));
const info = (m) => console.log(`  \x1b[90m·\x1b[0m ${m}`);
const head = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function storeCookies(res) {
  const set = res.headers.getSetCookie?.() || [];
  for (const c of set) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (v === "") jar.delete(k);
    else jar.set(k, v);
  }
}

async function call(method, path, body) {
  const headers = { "content-type": "application/json" };
  const ck = cookieHeader();
  if (ck) headers.cookie = ck;
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, json: { ok: false, message: String(e) } };
  }
  const ms = Date.now() - t0;
  storeCookies(res);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text.slice(0, 200) };
  }
  return { status: res.status, ms, json };
}

// ---- RFC 6238 TOTP (base32 secret, 30s step, 6 digits, SHA-1) ----
function base32Decode(s) {
  const alph = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const idx = alph.indexOf(ch);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret, forCounter) {
  const key = base32Decode(secret);
  const counter = forCounter ?? Math.floor(Date.now() / 30000);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

async function main() {
  console.log(`ISACS E2E · BASE=${BASE} · CARD=${CARD ? "provided" : "(none — contract tests only)"}`);

  head("1. Contract + proxy (unauthenticated)");
  {
    const r = await call("GET", "/api/settings");
    r.status === 401 ? ok(`GET /settings → 401 (auth enforced)`) : bad(`GET /settings → ${r.status} (want 401)`);
  }
  {
    const r = await call("POST", "/api/auth/login", {});
    r.status === 410 ? ok(`POST /auth/login → 410 (password login disabled)`) : bad(`POST /auth/login → ${r.status} (want 410)`);
  }
  {
    const r = await call("POST", "/api/auth/login/card", {});
    r.status === 400 && /cardCode/i.test(r.json?.message || "")
      ? ok(`POST /auth/login/card {} → 400 "${r.json.message}"`)
      : bad(`POST /auth/login/card {} → ${r.status} ${JSON.stringify(r.json)}`);
  }
  {
    const r = await call("POST", "/api/auth/login/card", { cardCode: "E2E-UNKNOWN-CARD-0000" });
    info(`unknown card → HTTP ${r.status} ${JSON.stringify(r.json)}`);
    r.status >= 400 && r.status < 500
      ? ok(`unknown card rejected with a clean ${r.status} (not a 5xx)`)
      : bad(`unknown card → ${r.status} (want a 4xx)`);
  }

  const REFRESH = process.env.REFRESH_TOKEN;
  const ACCESS = process.env.ACCESS_TOKEN;

  if (!CARD && !REFRESH && !ACCESS) {
    head("Auth-gated flow skipped");
    info("Provide one of:");
    info("  ACCESS_TOKEN=<jwt> node scripts/e2e.mjs        (15-min token, reads only)");
    info("  REFRESH_TOKEN=<jwt> node scripts/e2e.mjs       (7-day token; auto-refreshes, no logout)");
    info("  CARD_CODE=<card> TOTP_SECRET=<base32> node scripts/e2e.mjs   (full flow incl. logout)");
    return summary();
  }

  head("2. Session");
  let loggedIn = false;
  let usedProvidedToken = false;
  const SECRET = process.env.TOTP_SECRET;
  const step = Math.floor(Date.now() / 30000);

  if (ACCESS) {
    jar.set("isacs_at", ACCESS);
    usedProvidedToken = true;
    const r = await call("GET", "/api/settings");
    if (r.status === 200) {
      ok("provided ACCESS_TOKEN accepted");
      loggedIn = true;
    } else bad(`provided ACCESS_TOKEN rejected → ${r.status} ${JSON.stringify(r.json)}`);
  } else if (REFRESH) {
    jar.set("isacs_rt", REFRESH);
    usedProvidedToken = true;
    const r = await call("POST", "/api/auth/refresh", {});
    if (r.json?.ok || jar.has("isacs_at")) {
      ok("provided REFRESH_TOKEN → minted an access token");
      loggedIn = true;
    } else bad(`refresh with provided REFRESH_TOKEN failed → ${r.status} ${JSON.stringify(r.json)}`);
  } else if (SECRET) {
    // Enrolled account: compute the code at request-time. Try the current and
    // ±1 windows to absorb any client/server clock skew.
    for (const c of [step, step - 1, step + 1, step - 2, step + 2]) {
      const code = totp(SECRET, c);
      const r = await call("POST", "/api/auth/login/card", { cardCode: CARD, code });
      if (r.json?.ok && (r.json?.data?.user || jar.has("isacs_at"))) {
        ok(`login/card {cardCode, code} → signed in (user ${r.json?.data?.user?.email || "?"}) [win ${c - step}]`);
        loggedIn = true;
        break;
      }
      info(`login attempt [win ${c - step}] → ${r.status} ${r.json?.message || ""}`);
    }
    if (!loggedIn) bad("login/card with computed TOTP failed on all ±1 windows (check the secret + clocks)");
  } else if (process.env.OTP_CODE) {
    const r = await call("POST", "/api/auth/login/card", { cardCode: CARD, code: process.env.OTP_CODE });
    if (r.json?.ok && (r.json?.data?.user || jar.has("isacs_at"))) {
      ok(`login/card {cardCode, code} → signed in (user ${r.json?.data?.user?.email || "?"})`);
      loggedIn = true;
    } else {
      bad(`login/card {cardCode, code} → ${r.status} ${JSON.stringify(r.json)}`);
    }
  } else {
    // No code → try the first-login enrollment path (un-enrolled card only).
    const r = await call("POST", "/api/auth/login/card", { cardCode: CARD });
    if (r.json?.data?.requiresMfaSetup) {
      ok(`login/card {cardCode} → requiresMfaSetup (first login) — enrolling`);
      const s = await call("POST", "/api/auth/mfa/setup", {});
      if (s.json?.data?.secret) {
        ok(`mfa/setup → secret ${s.json.data.secret}`);
        const code = totp(s.json.data.secret);
        const c = await call("POST", "/api/auth/mfa/confirm", { code });
        if (c.json?.ok && (c.json?.data?.user || jar.has("isacs_at"))) {
          ok(`mfa/confirm → enrolled + signed in (user ${c.json?.data?.user?.email || "?"})`);
          loggedIn = true;
        } else bad(`mfa/confirm → ${c.status} ${JSON.stringify(c.json)}`);
      } else bad(`mfa/setup → ${s.status} ${JSON.stringify(s.json)}`);
    } else if (r.json?.ok && r.json?.data?.user) {
      ok(`login/card {cardCode} → signed in without a code (user ${r.json.data.user.email})`);
      loggedIn = true;
    } else {
      info(`login/card {cardCode} → HTTP ${r.status} ${JSON.stringify(r.json)}`);
      info("Card is enrolled — pass TOTP_SECRET=<base32> (best) or OTP_CODE=<live code>.");
    }
  }

  if (!loggedIn) return summary();

  head("3. Authenticated reads");
  const reads = [
    ["/api/settings", "settings"],
    ["/api/staff?limit=100", "staff"],
    ["/api/visitors?limit=100", "visitors"],
    ["/api/appointments?limit=100", "appointments"],
    ["/api/nodes", "nodes"],
    ["/api/cards", "cards"],
    ["/api/cameras", "cameras"],
    ["/api/assets", "assets"],
    ["/api/reports?limit=100", "reports"],
    ["/api/users", "users"],
  ];
  const loaded = {};
  for (const [path, name] of reads) {
    const r = await call("GET", path);
    const arr = Array.isArray(r.json?.data) ? r.json.data : null;
    if (r.status === 200 && arr) {
      loaded[name] = arr;
      ok(`GET ${name} → 200 · ${arr.length} record(s) · ${r.ms}ms`);
      if (arr[0] && typeof arr[0] === "object") info(`    fields: ${Object.keys(arr[0]).join(", ")}`);
    } else {
      bad(`GET ${name} → ${r.status} (${r.ms}ms) ${JSON.stringify(r.json).slice(0, 160)}`);
    }
  }

  head("4. Authenticated writes (safe/idempotent-ish)");
  const node = loaded.nodes?.[0];
  if (node) {
    const r = await call("POST", "/api/access/check", {
      cardNumber: "E2E-CHECK",
      rfidTag: "E2E-CHECK",
      qrCode: "E2E-CHECK",
      nodeId: node.id,
    });
    r.status === 200 && r.json?.data && "granted" in r.json.data
      ? ok(`POST /access/check → 200 granted=${r.json.data.granted} (${r.json.data.reason || "granted"})`)
      : bad(`POST /access/check → ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  } else {
    info("no nodes seeded — skipping /access/check");
  }

  if (usedProvidedToken) {
    head("5. Logout — SKIPPED");
    info("Using a provided token; not calling logout (it would invalidate your 7-day token).");
  } else {
    head("5. Logout");
    const r = await call("POST", "/api/auth/logout", {});
    r.json?.ok ? ok(`logout → ${r.json.message}`) : bad(`logout → ${r.status} ${JSON.stringify(r.json)}`);
    const after = await call("GET", "/api/settings");
    after.status === 401 ? ok(`session cleared (GET /settings → 401 after logout)`) : bad(`still authed after logout → ${after.status}`);
  }

  summary();
}

function summary() {
  console.log(`\n\x1b[1mSummary:\x1b[0m ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("E2E crashed:", e);
  process.exit(2);
});
