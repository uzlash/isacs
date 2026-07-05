"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CircleAlert, CreditCard, Keyboard, QrCode, ShieldCheck } from "lucide-react";
import { ApiError, loginCard, mfaConfirm, mfaSetup } from "@/lib/api";
import QrScanner from "@/components/QrScanner";
import AuthenticatorPhone from "@/components/login/AuthenticatorPhone";

type Step = "credential" | "otp" | "enroll" | "success";
type CredType = "rfid" | "qr";

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
  const [qrManual, setQrManual] = useState(false); // QR: fall back to typing
  const [cardCode, setCardCode] = useState("");
  const [otp, setOtpState] = useState<string[]>([...EMPTY]);
  const [otpError, setOtpError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enroll, setEnroll] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  const otpRef = useRef(otp);
  const setOtp = (v: string[]) => {
    otpRef.current = v;
    setOtpState(v);
  };
  const cardRef = useRef("");
  const busyRef = useRef(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const timers = useRef<number[]>([]);
  const after = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const focus = (i: number) => inputs.current[i]?.focus();

  useEffect(() => {
    setMounted(true);
    const scheduled = timers.current;
    return () => {
      scheduled.forEach(clearTimeout);
    };
  }, []);

  const d = new Date();
  const clock = mounted ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "--:--";
  const filled = otp.every((x) => x !== "");

  // ---- step 1: present credential → card-only login to branch ----
  // `explicit` lets the QR scanner submit the decoded string directly, without
  // waiting for the cardCode state to settle.
  async function continueCredential(explicit?: string) {
    const code = (explicit ?? cardCode).trim();
    if (!code) {
      setError("Enter your access card credential.");
      return;
    }
    if (busyRef.current) return;
    setBusy(true);
    busyRef.current = true;
    setError("");
    setCardCode(code);
    cardRef.current = code;
    try {
      const r = await loginCard(code); // no TOTP yet
      if (r.requiresMfaSetup) {
        await beginEnrollment();
      } else {
        // Already authenticated without a code (unusual) → straight in.
        goToConsole();
      }
    } catch (e) {
      const err = e as ApiError;
      // A "code required" style error means the account is enrolled → collect the
      // TOTP next. A card-recognition error stays on this step.
      if (err.status && /card|recognis|not found|inactive|assign/i.test(err.message)) {
        setError(err.message); // stay on the credential step with the error
      } else {
        setStep("otp");
        setOtp([...EMPTY]);
        setOtpError(false);
        after(60, () => focus(0));
      }
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  // ---- step 2: verify TOTP ----
  async function verify() {
    if (busyRef.current) return;
    const entered = otpRef.current.join("");
    if (entered.length < 6) {
      setOtpError(true);
      return;
    }
    setBusy(true);
    busyRef.current = true;
    setError("");
    try {
      const r = await loginCard(cardRef.current, entered);
      if (r.requiresMfaSetup) {
        await beginEnrollment();
      } else {
        goToConsole();
      }
    } catch (e) {
      const err = e as ApiError;
      setOtpError(true);
      setOtp([...EMPTY]);
      setError(err.message || "Invalid code — check your authenticator and try again.");
      after(40, () => focus(0));
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  // ---- first-login MFA enrollment ----
  async function beginEnrollment() {
    setStep("enroll");
    setOtp([...EMPTY]);
    setOtpError(false);
    setError("");
    try {
      const s = await mfaSetup();
      setEnroll({ qrDataUrl: s.qrDataUrl, secret: s.secret });
      after(60, () => focus(0));
    } catch (e) {
      setError((e as ApiError).message || "Could not start authenticator setup.");
    }
  }

  async function confirmEnrollment() {
    if (busyRef.current) return;
    const entered = otpRef.current.join("");
    if (entered.length < 6) {
      setOtpError(true);
      return;
    }
    setBusy(true);
    busyRef.current = true;
    setError("");
    try {
      await mfaConfirm(entered);
      goToConsole();
    } catch (e) {
      setOtpError(true);
      setOtp([...EMPTY]);
      setError((e as ApiError).message || "That code didn't match — try the next one.");
      after(40, () => focus(0));
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  function goToConsole() {
    setStep("success");
    after(700, () => router.push("/"));
  }

  function resetFlow() {
    setStep("credential");
    setOtp([...EMPTY]);
    setOtpError(false);
    setError("");
    setEnroll(null);
  }

  // ---- otp box handlers (shared by verify + enroll steps) ----
  const onOtpComplete = step === "enroll" ? confirmEnrollment : verify;
  function setDigit(i: number, raw: string) {
    const v = (raw || "").replace(/\D/g, "").slice(-1);
    const next = [...otpRef.current];
    next[i] = v;
    setOtp(next);
    setOtpError(false);
    if (v && i < 5) focus(i + 1);
    if (next.every((x) => x !== "")) after(140, () => onOtpComplete());
  }
  function keyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otpRef.current[i] && i > 0) focus(i - 1);
  }
  function pasteOtp(e: React.ClipboardEvent) {
    e.preventDefault();
    const txt = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6).split("");
    if (!txt.length) return;
    const next = [...EMPTY];
    txt.forEach((c, idx) => (next[idx] = c));
    setOtp(next);
    setOtpError(false);
    focus(Math.min(txt.length, 6) - 1);
    if (txt.length === 6) after(140, () => onOtpComplete());
  }

  const stepIdx = { credential: 0, otp: 1, enroll: 1, success: 2 }[step];

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

  const linkBtn: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: 11,
    background: "none",
    border: "none",
    cursor: "pointer",
    font: "600 10.5px var(--font-mono-stack)",
    letterSpacing: ".3px",
    color: "var(--accent)",
    padding: 0,
  };

  function otpBoxes() {
    return (
      <div style={{ display: "flex", gap: 9, marginTop: 20, animation: otpError ? "il-shake .4s ease" : undefined }}>
        {otp.map((v, i) => (
          <input
            key={i}
            id={`otp-${i}`}
            name={`otp-${i}`}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={v}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => keyDown(i, e)}
            onPaste={pasteOtp}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
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
    );
  }

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at top, color-mix(in srgb, var(--accent) 6%, var(--bg)), var(--bg) 70%)",
      }}
    >
      <div style={{ position: "absolute", top: -180, left: -120, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,192,0.10), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -200, right: -120, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle, rgba(88,166,255,0.08), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 64, flexWrap: "wrap", justifyContent: "center", padding: 40 }}>
        {/* ===== LOGIN CARD ===== */}
        <div style={{ width: 440, flex: "0 0 440px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 24 }}>
            <Image src="/Nigerian_Air_Force_emblem.svg.png" alt="Nigerian Air Force" width={44} height={46} priority style={{ objectFit: "contain" }} />
            <div>
              <div style={{ font: "700 19px var(--font-sans-stack)", letterSpacing: "2px", color: "var(--fg)" }}>ISACS</div>
              <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", letterSpacing: "1.4px", color: "var(--faint)", marginTop: 1 }}>INTEGRATED SECURITY ACCESS CONTROL</div>
            </div>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }}>
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
                  Authenticate with your assigned access card, RFID tag, or visitor QR pass.
                </div>

                <div style={{ display: "flex", gap: 7, margin: "20px 0 16px", padding: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10 }}>
                  <button onClick={() => { setCredType("rfid"); setError(""); }} style={tabStyle(credType === "rfid")}>
                    <CreditCard size={15} strokeWidth={1.8} />
                    RFID / Card
                  </button>
                  <button onClick={() => { setCredType("qr"); setQrManual(false); setError(""); setCardCode(""); }} style={tabStyle(credType === "qr")}>
                    <QrCode size={15} strokeWidth={1.8} />
                    QR Pass
                  </button>
                </div>

                {/* RFID/Card — the reader is a keyboard (types the code + Enter),
                    so a masked, autofocused input captures it directly.
                    QR — a camera scan (a QR isn't keyboard input), with a
                    type-it fallback when the camera is unavailable. */}
                {credType === "rfid" || qrManual ? (
                  <>
                    <div className="field-label" style={{ marginBottom: 7, marginTop: 2 }}>
                      {credType === "rfid" ? "CARD NUMBER / RFID TAG" : "QR PASS CODE"}
                    </div>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <span style={{ position: "absolute", left: 13, display: "flex", pointerEvents: "none" }}>
                        {credType === "rfid" ? <CreditCard size={17} strokeWidth={1.7} color="var(--accent)" /> : <QrCode size={17} strokeWidth={1.7} color="var(--accent)" />}
                      </span>
                      <input
                        id="card-credential"
                        name="card-credential"
                        type="password"
                        className="input mono"
                        style={{ width: "100%", height: 52, paddingLeft: 40, paddingRight: 14, font: "500 15px var(--font-mono-stack)", letterSpacing: "3px" }}
                        value={cardCode}
                        onChange={(e) => setCardCode(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !busy && continueCredential()}
                        placeholder={credType === "rfid" ? "tap card or type · then Enter" : "type the QR code · then Enter"}
                        autoComplete="off"
                        autoFocus
                        disabled={busy}
                      />
                    </div>
                    {credType === "qr" && (
                      <button onClick={() => setQrManual(false)} style={linkBtn}>
                        <QrCode size={12} strokeWidth={1.9} /> use camera scanner instead
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="field-label" style={{ marginBottom: 7, marginTop: 2 }}>SCAN QR PASS</div>
                    <QrScanner
                      paused={busy}
                      onDecode={(text) => continueCredential(text)}
                    />
                    <button onClick={() => setQrManual(true)} style={linkBtn}>
                      <Keyboard size={12} strokeWidth={1.9} /> type the code instead
                    </button>
                  </>
                )}

                {error && (
                  <div role="alert" style={{ font: "600 11px var(--font-sans-stack)", color: "var(--danger)", marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <CircleAlert size={13} strokeWidth={2} />
                    {error}
                  </div>
                )}

                {(credType === "rfid" || qrManual) && (
                <button
                  onClick={() => continueCredential()}
                  disabled={busy}
                  style={{
                    width: "100%",
                    height: 46,
                    marginTop: 16,
                    borderRadius: 10,
                    border: "none",
                    cursor: busy ? "wait" : "pointer",
                    font: "600 12px var(--font-mono-stack)",
                    letterSpacing: ".6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    ...(busy ? { background: "var(--panel2)", color: "var(--muted)" } : { background: "var(--accent)", color: "#04120f" }),
                  }}
                >
                  {busy ? "AUTHENTICATING…" : <>CONTINUE <span style={{ fontSize: 14 }}>→</span></>}
                </button>
                )}
                <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", textAlign: "center", marginTop: 13, letterSpacing: ".3px" }}>
                  {credType === "rfid"
                    ? "Present your card to the reader, or type the code and press Enter."
                    : qrManual
                      ? "Type the QR pass code and press Enter."
                      : "Hold the visitor QR pass up to the camera. Deactivated passes are rejected."}
                </div>
              </div>
            )}

            {/* STEP 2: OTP  /  ENROLLMENT (same 6-box entry) */}
            {(step === "otp" || step === "enroll") && (
              <div style={{ padding: "22px 26px 28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, padding: 11, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 11, marginBottom: 20 }}>
                  <div className="mono" style={{ width: 38, height: 38, borderRadius: 9, background: "var(--accent)", color: "#04120f", display: "flex", alignItems: "center", justifyContent: "center", font: "700 12px var(--font-mono-stack)" }}>
                    {credType === "qr" ? "QR" : "ID"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 12.5px var(--font-sans-stack)", color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cardRef.current || cardCode}</div>
                    <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--accent)", letterSpacing: ".4px" }}>CREDENTIAL VERIFIED</div>
                  </div>
                  <button onClick={resetFlow} className="mono" style={{ font: "600 9.5px var(--font-mono-stack)", letterSpacing: ".4px", color: "var(--muted)", background: "none", border: "1px solid var(--border2)", borderRadius: 6, padding: "5px 9px", cursor: "pointer" }}>CHANGE</button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={17} strokeWidth={1.7} color="var(--accent)" />
                  <span style={{ font: "600 16px var(--font-sans-stack)", color: "var(--fg)" }}>
                    {step === "enroll" ? "Set up your authenticator" : "Two-factor authentication"}
                  </span>
                </div>
                <div style={{ font: "500 12.5px var(--font-sans-stack)", color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
                  {step === "enroll"
                    ? "Scan the QR on the right with your authenticator app, then enter the 6-digit code it generates."
                    : "Open your ISACS Authenticator app and enter the current 6-digit code."}
                </div>

                {otpBoxes()}

                {error && (
                  <div role="alert" style={{ font: "600 11px var(--font-sans-stack)", color: "var(--danger)", marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <CircleAlert size={13} strokeWidth={2} />
                    {error}
                  </div>
                )}

                <button
                  onClick={onOtpComplete}
                  disabled={busy}
                  style={{
                    width: "100%",
                    height: 46,
                    marginTop: 20,
                    borderRadius: 10,
                    border: "none",
                    font: "600 12px var(--font-mono-stack)",
                    letterSpacing: ".6px",
                    cursor: busy ? "wait" : "pointer",
                    ...(busy || !filled ? { background: "var(--panel2)", color: "var(--muted)" } : { background: "var(--accent)", color: "#04120f" }),
                  }}
                >
                  {busy ? "VERIFYING…" : step === "enroll" ? "ENABLE & SIGN IN" : "VERIFY & SIGN IN"}
                </button>
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
                <div style={{ font: "500 13px var(--font-sans-stack)", color: "var(--muted)", marginTop: 6 }}>Session secured. Entering the command center…</div>
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

          <div className="mono" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 18, font: "500 10px var(--font-mono-stack)", color: "var(--faint)", letterSpacing: ".3px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)", boxShadow: "0 0 6px var(--ok)" }} />
            ON-PREMISES · NO INTERNET DEPENDENCY · 15-MIN IDLE EXPIRY
          </div>
        </div>

        {/* ===== AUTHENTICATOR DEVICE ===== */}
        <AuthenticatorPhone
          clock={clock}
          mode={step === "enroll" ? "enroll" : step === "otp" ? "request" : "idle"}
          qrDataUrl={enroll?.qrDataUrl}
          secret={enroll?.secret}
        />
      </div>

    </div>
  );
}
