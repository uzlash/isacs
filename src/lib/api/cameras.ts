// ====================================================================
// Cameras API — the surveillance feeds and their snapshot/escalation
// endpoints. See ISACS_API_Reference "Cameras".
//   GET    /cameras            list (filters: location, isActive)
//   POST   /cameras            create
//   GET    /cameras/:id        single
//   PUT    /cameras/:id        update (all optional, incl. isActive)
//   DELETE /cameras/:id        remove
//   POST   /cameras/:id/escalate   raise an incident (202, no payload)
//   POST   /cameras/:id/snapshot   raw image/jpeg upload — see TODO below
//
// NOTE: an `escalateCamera` also lives in mutations.ts. The equivalent
// here is exported as `escalateCameraIncident` to avoid a duplicate-export
// collision at import sites; the two are otherwise identical.
// ====================================================================

import { api } from "@/lib/api";

export interface ApiCamera {
  id: string;
  name: string;
  rtspPath: string;
  adminDashboardPath: string | null;
  location: string;
  longitude: number | null;
  latitude: number | null;
  level: number;
  lastSnapshotUrl: string | null;
  lastSnapshotAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CameraFilter {
  location?: string;
  isActive?: boolean;
}

function query(f?: CameraFilter): string {
  if (!f) return "";
  const p = new URLSearchParams();
  if (f.location) p.set("location", f.location);
  if (f.isActive !== undefined) p.set("isActive", String(f.isActive));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listCameras(filter?: CameraFilter): Promise<ApiCamera[]> {
  const { data } = await api.get<ApiCamera[]>(`/cameras${query(filter)}`);
  return data;
}

export async function getCamera(id: string): Promise<ApiCamera> {
  const { data } = await api.get<ApiCamera>(`/cameras/${id}`);
  return data;
}

export interface CreateCameraInput {
  name: string;
  rtspPath: string;
  adminDashboardPath?: string;
  location: string;
  longitude?: number;
  latitude?: number;
  level?: number;
}

export async function createCamera(body: CreateCameraInput): Promise<ApiCamera> {
  const { data } = await api.post<ApiCamera>("/cameras", body);
  return data;
}

export interface UpdateCameraInput {
  name?: string;
  rtspPath?: string;
  adminDashboardPath?: string | null;
  location?: string;
  longitude?: number | null;
  latitude?: number | null;
  level?: number;
  isActive?: boolean;
}

export async function updateCamera(id: string, body: UpdateCameraInput): Promise<ApiCamera> {
  const { data } = await api.put<ApiCamera>(`/cameras/${id}`, body);
  return data;
}

export async function deleteCamera(id: string): Promise<void> {
  await api.del(`/cameras/${id}`);
}

export interface EscalateCameraInput {
  description: string;
  snapshotUrl?: string;
}

/**
 * Raise an incident from a camera (202 Accepted, no payload).
 * See also `escalateCamera` in mutations.ts — this is the identical twin,
 * renamed to avoid a duplicate-export collision.
 */
export async function escalateCameraIncident(id: string, body: EscalateCameraInput): Promise<void> {
  await api.post(`/cameras/${id}/escalate`, body);
}

// TODO: snapshot upload needs raw image/jpeg body — handle in a dedicated component
