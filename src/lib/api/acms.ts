// ====================================================================
// ACM (Access Control Module) API — the physical IoT reader devices
// mounted at access nodes. See ISACS_API_Reference "ACMs".
//   GET    /acms            list (filters: isOnline, isActive, nodeId)
//   POST   /acms            register (returns deviceSecret ONCE)
//   GET    /acms/:id        single
//   PUT    /acms/:id        update name / isActive
//   DELETE /acms/:id        remove (revokes RabbitMQ user)
//   POST   /acms/:id/rotate-secret  new deviceSecret (shown once)
// ====================================================================

import { api } from "@/lib/api";

export interface Acm {
  id: string;
  nodeId: string;
  serialNumber: string;
  name: string;
  isActive: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  lastScanAt: string | null;
  firmwareVersion: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  node?: { id: string; name: string; location: string | null } | null;
}

/** Registration response — includes the one-time secret + mqtt username. */
export interface AcmRegistration {
  id: string;
  nodeId: string;
  serialNumber: string;
  name: string;
  isActive: boolean;
  isOnline: boolean;
  mqttUsername: string;
  deviceSecret: string; // 64-char hex — shown once only
}

export interface AcmFilter {
  isOnline?: boolean;
  isActive?: boolean;
  nodeId?: string;
}

function query(f?: AcmFilter): string {
  if (!f) return "";
  const p = new URLSearchParams();
  if (f.isOnline !== undefined) p.set("isOnline", String(f.isOnline));
  if (f.isActive !== undefined) p.set("isActive", String(f.isActive));
  if (f.nodeId) p.set("nodeId", f.nodeId);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listAcms(filter?: AcmFilter): Promise<Acm[]> {
  const { data } = await api.get<Acm[]>(`/acms${query(filter)}`);
  return data;
}

export async function getAcm(id: string): Promise<Acm> {
  const { data } = await api.get<Acm>(`/acms/${id}`);
  return data;
}

export interface CreateAcmInput {
  nodeId: string;
  serialNumber: string;
  name: string;
}

export async function createAcm(body: CreateAcmInput): Promise<AcmRegistration> {
  const { data } = await api.post<AcmRegistration>("/acms", body);
  return data;
}

export interface UpdateAcmInput {
  name?: string;
  isActive?: boolean;
}

export async function updateAcm(id: string, body: UpdateAcmInput): Promise<Acm> {
  const { data } = await api.put<Acm>(`/acms/${id}`, body);
  return data;
}

export async function deleteAcm(id: string): Promise<void> {
  await api.del(`/acms/${id}`);
}

/** Rotate the device secret — returns the new secret (shown once only). */
export async function rotateAcmSecret(id: string): Promise<{ deviceSecret: string }> {
  const { data } = await api.post<{ deviceSecret: string }>(`/acms/${id}/rotate-secret`, {});
  return data;
}
