import { type NextRequest, NextResponse } from "next/server";
import { REFRESH_COOKIE } from "@/lib/config";
import { clearAuthCookies, setAccessCookie, upstream } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

// Exchange the httpOnly refresh cookie for a fresh access token.
export async function POST(request: NextRequest) {
  const rt = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!rt) {
    return NextResponse.json({ ok: false, message: "No active session" }, { status: 401 });
  }

  const { res, json } = await upstream("/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: rt }),
  });

  const data = (json?.data ?? {}) as Record<string, unknown>;
  if (json?.ok && data.accessToken) {
    const out = NextResponse.json({ ok: true, message: "Token refreshed" });
    setAccessCookie(out, String(data.accessToken));
    return out;
  }

  const out = NextResponse.json(json ?? { ok: false, message: "Refresh failed" }, { status: res.status || 401 });
  clearAuthCookies(out);
  return out;
}
