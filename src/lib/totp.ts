// ====================================================================
// DEMO TOTP — deterministic 6-digit code derived from a 30s time window
// so the login page and the on-screen authenticator mock always agree.
//
// This is a stand-in for the prototype only. In production the SERVER is
// the source of truth: standard TOTP (RFC 6238), 30s step, 6 digits,
// SHA-1, accept ±1 window skew, secret bound to the user at enrollment.
// Verification happens via POST /auth/verify-otp.
// ====================================================================

const SEED_SUFFIX = "ISACS-OKAFOR";

function codeForWindow(win: number): string {
  let h = 0;
  const seed = String(win) + SEED_SUFFIX;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return String(h % 1000000).padStart(6, "0");
}

/** Current-window code. */
export function totpCode(now: number = Date.now()): string {
  return codeForWindow(Math.floor(now / 30000));
}

/** Previous-window code (accepted to tolerate a roll-over mid-entry). */
export function prevTotp(now: number = Date.now()): string {
  return codeForWindow(Math.floor(now / 30000) - 1);
}

/** Seconds left in the current 30s window. */
export function totpRemain(now: number = Date.now()): number {
  return 30 - Math.floor((now / 1000) % 30);
}

/** "123 456" grouping for display; placeholder when empty. */
export function pretty(code: string): string {
  return code ? code.slice(0, 3) + " " + code.slice(3) : "•••  •••";
}
