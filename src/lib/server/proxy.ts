// ====================================================================
// Server-only BFF helpers.
//
// The ISACS API is same-origin-locked (Cross-Origin-Resource-Policy:
// same-origin) and token-authed. The browser therefore never calls it
// directly — it calls our same-origin /api/* route handlers, which:
//   - forward to the upstream (http://192.168.18.6/api by default)
//   - inject the access token from an httpOnly cookie as a Bearer header
//   - manage the session cookies (access / refresh / user / mfa-setup)
// ====================================================================

import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, API_UPSTREAM_URL, REFRESH_COOKIE, USER_COOKIE } from "@/lib/config";

export const SETUP_COOKIE = "isacs_setup";

const ACCESS_TTL = 60 * 15; // 15 min
const REFRESH_TTL = 60 * 60 * 24 * 7; // 7 days
const SETUP_TTL = 60 * 30; // 30 min

// secure cookies require HTTPS; the on-prem deployment + local dev are http,
// so this is gated on the upstream/protocol rather than hardcoded.
const SECURE = (process.env.ISACS_COOKIE_SECURE || "false") === "true";

function opts(httpOnly: boolean, maxAge: number) {
  return { httpOnly, sameSite: "lax" as const, secure: SECURE, path: "/", maxAge };
}

interface AuthPayload {
  accessToken: string;
  refreshToken?: string;
  user?: unknown;
}

export function setAuthCookies(res: NextResponse, p: AuthPayload) {
  res.cookies.set(ACCESS_COOKIE, p.accessToken, opts(true, ACCESS_TTL));
  if (p.refreshToken) res.cookies.set(REFRESH_COOKIE, p.refreshToken, opts(true, REFRESH_TTL));
  if (p.user !== undefined) res.cookies.set(USER_COOKIE, JSON.stringify(p.user), opts(false, REFRESH_TTL));
  res.cookies.set(SETUP_COOKIE, "", opts(true, 0));
}

export function setAccessCookie(res: NextResponse, accessToken: string) {
  res.cookies.set(ACCESS_COOKIE, accessToken, opts(true, ACCESS_TTL));
}

export function setSetupCookie(res: NextResponse, token: string) {
  res.cookies.set(SETUP_COOKIE, token, opts(true, SETUP_TTL));
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", opts(true, 0));
  res.cookies.set(REFRESH_COOKIE, "", opts(true, 0));
  res.cookies.set(SETUP_COOKIE, "", opts(true, 0));
  res.cookies.set(USER_COOKIE, "", opts(false, 0));
}

const UNREACHABLE = { ok: false, message: "ISACS API is unreachable", error: "upstream_unreachable" };

/** Call the upstream API and parse JSON (tolerating empty/non-JSON bodies). */
export async function upstream(
  path: string,
  init: RequestInit = {}
): Promise<{ res: Response; json: Record<string, unknown> | null }> {
  let res: Response;
  try {
    res = await fetch(`${API_UPSTREAM_URL}${path}`, {
      ...init,
      headers: { "ngrok-skip-browser-warning": "true", ...((init.headers as Record<string, string>) || {}) },
      cache: "no-store",
    });
  } catch {
    // upstream down / socket closed / DNS — surface a clean 502 instead of a 500
    return { res: new Response(null, { status: 502 }), json: { ...UNREACHABLE } };
  }
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, json };
}

/** Transparent proxy for all non-auth endpoints: inject Bearer, forward verbatim. */
export async function proxy(request: NextRequest, segments: string[]): Promise<Response> {
  const url = new URL(request.url);
  const target = `${API_UPSTREAM_URL}/${segments.join("/")}${url.search}`;
  const at = request.cookies.get(ACCESS_COOKIE)?.value;

  const headers = new Headers();
  headers.set("ngrok-skip-browser-warning", "true");
  const ct = request.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);
  if (at) headers.set("authorization", `Bearer ${at}`);

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const buf = await request.arrayBuffer();
    if (buf.byteLength) body = buf;
  }

  let up: Response;
  try {
    up = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return Response.json({ ...UNREACHABLE }, { status: 502 });
  }

  const respBuf = await up.arrayBuffer();
  const respHeaders = new Headers();
  const rct = up.headers.get("content-type");
  if (rct) respHeaders.set("content-type", rct);
  return new Response(respBuf, { status: up.status, headers: respHeaders });
}
