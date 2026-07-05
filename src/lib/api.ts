// ====================================================================
// Browser API client. Talks to the same-origin BFF (/api/*), unwraps the
// { ok, message, data, pagination } envelope, and transparently refreshes
// the access token once on a 401 before redirecting to the card login.
// ====================================================================

import { API_BASE_URL } from "@/lib/config";

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiResult<T> {
  data: T;
  message: string;
  pagination?: Pagination;
}

export class ApiError extends Error {
  status: number;
  detail?: string;
  data?: unknown;
  constructor(message: string, status: number, detail?: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.data = data;
  }
}

function redirectToLogin() {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.assign("/login");
  }
}

// de-dupe concurrent refreshes
let refreshing: Promise<boolean> | null = null;
function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API_BASE_URL}/auth/refresh`, { method: "POST", credentials: "same-origin" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        // allow a fresh attempt on the next 401 cycle
        queueMicrotask(() => {
          refreshing = null;
        });
      });
  }
  return refreshing;
}

const REQUEST_TIMEOUT_MS = 15000;

async function request<T>(path: string, init: RequestInit = {}, allowRetry = true): Promise<ApiResult<T>> {
  const isForm = init.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        ...(init.body != null && !isForm ? { "content-type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
  } catch (e) {
    // network failure or timeout — never hang the caller
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    throw new ApiError(timedOut ? "Request timed out" : "Network error", 0, String(e));
  }

  if (res.status === 401 && allowRetry && !path.startsWith("/auth/")) {
    const ok = await refreshOnce();
    if (ok) return request<T>(path, init, false);
    redirectToLogin();
    throw new ApiError("Session expired", 401);
  }

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok || json?.ok === false) {
    const message =
      (json?.message as string) || (json?.error as string) || res.statusText || "Request failed";
    throw new ApiError(message, res.status, json?.error as string, json?.data);
  }

  return {
    data: json?.data as T,
    message: (json?.message as string) ?? "",
    pagination: json?.pagination as Pagination | undefined,
  };
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body != null ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body != null ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** multipart upload (purpose passed as query param) */
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
  /** raw binary POST (e.g. camera snapshot as image/jpeg) — explicit content-type
   *  overrides the default JSON header; the BFF forwards the bytes verbatim. */
  raw: <T>(path: string, body: Blob | ArrayBuffer, contentType: string) =>
    request<T>(path, { method: "POST", body, headers: { "content-type": contentType } }),
};

// ---------- auth-specific calls (bypass the refresh/redirect cycle) ----------

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  staffId: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
}

export async function loginCard(
  cardCode: string,
  code?: string
): Promise<{ requiresMfaSetup?: boolean; user?: SessionUser }> {
  const r = await request<{ requiresMfaSetup?: boolean; user?: SessionUser }>("/auth/login/card", {
    method: "POST",
    body: JSON.stringify({ cardCode, ...(code ? { code } : {}) }),
  });
  return r.data;
}

export async function mfaSetup(): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
  const r = await request<{ secret: string; otpauthUrl: string; qrDataUrl: string }>("/auth/mfa/setup", {
    method: "POST",
    body: "{}",
  });
  return r.data;
}

export async function mfaConfirm(code: string): Promise<{ user?: SessionUser }> {
  const r = await request<{ user?: SessionUser }>("/auth/mfa/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return r.data;
}

export async function logout(): Promise<void> {
  await request("/auth/logout", { method: "POST" }).catch(() => {});
}
