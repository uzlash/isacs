// ====================================================================
// Appointment history queries — paginated/filterable, distinct from the
// store's bulk `fetchAppointments` (resources.ts) used for the live list.
//   GET /appointments        paginated (filters: visitorId, hostStaffId,
//                             status, from, to, page, limit)
//   GET /appointments/:id    single
// Mutations (create/cancel/postpone) live in mutations.ts.
// ====================================================================

import { api, type Pagination } from "@/lib/api";
import type { ApptStatus } from "@/lib/types";

export interface ApiAppointmentDetail {
  id: string;
  scheduledAt: string;
  endsAt: string;
  purpose: string | null;
  status: ApptStatus;
  host: { id: string; name: string; designation?: string | null; department?: string | null } | null;
  visitor: { id: string; name: string } | null;
  requestedAccessNodeIds?: string[];
}

export interface AppointmentFilter {
  visitorId?: string;
  hostStaffId?: string;
  status?: ApptStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

function query(f?: AppointmentFilter): string {
  if (!f) return "";
  const p = new URLSearchParams();
  if (f.visitorId) p.set("visitorId", f.visitorId);
  if (f.hostStaffId) p.set("hostStaffId", f.hostStaffId);
  if (f.status) p.set("status", f.status);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.page !== undefined) p.set("page", String(f.page));
  if (f.limit !== undefined) p.set("limit", String(f.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listAppointments(
  filter?: AppointmentFilter
): Promise<{ items: ApiAppointmentDetail[]; pagination?: Pagination }> {
  const res = await api.get<ApiAppointmentDetail[]>(`/appointments${query(filter)}`);
  return { items: res.data, pagination: res.pagination };
}

export async function getAppointment(id: string): Promise<ApiAppointmentDetail> {
  const { data } = await api.get<ApiAppointmentDetail>(`/appointments/${id}`);
  return data;
}
