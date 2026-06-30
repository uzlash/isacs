"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CreditCard, QrCode, ShieldCheck, CircleAlert } from "lucide-react";
import { pretty, prevTotp, totpCode, totpRemain } from "@/lib/totp";
import QrMatrix from "@/components/login/QrMatrix";
import AuthenticatorPhone from "@/components/login/AuthenticatorPhone";

type Step = "credential" | "otp" | "success";
type CredType = "rfid" | "qr";
type OtpMethod = "totp" | "sms";

const EMPTY = ["", "", "", "", "", ""];
const STEP_DEFS: [string, string][] = [
  ["1", "Credential"],
  ["2", "Verify"],
  ["3", "Access"],
];
const pad = (n: number) => String(n).padStart(2, "0");

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("credential");
  const [credType, setCredType] = useState<CredType>("rfid");
  const [credBusy, setCredBusy] = useState(false);
  const [otpMethod, setOtpMethodState] = useState<OtpMethod>("totp");
  const [otp, setOtpState] = useState<string[]>([...EMPTY]);
  const [otpError, setOtpError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showSmsNotif, setShowSmsNotif] = useState(false);
  const [smsCode, setSmsCodeState] = useState("");
  const [, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  // refs mirror state so async (setTimeout) handlers read fresh values
  const otpRef = useRef(otp);
  const setOtp = (v: string[]) => {
    otpRef.current = v;
    setOtpState(v);
  };
  const otpMethodRef = useRef(otpMethod);
  const setOtpMethod = (v: OtpMethod) => {
    otpMethodRef.current = v;
    setOtpMethodState(v);
  };
  const smsCodeRef = useRef(smsCode);
  const setSmsCode = (v: string) => {
    smsCodeRef.current = v;
    setSmsCodeState(v);
  };
  const verifyingRef = useRef(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const timers = useRef<number[]>([]);

  const after = (ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };
  const focus = (i: number) => inputs.current[i]?.focus();

  useEffect(() => {
    setMounted(true);
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    const scheduled = timers.current;
    return () => {
      clearInterval(id);
      scheduled.forEach(clearTimeout);
    };
  }, []);

  // -------- step 1: credential --------
  const pickCred = (t: CredType) => {
    if (credBusy) return;
    setCredType(t);
  };
  const tapCredential = () => {
    if (credBusy) return;
    setCredBusy(true);
    after(1100, () => {
      setStep("otp");
      setCredBusy(false);
      setOtpMethod("totp");
      setOtp([...EMPTY]);
      setOtpError(false);
      after(60, () => focus(0));
    });
  };
  const resetFlow = () => {
    setStep("credential");
    setOtp([...EMPTY]);
    setOtpError(false);
    setShowSmsNotif(false);
    setSmsCode("");
  };

  // -------- otp method switching --------
  const useSms = () => {
    setOtpMethod("sms");
    setSmsCode(totpCode());
    setShowSmsNotif(false);
    setOtp([...EMPTY]);
    setOtpError(false);
    after(700, () => setShowSmsNotif(true));
  };
  const resendSms = () => {
    setShowSmsNotif(false);
    setSmsCode(totpCode());
    after(500, () => setShowSmsNotif(true));
  };
  const useTotp = () => {
    setOtpMethod("totp");
    setShowSmsNotif(false);
    setOtp([...EMPTY]);
    setOtpError(false);
  };
  const autofill = () => {
    const code = (smsCodeRef.current || totpCode()).split("");
    setOtp(code);
    setShowSmsNotif(false);
    setOtpError(false);
    after(350, () => verify());
  };
  const copyToken = () => {
    setOtp(totpCode().split(""));
    setOtpError(false);
    after(40, () => focus(5));
  };

  // -------- otp boxes --------
  const setDigit = (i: number, raw: string) => {
    const v = (raw || "").replace(/\D/g, "").slice(-1);
    const next = [...otpRef.current];
    next[i] = v;
    setOtp(next);
    setOtpError(false);
    if (v && i < 5) focus(i + 1);
    if (next.every((d) => d !== "")) after(180, () => verify());
  };
  const keyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpRef.current[i] && i > 0) focus(i - 1);
  };
  const pasteOtp = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const txt = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6).split("");
    if (!txt.length) return;
    const next = [...EMPTY];
    txt.forEach((d, idx) => (next[idx] = d));
    setOtp(next);
    setOtpError(false);
    focus(Math.min(txt.length, 6) - 1);
    if (txt.length === 6) after(180, () => verify());
  };
  const verify = () => {
    if (verifyingRef.current) return;
    const entered = otpRef.current.join("");
    if (entered.length < 6) {
      setOtpError(true);
      return;
    }
    setVerifying(true);
    verifyingRef.current = true;
    const method = otpMethodRef.current;
    const sms = smsCodeRef.current;
    after(850, () => {
      const valid =
        method === "sms" ? entered === sms : entered === totpCode() || entered === prevTotp();
      if (valid) {
        setStep("success");
      } else {
        setOtpError(true);
        setOtp([...EMPTY]);
        focus(0);
      }
      setVerifying(false);
      verifyingRef.current = false;
    });
  };

  // -------- derived (time values guarded until mounted to avoid hydration drift) --------
  const stepIdx = { credential: 0, otp: 1, success: 2 }[step];
  const remain = mounted ? totpRemain() : 30;
  const tone = remain <= 5 ? "var(--danger)" : remain <= 10 ? "var(--warn)" : "var(--accent)";
  const totpPretty = mounted ? pretty(totpCode()) : pretty("");
  const d = new Date();
  const clock = mounted ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "--:--";
  const filled = otp.every((x) => x !== "");
  const otpPrompt =
    otpMethod === "totp"
      ? "Open the ISACS Authenticator and enter the 6-digit code for ISACS Command."
      : "We sent a 6-digit code by SMS to the number ending ••• 18. Enter it below.";

  const tabStyle = (on: boolean): CSSProperties => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 38,
    borderRadius: 7,
    cursor: "pointer",
    font: "600 12px var(--font-sans-stack)",
    border: "none",
    background: on ? "var(--panel2)" : "transparent",
    color: on ? "var(--fg)" : "var(--muted)",
    boxShadow: on ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
  });

  const readerHint = credBusy
    ? credType === "rfid"
      ? "◉ READING CARD…"
      : "◉ DECODING PASS…"
    : credType === "rfid"
      ? "Hold card to the reader"
      : "Align QR within the frame";

  return (
    <div
      data-theme="obsidian"
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at top, #0d131c, #070a0f 70%)",
      }}
    >
      {/* ambient glows */}
      <div style={{ position: "absolute", top: -180, left: -120, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,192,0.10), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -200, right: -120, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle, rgba(88,166,255,0.08), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 64, flexWrap: "wrap", justifyContent: "center", padding: 40 }}>
        {/* ================= LOGIN CARD ================= */}
        <div style={{ width: 440, flex: "0 0 440px" }}>
          {/* brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 24 }}>
            <Image src="/Nigerian_Air_Force_emblem.svg.png" alt="Nigerian Air Force" width={44} height={46} priority style={{ objectFit: "contain" }} />
            <div>
              <div style={{ font: "700 19px var(--font-sans-stack)", letterSpacing: "2px", color: "var(--fg)" }}>ISACS</div>
              <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", letterSpacing: "1.4px", color: "var(--faint)", marginTop: 1 }}>INTEGRATED SECURITY ACCESS CONTROL</div>
            </div>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }}>
            {/* step rail */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 22px", borderBottom: "1px solid var(--border)" }}>
              {STEP_DEFS.map(([n, label], i) => {
                const done = i < stepIdx;
                const active = i === stepIdx;
                return (
                  <Fragment key={label}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        className="mono"
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          font: "600 10px var(--font-mono-stack)",
                          flex: "0 0 22px",
                          ...(active
                            ? { background: "var(--accent)", color: "#04120f" }
                            : done
                              ? { background: "rgba(63,185,80,0.15)", color: "var(--ok)", border: "1px solid var(--ok)" }
                              : { background: "var(--bg)", color: "var(--faint)", border: "1px solid var(--border2)" }),
                        }}
                      >
                        {done ? "✓" : n}
                      </span>
                      <span style={{ font: "600 11px var(--font-sans-stack)", color: active ? "var(--fg)" : done ? "var(--ok)" : "var(--faint)" }}>{label}</span>
                    </div>
                    {i < 2 && <span style={{ flex: 1, height: 1.5, borderRadius: 2, background: done ? "var(--ok)" : "var(--border2)" }} />}
                  </Fragment>
                );
              })}
            </div>

            {/* STEP 1: CREDENTIAL */}
            {step === "credential" && (
              <div style={{ padding: "26px 26px 28px" }}>
                <div style={{ font: "600 17px var(--font-sans-stack)", color: "var(--fg)" }}>Present your credential</div>
                <div style={{ font: "500 12.5px var(--font-sans-stack)", color: "var(--muted)", marginTop: 5, lineHeight: 1.5 }}>
                  Authenticate with your assigned access card or visitor pass to begin.
                </div>

                <div style={{ display: "flex", gap: 7, margin: "20px 0 18px", padding: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10 }}>
                  <button onClick={() => pickCred("rfid")} style={tabStyle(credType === "rfid")}>
                    <CreditCard size={15} strokeWidth={1.8} />
                    RFID Card
                  </button>
                  <button onClick={() => pickCred("qr")} style={tabStyle(credType === "qr")}>
                    <QrCode size={15} strokeWidth={1.8} />
                    QR Pass
                  </button>
                </div>

                <div style={{ position: "relative", height: 188, border: "1px dashed var(--border2)", borderRadius: 12, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {credType === "rfid" ? (
                    <>
                      <div style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", border: "1.5px solid var(--accent)", opacity: 0, animation: "il-ring 2.2s infinite" }} />
                      <div style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", border: "1.5px solid var(--accent)", opacity: 0, animation: "il-ring 2.2s infinite 1.1s" }} />
                      <div
                        style={{
                          width: 150,
                          height: 94,
                          borderRadius: 11,
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          background: "linear-gradient(135deg, #1b2433, #0f141d)",
                          border: "1px solid var(--border2)",
                          boxShadow: "0 10px 26px rgba(0,0,0,0.5)",
                          transform: credBusy ? "translateY(-6px) scale(1.03)" : "translateY(0)",
                          transition: "transform .5s ease",
                          position: "relative",
                          zIndex: 2,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ width: 22, height: 16, borderRadius: 3, background: "linear-gradient(135deg, #d9b85c, #a9842f)" }} />
                          <span className="mono" style={{ font: "600 7px var(--font-mono-stack)", color: "rgba(255,255,255,0.7)", letterSpacing: 1 }}>ISACS</span>
                        </div>
                        <div>
                          <div className="mono" style={{ font: "600 9px var(--font-mono-stack)", color: "#fff", letterSpacing: 1.5 }}>CARD-00231</div>
                          <div className="mono" style={{ font: "500 7px var(--font-mono-stack)", color: "rgba(255,255,255,0.6)", marginTop: 2 }}>RFID-8841 · SGT D. PARK</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ position: "relative", width: 128, height: 128 }}>
                      <div style={{ width: 128, height: 128, borderRadius: 8, overflow: "hidden", opacity: credBusy ? 1 : 0.92 }}>
                        <QrMatrix />
                      </div>
                      <span style={{ position: "absolute", top: -4, left: -4, width: 22, height: 22, borderTop: "2px solid var(--accent)", borderLeft: "2px solid var(--accent)", borderRadius: "3px 0 0 0" }} />
                      <span style={{ position: "absolute", top: -4, right: -4, width: 22, height: 22, borderTop: "2px solid var(--accent)", borderRight: "2px solid var(--accent)", borderRadius: "0 3px 0 0" }} />
                      <span style={{ position: "absolute", bottom: -4, left: -4, width: 22, height: 22, borderBottom: "2px solid var(--accent)", borderLeft: "2px solid var(--accent)", borderRadius: "0 0 0 3px" }} />
                      <span style={{ position: "absolute", bottom: -4, right: -4, width: 22, height: 22, borderBottom: "2px solid var(--accent)", borderRight: "2px solid var(--accent)", borderRadius: "0 0 3px 0" }} />
                      {!credBusy && <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "var(--accent)", boxShadow: "0 0 10px var(--accent)", animation: "il-scan 1.6s ease-in-out infinite" }} />}
                    </div>
                  )}
                  <div className="mono" style={{ position: "absolute", bottom: 14, font: "500 11px var(--font-mono-stack)", color: "var(--faint)", letterSpacing: ".4px" }}>{readerHint}</div>
                </div>

                <button
                  onClick={tapCredential}
                  style={{
                    width: "100%",
                    height: 46,
                    marginTop: 20,
                    borderRadius: 10,
                    border: "none",
                    cursor: credBusy ? "wait" : "pointer",
                    font: "600 12px var(--font-mono-stack)",
                    letterSpacing: ".6px",
                    ...(credBusy ? { background: "var(--panel2)", color: "var(--muted)" } : { background: "var(--accent)", color: "#04120f" }),
                  }}
                >
                  {credBusy ? "AUTHENTICATING…" : "TAP TO SCAN"}
                </button>
                <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--faint)", textAlign: "center", marginTop: 13, letterSpacing: ".3px" }}>
                  Deactivated cards are rejected at this screen.
                </div>
              </div>
            )}

            {/* STEP 2: OTP */}
            {step === "otp" && (
              <div style={{ padding: "22px 26px 28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, padding: 11, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 11, marginBottom: 20 }}>
                  <div className="mono" style={{ width: 38, height: 38, borderRadius: 9, background: "var(--accent)", color: "#04120f", display: "flex", alignItems: "center", justifyContent: "center", font: "700 14px var(--font-mono-stack)" }}>SA</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>Cmdr. R. Okafor</div>
                    <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--accent)", letterSpacing: ".4px" }}>SUPER ADMIN · E-1001</div>
                  </div>
                  <button onClick={resetFlow} className="mono" style={{ font: "600 9.5px var(--font-mono-stack)", letterSpacing: ".4px", color: "var(--muted)", background: "none", border: "1px solid var(--border2)", borderRadius: 6, padding: "5px 9px", cursor: "pointer" }}>CHANGE</button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={17} strokeWidth={1.7} color="var(--accent)" />
                  <span style={{ font: "600 16px var(--font-sans-stack)", color: "var(--fg)" }}>Two-factor authentication</span>
                </div>
                <div style={{ font: "500 12.5px var(--font-sans-stack)", color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>{otpPrompt}</div>

                <div style={{ display: "flex", gap: 9, marginTop: 20, animation: otpError ? "il-shake .4s ease" : undefined }}>
                  {otp.map((v, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        inputs.current[i] = el;
                      }}
                      value={v}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => keyDown(i, e)}
                      onPaste={pasteOtp}
                      inputMode="numeric"
                      maxLength={1}
                      aria-label={`Verification digit ${i + 1}`}
                      style={{
                        width: 46,
                        height: 56,
                        textAlign: "center",
                        font: "600 24px var(--font-mono-stack)",
                        color: "var(--fg)",
                        background: "var(--bg)",
                        border: `1.5px solid ${otpError ? "var(--danger)" : v ? "var(--accent)" : "var(--border2)"}`,
                        borderRadius: 11,
                        outline: "none",
                        transition: "border-color .15s",
                        marginRight: i === 2 ? 8 : undefined,
                      }}
                    />
                  ))}
                </div>

                {otpError && (
                  <div role="alert" style={{ font: "600 11px var(--font-sans-stack)", color: "var(--danger)", marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <CircleAlert size={13} strokeWidth={2} />
                    Invalid code — check your authenticator and try again.
                  </div>
                )}

                <button
                  onClick={verify}
                  style={{
                    width: "100%",
                    height: 46,
                    marginTop: 20,
                    borderRadius: 10,
                    border: "none",
                    font: "600 12px var(--font-mono-stack)",
                    letterSpacing: ".6px",
                    cursor: verifying ? "wait" : "pointer",
                    ...(verifying
                      ? { background: "var(--panel2)", color: "var(--muted)" }
                      : filled
                        ? { background: "var(--accent)", color: "#04120f" }
                        : { background: "var(--panel2)", color: "var(--muted)" }),
                  }}
                >
                  {verifying ? "VERIFYING…" : "VERIFY & SIGN IN"}
                </button>

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  {otpMethod === "totp" ? (
                    <button onClick={useSms} style={{ font: "600 11.5px var(--font-sans-stack)", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                      Can&apos;t reach your authenticator? Send a code by SMS →
                    </button>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <button onClick={useTotp} style={{ font: "600 11.5px var(--font-sans-stack)", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>← Use authenticator app</button>
                      <button onClick={resendSms} style={{ font: "600 11.5px var(--font-sans-stack)", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Resend code</button>
                    </div>
                  )}
                  <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", marginTop: 10, letterSpacing: ".2px", lineHeight: 1.5 }}>
                    TOTP authenticator is the primary method. SMS is the fallback when the app is unavailable.
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: SUCCESS */}
            {step === "success" && (
              <div style={{ padding: "40px 26px", textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", border: "2px solid var(--ok)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", background: "rgba(63,185,80,0.08)" }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 32, animation: "il-check .5s ease forwards" }}>
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </div>
                <div style={{ font: "600 18px var(--font-sans-stack)", color: "var(--fg)" }}>Authentication successful</div>
                <div style={{ font: "500 13px var(--font-sans-stack)", color: "var(--muted)", marginTop: 6 }}>Welcome back, Cmdr. Okafor. Session secured.</div>
                <div className="mono" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 18, font: "500 11px var(--font-mono-stack)", color: "var(--faint)" }}>
                  <span style={{ width: 13, height: 13, border: "2px solid var(--border2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "il-spin .8s linear infinite" }} />
                  Establishing secure session…
                </div>
                <button
                  onClick={() => router.push("/")}
                  className="mono"
                  style={{ display: "block", width: "100%", marginTop: 22, height: 44, borderRadius: 10, border: "none", background: "var(--accent)", color: "#04120f", font: "600 12px var(--font-mono-stack)", letterSpacing: ".6px", cursor: "pointer" }}
                >
                  ENTER COMMAND CENTER →
                </button>
              </div>
            )}
          </div>

          {/* footer */}
          <div className="mono" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 18, font: "500 10px var(--font-mono-stack)", color: "var(--faint)", letterSpacing: ".3px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)", boxShadow: "0 0 6px var(--ok)" }} />
            ON-PREMISES · NO INTERNET DEPENDENCY · 15-MIN IDLE EXPIRY
          </div>
        </div>

        {/* ================= AUTHENTICATOR PHONE ================= */}
        <AuthenticatorPhone
          clock={clock}
          totpPretty={totpPretty}
          remain={remain}
          pct={`${(remain / 30) * 100}%`}
          tone={tone}
          showRequest={step === "otp"}
          showSmsNotif={showSmsNotif}
          smsPretty={pretty(smsCode)}
          onAutofill={autofill}
          onCopyToken={copyToken}
        />
      </div>
    </div>
  );
}
