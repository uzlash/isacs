// Shared formatting + tone mapping helpers (ported from the prototype).

import type { Role, Severity } from "./types";

/** Relative "Xs / Xm / Xh / Xd ago"-style string (returns the magnitude). */
export function rel(ms: number, now: number = Date.now()): string {
  const d = Math.max(0, now - ms);
  const s = Math.floor(d / 1000);
  if (s < 5) return "now";
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
}

export function sevColor(sev: Severity): string {
  return (
    {
      critical: "var(--danger)",
      high: "var(--warn)",
      medium: "var(--info)",
      low: "var(--muted)",
    }[sev] || "var(--muted)"
  );
}

export function statusTone(st: string): string {
  return (
    {
      open: "var(--danger)",
      investigating: "var(--warn)",
      resolved: "var(--ok)",
      scheduled: "var(--info)",
      active: "var(--ok)",
      postponed: "var(--warn)",
      cancelled: "var(--faint)",
    }[st] || "var(--muted)"
  );
}

export const roleMeta: Record<Role, { label: string; tone: string }> = {
  super_admin: { label: "Super Administrator", tone: "var(--danger)" },
  security_manager: { label: "Security Manager", tone: "var(--accent)" },
  security_personnel: { label: "Security Personnel", tone: "var(--info)" },
  staff_admin: { label: "Staff Administrator", tone: "var(--warn)" },
  auditor: { label: "Auditor", tone: "var(--muted)" },
};

export const sourceMeta: Record<string, string> = {
  access: "Access Control",
  surveillance: "Surveillance",
  assets: "Asset Protocol",
  manual: "Manual Report",
};

export const cardTypeTone: Record<string, string> = {
  staff: "var(--accent)",
  visitor: "var(--info)",
  vehicle: "var(--warn)",
};

export function initials(name: string): string {
  return name
    .split(" ")
    .map((x) => x[0])
    .join("")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

export const VIEW_TITLES: Record<string, [string, string]> = {
  dashboard: ["Command Center", "ALPHA COMPOUND · real-time security overview"],
  incidents: ["ASRS — Incident Management", "Automated Security Response System · unified incident log"],
  surveillance: ["Surveillance", "Camera registry · periodic snapshots · escalation"],
  access: ["Access Control", "Node hierarchy · cards · live checkpoint engine"],
  assets: ["Assets & Protocols", "GPS tracking · geofence & speed protocols"],
  visitors: ["Visitor Management", "Persistent registry · check-in · card assignments"],
  appointments: ["Appointment Scheduling", "Structured visit management · double-booking prevention"],
  staff: ["Staff Registry", "Authoritative personnel record"],
  users: ["Users & Roles", "5 permission levels · configurable RBAC"],
  settings: ["Configurable System Rules", "Facility policy · audit-logged"],
};

// Role permission matrix (rows × roles) — encodes the brief's role model.
export const ROLE_MATRIX = {
  roles: ["Super Admin", "Sec. Manager", "Sec. Personnel", "Staff Admin", "Auditor"],
  rows: [
    { name: "System Config", vals: [1, 0, 0, 0, 0] },
    { name: "Manage Users", vals: [1, 0, 0, 0, 0] },
    { name: "Manage Staff", vals: [1, 1, 0, 1, 0] },
    { name: "Process Visitors", vals: [1, 1, 1, 1, 0] },
    { name: "Schedule Appts", vals: [1, 1, 1, 1, 0] },
    { name: "Access Control Check", vals: [1, 1, 1, 0, 0] },
    { name: "View All Incidents", vals: [1, 1, 0, 0, 1] },
    { name: "Resolve Incidents", vals: [1, 1, 1, 0, 0] },
    { name: "Surveillance Feeds", vals: [1, 1, 1, 0, 1] },
    { name: "Read-only Audit", vals: [1, 1, 1, 1, 1] },
  ],
} as const;
