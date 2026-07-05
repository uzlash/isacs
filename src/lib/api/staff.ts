// ====================================================================
// Staff API — the facility's personnel records. See ISACS_API_Reference
// "Staff".
//   GET    /staff        list (filters: search, department, designation)
//   POST   /staff        create (staffId + email unique)
//   POST   /staff/bulk   upsert many (returns total/created/updated)
//   GET    /staff/:id    single (includes linked user account, if any)
//   PUT    /staff/:id    update
//   DELETE /staff/:id    remove
// ====================================================================

import { api } from "@/lib/api";

export interface ApiStaff {
  id: string;
  staffId: string;
  name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  department: string | null;
  pictureUrl: string | null;
  accessLevels?: string[];
  createdAt: string;
  updatedAt: string;
}

/** Single-staff response — includes the linked user account, if one exists. */
export interface ApiStaffWithAccount extends ApiStaff {
  account?: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    lastLoginAt: string | null;
  } | null;
}

export interface StaffFilter {
  search?: string;
  department?: string;
  designation?: string;
  page?: number;
  limit?: number;
}

function query(f?: StaffFilter): string {
  if (!f) return "";
  const p = new URLSearchParams();
  if (f.search) p.set("search", f.search);
  if (f.department) p.set("department", f.department);
  if (f.designation) p.set("designation", f.designation);
  if (f.page !== undefined) p.set("page", String(f.page));
  if (f.limit !== undefined) p.set("limit", String(f.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listStaff(filter?: StaffFilter): Promise<ApiStaff[]> {
  const { data } = await api.get<ApiStaff[]>(`/staff${query(filter)}`);
  return data;
}

export async function getStaff(id: string): Promise<ApiStaffWithAccount> {
  const { data } = await api.get<ApiStaffWithAccount>(`/staff/${id}`);
  return data;
}

export interface CreateStaffInput {
  staffId: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  department?: string;
  pictureUrl?: string;
  accessLevels?: string[];
}

export async function createStaff(body: CreateStaffInput): Promise<ApiStaff> {
  const { data } = await api.post<ApiStaff>("/staff", body);
  return data;
}

export interface BulkStaffResult {
  total: number;
  created: number;
  updated: number;
}

export async function bulkStaff(body: CreateStaffInput[]): Promise<BulkStaffResult> {
  const { data } = await api.post<BulkStaffResult>("/staff/bulk", body);
  return data;
}

export interface UpdateStaffInput {
  name?: string;
  email?: string;
  phone?: string;
  designation?: string;
  department?: string;
  pictureUrl?: string;
  accessLevels?: string[];
}

export async function updateStaff(id: string, body: UpdateStaffInput): Promise<ApiStaff> {
  const { data } = await api.put<ApiStaff>(`/staff/${id}`, body);
  return data;
}

export async function deleteStaff(id: string): Promise<void> {
  await api.del(`/staff/${id}`);
}
