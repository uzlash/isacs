import { type NextRequest, NextResponse } from "next/server";
import { setAuthCookies, setSetupCookie, upstream } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

// Card + TOTP login. On success the upstream returns tokens; we store them in
// httpOnly cookies and return only the user to the client. If the account has
// no authenticator yet, we stash the setupToken in an httpOnly cookie and tell
// the client to run the MFA enrollment flow.
export async function POST(request: NextRequest) {
  const body = await request.text();
  const { res, json } = await upstream("/auth/login/card", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

  if (!json) {
    return NextResponse.json({ ok: false, message: "Upstream unavailable" }, { status: res.status || 502 });
  }

  const data = (json.data ?? {}) as Record<string, unknown>;

  if (json.ok && data.requiresMfaSetup) {
    const out = NextResponse.json({ ok: true, message: json.message, data: { requiresMfaSetup: true } });
    setSetupCookie(out, String(data.setupToken));
    return out;
  }

  if (json.ok && data.accessToken) {
    const out = NextResponse.json({ ok: true, message: json.message, data: { user: data.user } });
    setAuthCookies(out, {
      accessToken: String(data.accessToken),
      refreshToken: data.refreshToken ? String(data.refreshToken) : undefined,
      user: data.user,
    });
    return out;
  }

  return NextResponse.json(json, { status: res.status });
}
