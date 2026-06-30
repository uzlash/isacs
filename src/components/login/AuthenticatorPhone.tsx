"use client";

import { Copy, Plus, ShieldCheck } from "lucide-react";

// Live illustration of the operator's ISACS Authenticator device. Per the
// handoff this is NOT part of the production web login (it's the separate
// mobile app) — it's kept here so the demo is self-explanatory: the code
// shown matches what the login expects. Trivially removable.

interface Props {
  clock: string;
  totpPretty: string;
  remain: number;
  pct: string;
  tone: string;
  showRequest: boolean;
  showSmsNotif: boolean;
  smsPretty: string;
  onAutofill: () => void;
  onCopyToken: () => void;
}

export default function AuthenticatorPhone({
  clock,
  totpPretty,
  remain,
  pct,
  tone,
  showRequest,
  showSmsNotif,
  smsPretty,
  onAutofill,
  onCopyToken,
}: Props) {
  return (
    <div style={{ position: "relative", width: 312, flex: "0 0 312px" }}>
      <div className="mono" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: "1.4px", color: "var(--faint)", textAlign: "center", marginBottom: 14 }}>
        ISACS AUTHENTICATOR · YOUR DEVICE
      </div>
      <div style={{ position: "relative", width: 312, height: 632, background: "#05080d", border: "1px solid var(--border2)", borderRadius: 46, padding: 11, boxShadow: "0 30px 70px rgba(0,0,0,0.5)" }}>
        <div style={{ position: "relative", width: "100%", height: "100%", background: "var(--bg)", borderRadius: 36, overflow: "hidden" }}>
          {/* notch */}
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 118, height: 26, background: "#05080d", borderRadius: "0 0 16px 16px", zIndex: 5 }} />

          {/* status bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 22px 6px", position: "relative", zIndex: 4 }}>
            <span className="mono" style={{ font: "600 12px var(--font-mono-stack)", color: "var(--fg)" }}>{clock}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="15" height="11" viewBox="0 0 18 12" fill="var(--fg)"><rect x="0" y="7" width="3" height="5" rx="1" /><rect x="5" y="4" width="3" height="8" rx="1" /><rect x="10" y="1" width="3" height="11" rx="1" /><rect x="15" y="1" width="3" height="11" rx="1" opacity="0.4" /></svg>
              <svg width="15" height="11" viewBox="0 0 20 14" fill="none" stroke="var(--fg)" strokeWidth="1.4"><path d="M2 5a13 13 0 0116 0M5 8a8 8 0 0110 0M8.5 11a3 3 0 013 0" /></svg>
              <div style={{ width: 22, height: 11, border: "1.4px solid var(--fg)", borderRadius: 3, position: "relative", opacity: 0.9 }}>
                <div style={{ position: "absolute", inset: 1.5, right: 5, background: "var(--ok)", borderRadius: 1 }} />
                <div style={{ position: "absolute", right: -3, top: 3, width: 2, height: 5, background: "var(--fg)", borderRadius: "0 1px 1px 0" }} />
              </div>
            </div>
          </div>

          {/* SMS notification */}
          {showSmsNotif && (
            <div onClick={onAutofill} style={{ position: "absolute", top: 46, left: 12, right: 12, zIndex: 10, background: "rgba(22,29,40,0.9)", backdropFilter: "blur(12px)", border: "1px solid var(--border2)", borderRadius: 16, padding: "12px 14px", cursor: "pointer", animation: "il-notif .4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: "var(--ok)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#04120a" strokeWidth="2.2"><path d="M4 6h16v12H4z" /><path d="M4 7l8 6 8-6" /></svg>
                </div>
                <span style={{ font: "600 11px var(--font-sans-stack)", color: "var(--fg)" }}>Messages</span>
                <span className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)" }}>now</span>
              </div>
              <div style={{ font: "600 11.5px var(--font-sans-stack)", color: "var(--fg)" }}>ISACS Security</div>
              <div style={{ font: "500 11.5px var(--font-sans-stack)", color: "var(--muted)", marginTop: 2, lineHeight: 1.45 }}>
                Your verification code is{" "}
                <span className="mono" style={{ color: "var(--fg)", fontWeight: 600, letterSpacing: 1 }}>{smsPretty}</span>. Valid 5 min. Do not share.
              </div>
              <div className="mono" style={{ font: "600 9px var(--font-mono-stack)", color: "var(--accent)", marginTop: 7, letterSpacing: ".5px" }}>TAP TO AUTOFILL →</div>
            </div>
          )}

          {/* app body */}
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ width: 34, height: 34, border: "1.5px solid var(--accent)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldCheck size={17} strokeWidth={1.7} color="var(--accent)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: "700 14px var(--font-sans-stack)", letterSpacing: ".3px", color: "var(--fg)" }}>Authenticator</div>
                <div className="mono" style={{ font: "500 8.5px var(--font-mono-stack)", letterSpacing: 1, color: "var(--faint)" }}>ISACS · SECURE TOTP</div>
              </div>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--panel2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
                <Plus size={15} strokeWidth={2} />
              </div>
            </div>

            {showRequest && (
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", background: "rgba(52,211,192,0.08)", border: "1px solid var(--accent)", borderRadius: 11, marginBottom: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "il-pulse 1.6s infinite", flex: "0 0 8px" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ font: "600 11px var(--font-sans-stack)", color: "var(--fg)" }}>Sign-in requested</div>
                  <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--muted)" }}>Main Console · {clock}</div>
                </div>
              </div>
            )}

            <div className="mono" style={{ font: "600 9px var(--font-mono-stack)", letterSpacing: "1.2px", color: "var(--faint)", marginBottom: 9 }}>ACCOUNTS</div>

            {/* primary account token */}
            <div style={{ background: "var(--panel)", border: "1px solid var(--accent)", borderRadius: 15, padding: 15, marginBottom: 11 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
                <div className="mono" style={{ width: 26, height: 26, borderRadius: 7, background: "var(--accent)", color: "#04120f", display: "flex", alignItems: "center", justifyContent: "center", font: "700 11px var(--font-mono-stack)" }}>I</div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: "600 12px var(--font-sans-stack)", color: "var(--fg)" }}>ISACS Command</div>
                  <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)" }}>r.okafor@alpha.mil</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div className="mono" style={{ flex: 1, font: "600 33px var(--font-mono-stack)", letterSpacing: 5, color: "var(--accent)" }}>{totpPretty}</div>
                <button onClick={onCopyToken} title="Copy code" style={{ width: 34, height: 34, borderRadius: 9, background: "var(--panel2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", cursor: "pointer", flex: "0 0 34px" }}>
                  <Copy size={15} strokeWidth={1.8} />
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 13 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 3, background: "var(--panel3)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: pct, background: tone, borderRadius: 3, transition: "width 1s linear" }} />
                </div>
                <span className="mono" style={{ font: "600 11px var(--font-mono-stack)", color: tone, width: 26, textAlign: "right" }}>{remain}s</span>
              </div>
              <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)", marginTop: 8, letterSpacing: ".3px" }}>Refreshes every 30s · time-based · works offline</div>
            </div>

            {/* secondary account (hidden token) */}
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 15, padding: "13px 15px", opacity: 0.62 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div className="mono" style={{ width: 26, height: 26, borderRadius: 7, background: "var(--info)", color: "#04121f", display: "flex", alignItems: "center", justifyContent: "center", font: "700 11px var(--font-mono-stack)" }}>V</div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: "600 12px var(--font-sans-stack)", color: "var(--fg)" }}>ISACS VPN Gateway</div>
                  <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)" }}>r.okafor@alpha.mil</div>
                </div>
                <div className="mono" style={{ font: "600 20px var(--font-mono-stack)", letterSpacing: 3, color: "var(--muted)" }}>••• •••</div>
              </div>
            </div>

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
