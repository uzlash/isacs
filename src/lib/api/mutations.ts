// ====================================================================
// Live write layer: one function per console mutation, mapping request +
// response to/from the API. The store's actions call these when live.
// ====================================================================

import { api } from "@/lib/api";
import {
  type ApiAsset,
  type ApiReport,
  type ApiVisitor,
  mapAsset,
  mapReport,
  mapVisitor,
} from "@/lib/api/resources";
import type { Asset, Incident, Visitor } from "@/lib/types";

// ---- visitors ----
export async function checkInVisitor(id: string): Promise<Visitor> {
  const { data } = await api.post<ApiVisitor>(`/visitors/${id}/checkin`);
  return mapVisitor(data);
}

// ---- ASRS reports ----
export interface CreateReportInput {
  source: "access-control" | "surveillance" | "assets" | "lockdown" | "manual";
  sourceRef?: string;
  description: string;
  imageUrls?: string[]; // max 10
}
export async function createReport(input: CreateReportInput): Promise<Incident> {
  const { data } = await api.post<ApiReport>("/reports", input);
  return mapReport(data);
}

export async function assignReport(id: string, investigatorId: string): Promise<Incident> {
  const { data } = await api.patch<ApiReport>(`/reports/${id}/assign`, { investigatorId });
  return mapReport(data);
}

export async function resolveReport(id: string, resolution: string): Promise<Incident> {
  const { data } = await api.patch<ApiReport>(`/reports/${id}/resolve`, { resolution });
  return mapReport(data);
}

export interface AccessCheckResult {
  granted: boolean;
  reason?: string;
  failedTries?: number;
  maxTries?: number;
  escalated?: boolean;
  holderType?: string;
  holderId?: string;
}

// ---- access control ----
export async function accessCheck(input: {
  cardNumber?: string;
  rfidTag?: string;
  qrCode?: string;
  nodeId: string;
}): Promise<AccessCheckResult> {
  const { data } = await api.post<AccessCheckResult>("/access/check", input);
  return data;
}

// ---- surveillance ----
export async function escalateCamera(id: string, description: string): Promise<void> {
  await api.post(`/cameras/${id}/escalate`, { description });
}

// ---- assets / protocols ----
export async function setAssetProtocol(id: string, active: boolean): Promise<Asset> {
  const { data } = await api.patch<ApiAsset>(`/assets/${id}/protocol/${active ? "activate" : "deactivate"}`);
  return mapAsset(data);
}

export async function reportAssetBreach(id: string, description: string): Promise<void> {
  await api.post(`/assets/${id}/protocol/breach`, { description });
}

// ---- appointments ----
export interface CreateAppointmentInput {
  hostStaffId: string;
  visitorId?: string;
  guestStaffId?: string;
  scheduledAt: string;
  endsAt: string;
  purpose?: string;
}
export async function createAppointment(input: CreateAppointmentInput): Promise<void> {
  await api.post("/appointments", input);
}

/** Cancel a scheduled appointment. 400 if not in `scheduled` status. */
export async function cancelAppointment(id: string, reason: string): Promise<void> {
  await api.patch(`/appointments/${id}/cancel`, { reason });
}

/** Postpone a scheduled appointment to a new slot. 409 on host double-booking. */
export async function postponeAppointment(
  id: string,
  scheduledAt: string,
  endsAt: string,
  reason: string
): Promise<void> {
  await api.patch(`/appointments/${id}/postpone`, { scheduledAt, endsAt, reason });
}

// ---- settings ----
export async function putSetting(key: string, value: unknown): Promise<void> {
  await api.put(`/settings/${key}`, { value });
}
