"use client";

import Image from "next/image";
import { ShieldCheck, Smartphone } from "lucide-react";

// The operator's ISACS Authenticator device. With real MFA the 6-digit code
// comes from the user's own authenticator app, so this panel no longer shows a
// (fake) live code — it shows a sign-in prompt during login, and the real
// enrollment QR during first-login setup.

interface Props {
  clock: string;
  mode: "idle" | "request" | "enroll";
  qrDataUrl?: string | null;
  secret?: string | null;
}

export default function AuthenticatorPhone({ clock, mode, qrDataUrl, secret }: Props) {
  return (
    <div style={{ position: "relative", width: 312, flex: "0 0 312px" }}>
      <div className="mono" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: "1.4px", color: "var(--faint)", textAlign: "center", marginBottom: 14 }}>
        ISACS AUTHENTICATOR · YOUR DEVICE
      </div>
      <div style={{ position: "relative", width: 312, height: 632, background: "#05080d", border: "1px solid var(--border2)", borderRadius: 46, padding: 11, boxShadow: "0 30px 70px rgba(0,0,0,0.5)" }}>
        <div style={{ position: "relative", width: "100%", height: "100%", background: "var(--bg)", borderRadius: 36, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 118, height: 26, background: "#05080d", borderRadius: "0 0 16px 16px", zIndex: 5 }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 22px 6px", position: "relative", zIndex: 4 }}>
            <span className="mono" style={{ font: "600 12px var(--font-mono-stack)", color: "var(--fg)" }}>{clock}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="15" height="11" viewBox="0 0 18 12" fill="var(--fg)"><rect x="0" y="7" width="3" height="5" rx="1" /><rect x="5" y="4" width="3" height="8" rx="1" /><rect x="10" y="1" width="3" height="11" rx="1" /><rect x="15" y="1" width="3" height="11" rx="1" opacity="0.4" /></svg>
              <div style={{ width: 22, height: 11, border: "1.4px solid var(--fg)", borderRadius: 3, position: "relative", opacity: 0.9 }}>
                <div style={{ position: "absolute", inset: 1.5, right: 5, background: "var(--ok)", borderRadius: 1 }} />
                <div style={{ position: "absolute", right: -3, top: 3, width: 2, height: 5, background: "var(--fg)", borderRadius: "0 1px 1px 0" }} />
              </div>
            </div>
          </div>

          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ width: 34, height: 34, border: "1.5px solid var(--accent)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldCheck size={17} strokeWidth={1.7} color="var(--accent)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: "700 14px var(--font-sans-stack)", letterSpacing: ".3px", color: "var(--fg)" }}>Authenticator</div>
                <div className="mono" style={{ font: "500 8.5px var(--font-mono-stack)", letterSpacing: 1, color: "var(--faint)" }}>ISACS · SECURE TOTP</div>
              </div>
            </div>

            {mode === "enroll" && qrDataUrl ? (
              <div style={{ background: "var(--panel)", border: "1px solid var(--accent)", borderRadius: 15, padding: 15 }}>
                <div className="mono" style={{ font: "600 9px var(--font-mono-stack)", letterSpacing: "1px", color: "var(--faint)", marginBottom: 11 }}>SCAN TO ENROLL</div>
                <div style={{ background: "#fff", borderRadius: 10, padding: 10, display: "flex", justifyContent: "center" }}>
                  {/* enrollment QR from the API (data URL) */}
                  <Image src={qrDataUrl} alt="Authenticator enrollment QR" width={210} height={210} unoptimized style={{ display: "block", width: 210, height: 210 }} />
                </div>
                {secret && (
                  <div style={{ marginTop: 12 }}>
                    <div className="mono" style={{ font: "600 8.5px var(--font-mono-stack)", letterSpacing: ".6px", color: "var(--faint)", marginBottom: 4 }}>OR ENTER KEY MANUALLY</div>
                    <div className="mono" style={{ font: "600 11px var(--font-mono-stack)", letterSpacing: 1, color: "var(--accent)", wordBreak: "break-all" }}>{secret}</div>
                  </div>
                )}
                <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)", marginTop: 12, letterSpacing: ".3px", lineHeight: 1.5 }}>
                  Add this account in your authenticator app, then enter the 6-digit code it shows.
                </div>
              </div>
            ) : (
              <div style={{ background: "var(--panel)", border: `1px solid ${mode === "request" ? "var(--accent)" : "var(--border)"}`, borderRadius: 15, padding: 16, textAlign: "center" }}>
                <div style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(52,211,192,0.08)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Smartphone size={22} strokeWidth={1.7} color="var(--accent)" />
                </div>
                <div style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>
                  {mode === "request" ? "Enter your code" : "Open ISACS Authenticator"}
                </div>
                <div style={{ font: "500 11px var(--font-sans-stack)", color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
                  {mode === "request"
                    ? "Type the 6-digit code from your authenticator app to finish signing in."
                    : "Your device generates a fresh 6-digit code every 30 seconds — offline, time-based."}
                </div>
                {mode === "request" && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 14, padding: "9px 12px", background: "rgba(52,211,192,0.08)", border: "1px solid var(--accent)", borderRadius: 11 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "il-pulse 1.6s infinite" }} />
                    <span className="mono" style={{ font: "600 10px var(--font-mono-stack)", color: "var(--fg)" }}>Sign-in requested · {clock}</span>
                  </div>
                )}
              </div>
            )}

            <div className="mono" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 16, font: "500 9px var(--font-mono-stack)", color: "var(--faint)", letterSpacing: ".4px" }}>
              <ShieldCheck size={11} strokeWidth={2} color="var(--ok)" />
              END-TO-END ENCRYPTED · DEVICE-BOUND KEY
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
