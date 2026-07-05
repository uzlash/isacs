import { type NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/config";
import { clearAuthCookies, upstream } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

// Invalidate the session upstream (best-effort) and clear all session cookies.
export async function POST(request: NextRequest) {
  const at = request.cookies.get(ACCESS_COOKIE)?.value;
  const rt = request.cookies.get(REFRESH_COOKIE)?.value;

  try {
    await upstream("/auth/logout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(at ? { authorization: `Bearer ${at}` } : {}),
      },
      body: JSON.stringify(rt ? { refreshToken: rt } : {}),
    });
  } catch {
    // best-effort — clear cookies regardless
  }

  const out = NextResponse.json({ ok: true, message: "Logged out" });
  clearAuthCookies(out);
  return out;
}
