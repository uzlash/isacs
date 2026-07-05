import { type NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/config";
import { upstream } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

// Admin-driven TOTP provisioning for a user who has no authenticator yet.
// The onboarding-token endpoint requires a PENDING mfa secret, and there is no
// direct admin endpoint to create one — but the admin set the user's password
// at creation, so we run the enrollment chain server-side:
//   1. login as the user (email+password)  -> setupToken
//   2. POST /auth/mfa/setup { setupToken }  -> creates mfaPendingSecret
//   3. GET  /auth/mfa/onboarding-token?userId (admin bearer) -> encrypted token
export async function POST(request: NextRequest) {
  const adminToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!adminToken) {
    return NextResponse.json({ ok: false, message: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    userId?: string;
  };
  const { email, password, userId } = body;
  if (!email || !password || !userId) {
    return NextResponse.json(
      { ok: false, message: "email, password and userId are required" },
      { status: 400 }
    );
  }

  const json = (v: string) => ({ method: "POST", headers: { "content-type": "application/json" }, body: v });

  // 1. login as the target user → setupToken (only if MFA not yet set up)
  const login = await upstream("/auth/login", json(JSON.stringify({ email, password })));
  if (!login.json?.ok) {
    return NextResponse.json(login.json ?? { ok: false, message: "Login failed" }, { status: login.res.status || 502 });
  }
  const ld = (login.json.data ?? {}) as Record<string, unknown>;
  if (!ld.requiresMfaSetup || !ld.setupToken) {
    return NextResponse.json(
      { ok: false, message: "This user already has an authenticator enrolled — no onboarding needed." },
      { status: 409 }
    );
  }

  // 2. create the pending secret
  const setup = await upstream("/auth/mfa/setup", json(JSON.stringify({ setupToken: String(ld.setupToken) })));
  if (!setup.json?.ok) {
    return NextResponse.json(setup.json ?? { ok: false, message: "MFA setup failed" }, { status: setup.res.status || 502 });
  }

  // 3. fetch the encrypted onboarding token as the admin
  const onb = await upstream(`/auth/mfa/onboarding-token?userId=${encodeURIComponent(userId)}`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  if (!onb.json?.ok) {
    return NextResponse.json(onb.json ?? { ok: false, message: "Onboarding token failed" }, { status: onb.res.status || 502 });
  }

  const token = (onb.json.data as Record<string, unknown>)?.token;
  return NextResponse.json({ ok: true, message: "Onboarding token generated", data: { token } });
}
