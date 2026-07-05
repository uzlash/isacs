// Lockdown API. See map_and_lockdown_reference "Lockdown System".
import { api } from "@/lib/api";

export interface Lockdown {
  id: string;
  nodeIds: string[] | null; // null = whole facility
  description: string;
  status: "active" | "lifted";
  createdBy: string;
  creator?: { id: string; email: string };
  liftedBy?: string | null;
  lifter?: { id: string; email: string } | null;
  liftedAt?: string | null;
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listLockdowns(status?: "active" | "lifted"): Promise<Lockdown[]> {
  const { data } = await api.get<Lockdown[]>(`/lockdowns${status ? `?status=${status}` : ""}`);
  return data;
}

export async function getActiveLockdown(): Promise<Lockdown | null> {
  const list = await listLockdowns("active");
  return list[0] ?? null;
}

/** Omit nodeIds (or pass empty) for a facility-wide lockdown. */
export async function initiateLockdown(description: string, nodeIds?: string[]): Promise<Lockdown> {
  const body: Record<string, unknown> = { description };
  if (nodeIds && nodeIds.length) body.nodeIds = nodeIds;
  const { data } = await api.post<Lockdown>("/lockdowns", body);
  return data;
}

export async function liftLockdown(id: string, resolution: string): Promise<Lockdown> {
  const { data } = await api.post<Lockdown>(`/lockdowns/${id}/lift`, { resolution });
  return data;
}
