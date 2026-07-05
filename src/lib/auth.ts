"use client";

// Client-side session helpers. The access/refresh tokens live in httpOnly
// cookies (invisible to JS); the current user profile is mirrored in a
// readable cookie (USER_COOKIE) so the UI can render name/role without a
// round-trip.

import { useEffect, useState } from "react";
import { USER_COOKIE } from "@/lib/config";
import { logout, type SessionUser } from "@/lib/api";

export function getSessionUser(): SessionUser | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie
    .split("; ")
    .find((c) => c.startsWith(USER_COOKIE + "="));
  if (!entry) return null;
  try {
    return JSON.parse(decodeURIComponent(entry.slice(USER_COOKIE.length + 1))) as SessionUser;
  } catch {
    return null;
  }
}

export function useSessionUser(): SessionUser | null {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => {
    setUser(getSessionUser());
  }, []);
  return user;
}

export async function doLogout(): Promise<void> {
  await logout();
  if (typeof window !== "undefined") window.location.assign("/login");
}
