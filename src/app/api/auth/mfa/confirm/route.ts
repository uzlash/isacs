import { type NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/config";
import { SETUP_COOKIE, setAuthCookies, upstream } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

// Confirm TOTP enrollment with a live code. In the first-login flow the upstream
// returns full tokens — we store them in cookies and log the user in.
export async function POST(request: NextRequest) {
  const setup = request.cookies.get(SETUP_COOKIE)?.value;
  const at = request.cookies.get(ACCESS_COOKIE)?.value;
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = body.code;

  const init: RequestInit = setup
    ? {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setupToken: setup, code }),
      }
    : {
        method: "POST",
        headers: { "content-type": "application/json", ...(at ? { authorization: `Bearer ${at}` } : {}) },
        body: JSON.stringify({ code }),
      };

  const { res, json } = await upstream("/auth/mfa/confirm", init);
  const data = (json?.data ?? {}) as Record<string, unknown>;

  if (json?.ok && data.accessToken) {
    const out = NextResponse.json({ ok: true, message: json.message, data: { user: data.user } });
    setAuthCookies(out, {
      accessToken: String(data.accessToken),
      refreshToken: data.refreshToken ? String(data.refreshToken) : undefined,
      user: data.user,
    });
    return out;
  }

  return NextResponse.json(json ?? { ok: false, message: "MFA confirm failed" }, { status: res.status || 502 });
}
