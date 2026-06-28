// ====================================================================
// Central runtime config.
//
// DATA_SOURCE selects where the console reads/writes data:
//   "mock" — in-memory seed + local CRUD (default; bulletproof for demos)
//   "live" — the real ISACS REST API (requires auth + a same-origin proxy)
//
// Both are driven by env vars so flipping the demo to the live backend is
// a one-line change (see .env.local / .env.example).
// ====================================================================

export type DataSource = "mock" | "live";

export const DATA_SOURCE: DataSource =
  (process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource) || "mock";

/**
 * Base URL of the ISACS API.
 *
 * In the browser we prefer a SAME-ORIGIN path ("/api") and let Next.js proxy
 * to the real server — this sidesteps CORS (the server sends
 * `Cross-Origin-Resource-Policy: same-origin`) and lets us keep tokens in
 * httpOnly cookies. The absolute upstream URL is only used server-side.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_ISACS_API_BASE_URL || "/api";

/** Absolute upstream URL — used by the server-side proxy only. */
export const API_UPSTREAM_URL =
  process.env.ISACS_API_UPSTREAM_URL || "https://isacs.zumalogix.com/api";

export const isLive = DATA_SOURCE === "live";
