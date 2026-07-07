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
  (process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource) || "live";

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

/**
 * Absolute upstream URL — used by the server-side proxy only. Points at the
 * Traefik gateway in front of the ISACS backend's services; Traefik itself
 * does the per-service path routing (see isacs_backend/docker-compose.yml),
 * so every /api/* resource goes through this single upstream.
 */
export const API_UPSTREAM_URL =
  process.env.ISACS_API_UPSTREAM_URL || "http://127.0.0.1/api";

/** Cookie names for the BFF-managed session (httpOnly access/refresh). */
export const ACCESS_COOKIE = "isacs_at";
export const REFRESH_COOKIE = "isacs_rt";
/** Readable (non-httpOnly) cookie holding the current user profile JSON. */
export const USER_COOKIE = "isacs_user";

export const isLive = DATA_SOURCE === "live";
