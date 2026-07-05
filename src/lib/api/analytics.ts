// ====================================================================
// Dashboard analytics. GET /analytics/dashboard — any authenticated user;
// the response SHAPE depends on the caller's role:
//   - manager / super_admin / auditor → facility-wide rollup
//   - security_personnel               → a "me"-scoped subset
// We model both and expose a discriminated result so the UI can branch.
// ====================================================================

import { api } from "@/lib/api";

export type ReportSource = "access-control" | "surveillance" | "assets" | "lockdown" | "manual";

export interface LockdownSummary {
  active: boolean;
  details: { id: string; nodeIds: string[] | null; description: string; createdAt: string } | null;
}

/** Facility-wide analytics (manager / super_admin / auditor). */
export interface FacilityAnalytics {
  acms: { total: number; online: number; offline: number; inactive: number };
  lockdown: LockdownSummary;
  reports: {
    open: number;
    investigating: number;
    resolved: number;
    unassigned: number;
    openBySource: Record<ReportSource, number>;
  };
  visitors: { checkedInToday: number };
  appointments: { today: number; upcoming: number };
  personnel: { total: number; assignedToNodes: number; unassigned: number };
  staff: { total: number };
  nodes: { total: number };
}

/** Personnel-scoped analytics (security_personnel). */
export interface PersonnelAnalytics {
  reports: { assignedToMe: { open: number; investigating: number } };
  lockdown: LockdownSummary;
  assignedNodes: { count: number; acms: { total: number; online: number; offline: number } };
  visitors: { checkedInToday: number };
  appointments: { today: number };
}

export type DashboardAnalytics =
  | { scope: "facility"; data: FacilityAnalytics }
  | { scope: "personnel"; data: PersonnelAnalytics };

// Distinguish the two shapes by a field unique to each.
function isPersonnel(d: Record<string, unknown>): boolean {
  const reports = d.reports as Record<string, unknown> | undefined;
  const nodes = d.assignedNodes as Record<string, unknown> | undefined;
  return !!nodes || (!!reports && "assignedToMe" in reports);
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  const { data } = await api.get<Record<string, unknown>>("/analytics/dashboard");
  if (isPersonnel(data)) {
    return { scope: "personnel", data: data as unknown as PersonnelAnalytics };
  }
  return { scope: "facility", data: data as unknown as FacilityAnalytics };
}
