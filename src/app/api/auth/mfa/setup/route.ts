import { type NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/config";
import { SETUP_COOKIE, upstream } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

// Generate a TOTP secret + QR. Uses the first-login setupToken cookie if
// present, otherwise the access-token Bearer (re-enrolling). The setupToken is
// kept server-side (cookie) and stripped from the client response.
export async function POST(request: NextRequest) {
  const setup = request.cookies.get(SETUP_COOKIE)?.value;
  const at = request.cookies.get(ACCESS_COOKIE)?.value;

  const init: RequestInit = setup
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ setupToken: setup }) }
    : {
        method: "POST",
        headers: { "content-type": "application/json", ...(at ? { authorization: `Bearer ${at}` } : {}) },
        body: "{}",
      };

  const { res, json } = await upstream("/auth/mfa/setup", init);

  if (json?.ok && json.data) {
    const { setupToken: _drop, ...rest } = json.data as Record<string, unknown>;
    void _drop;
    return NextResponse.json({ ok: true, message: json.message, data: rest });
  }
  return NextResponse.json(json ?? { ok: false, message: "MFA setup failed" }, { status: res.status || 502 });
}
