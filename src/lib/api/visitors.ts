// ====================================================================
// Visitors API — people who visit the facility (checked in at reception,
// booked into appointments, issued temporary access cards). See the
// ISACS_API_Reference "Visitors".
//   GET    /visitors          list (filters: search, placeOfWork, page, limit)
//   POST   /visitors          create (409 if email already exists)
//   GET    /visitors/:id      single (rich: appointments[] + cardAssignments[])
//   PUT    /visitors/:id      update
//   DELETE /visitors/:id      remove (409 if active card / upcoming appointment)
// Check-in (POST /visitors/:id/checkin) lives in mutations.ts as
// checkInVisitor — not duplicated here.
// ====================================================================

import { api } from "@/lib/api";
import { type ApiVisitor, mapVisitor } from "@/lib/api/resources";
import type { ApptStatus, CardType, Visitor } from "@/lib/types";

/**
 * Rich single-visitor response from GET /visitors/:id. Superset of the
 * minimal ApiVisitor in resources.ts — adds pictureUrl/timestamps plus the
 * visitor's appointments and card assignments.
 */
export interface ApiVisitorFull {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  placeOfWork: string | null;
  pictureUrl: string | null;
  checkedInAt: string | null;
  createdAt: string;
  updatedAt: string;
  appointments: {
    id: string;
    scheduledAt: string;
    endsAt: string;
    status: ApptStatus;
    purpose: string | null;
    host: {
      id: string;
      name: string;
      designation: string | null;
      department: string | null;
    };
  }[];
  cardAssignments: {
    id: string;
    assignedAt: string;
    revokedAt: string | null;
    accessNodeIds: string[];
    card: {
      id: string;
      cardNumber: string;
      rfidTag: string | null;
      qrCode: string | null;
      type: CardType;
    };
  }[];
}

export interface VisitorFilter {
  search?: string;
  placeOfWork?: string;
  page?: number;
  limit?: number;
}

function query(f?: VisitorFilter): string {
  if (!f) return "";
  const p = new URLSearchParams();
  if (f.search) p.set("search", f.search);
  if (f.placeOfWork) p.set("placeOfWork", f.placeOfWork);
  if (f.page !== undefined) p.set("page", String(f.page));
  if (f.limit !== undefined) p.set("limit", String(f.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listVisitors(filter?: VisitorFilter): Promise<Visitor[]> {
  const { data } = await api.get<ApiVisitor[]>(`/visitors${query(filter)}`);
  return data.map(mapVisitor);
}

export interface CreateVisitorInput {
  name: string;
  email?: string;
  phone?: string;
  designation?: string;
  placeOfWork?: string;
  pictureUrl?: string;
}

/**
 * Create a visitor. If the email already exists the API responds 409 and the
 * api layer throws ApiError (whose payload includes `data.existing`); that
 * error is left to propagate to the caller.
 */
export async function createVisitor(body: CreateVisitorInput): Promise<ApiVisitor> {
  const { data } = await api.post<ApiVisitor>("/visitors", body);
  return data;
}

export async function getVisitor(id: string): Promise<ApiVisitorFull> {
  const { data } = await api.get<ApiVisitorFull>(`/visitors/${id}`);
  return data;
}

export interface UpdateVisitorInput {
  name?: string;
  email?: string;
  phone?: string;
  designation?: string;
  placeOfWork?: string;
  pictureUrl?: string;
}

export async function updateVisitor(id: string, body: UpdateVisitorInput): Promise<ApiVisitor> {
  const { data } = await api.put<ApiVisitor>(`/visitors/${id}`, body);
  return data;
}

/**
 * Delete a visitor. Responds 409 (ApiError, left to propagate) if the visitor
 * has an active card assignment or an upcoming appointment.
 */
export async function deleteVisitor(id: string): Promise<void> {
  await api.del(`/visitors/${id}`);
}
