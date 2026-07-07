// ====================================================================
// Access Control — card ↔ holder ↔ node assignment. See ISACS_API_Reference
// "Access Control". This is the PHYSICAL card assignment that drives
// /access/check and ACM decisions (distinct from a login account's
// assignedNodeIds, which is personnel posting — see users.ts).
//   POST   /access/assign
//   POST   /access/revoke
//   GET    /access/holders/:type/:id/nodes   (explicit + implied)
//   PUT    /access/holders/:type/:id/nodes    (replace list)
//   DELETE /access/holders/:type/:id/nodes/:nodeId
//   POST   /access/check                       (also in mutations.ts)
//   GET    /access/logs                        (scan history, paginated)
// ====================================================================

import { api, type Pagination } from "@/lib/api";

export type HolderType = "staff" | "visitor" | "asset";

export interface CardAssignment {
  id: string;
  cardId: string;
  holderType: HolderType;
  holderId: string;
  assignedAt: string;
  revokedAt: string | null;
  accessNodeIds: string[];
  failedTries?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

/** A node in an access list (explicit grant or implied ancestor). */
export interface AccessNodeRef {
  id: string;
  name: string;
  location: string | null;
  parentId: string | null;
}

export interface AssignInput {
  cardId: string;
  holderType: HolderType;
  holderId: string;
  accessNodeIds: string[]; // min 1
}

/** Assign a card to a holder and grant one or more nodes. */
export async function assignCard(body: AssignInput): Promise<CardAssignment> {
  const { data } = await api.post<CardAssignment>("/access/assign", body);
  return data;
}

/** Revoke the active assignment for a card (strips all access). */
export async function revokeCard(cardId: string): Promise<CardAssignment> {
  const { data } = await api.post<CardAssignment>("/access/revoke", { cardId });
  return data;
}

/** A holder's node access, split into directly-granted and ancestor-implied. */
export interface HolderNodes {
  explicit: AccessNodeRef[];
  implied: AccessNodeRef[];
}

export async function getHolderNodes(holderType: HolderType, holderId: string): Promise<HolderNodes> {
  const { data } = await api.get<HolderNodes>(`/access/holders/${holderType}/${holderId}/nodes`);
  return data;
}

/** Replace a holder's entire node access list. */
export async function setHolderNodes(
  holderType: HolderType,
  holderId: string,
  accessNodeIds: string[]
): Promise<CardAssignment> {
  const { data } = await api.put<CardAssignment>(`/access/holders/${holderType}/${holderId}/nodes`, {
    accessNodeIds,
  });
  return data;
}

/** Remove a single node from a holder's access list (400 if it's the last). */
export async function removeHolderNode(
  holderType: HolderType,
  holderId: string,
  nodeId: string
): Promise<CardAssignment> {
  const { data } = await api.del<CardAssignment>(`/access/holders/${holderType}/${holderId}/nodes/${nodeId}`);
  return data;
}

/**
 * One entry from a card scan/check — granted or denied.
 * cardId/holderType/holderId are null when the card itself wasn't recognized
 * (denial before a CardAssignment lookup was possible). acmId/node are only
 * populated when source is "acm" (a physical device scan tied to a node);
 * HTTP access-control checks always have nodeId but no acmId. reason is null
 * when granted. card/node are null if the FK is null or the row was deleted.
 */
export interface AccessLogEntry {
  id: string;
  cardId: string | null;
  holderType: HolderType | null;
  holderId: string | null;
  nodeId: string;
  granted: boolean;
  reason: string | null;
  source: "acm" | "http";
  acmId: string | null;
  createdAt: string;
  updatedAt: string;
  card: { id: string; cardNumber: string; rfidTag: string | null; qrCode: string | null; type: string } | null;
  node: { id: string; name: string; location: string | null } | null;
}

export interface AccessLogFilter {
  holderType?: HolderType;
  holderId?: string;
  cardId?: string;
  nodeId?: string;
  granted?: boolean;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

function logQuery(f?: AccessLogFilter): string {
  if (!f) return "";
  const p = new URLSearchParams();
  if (f.holderType) p.set("holderType", f.holderType);
  if (f.holderId) p.set("holderId", f.holderId);
  if (f.cardId) p.set("cardId", f.cardId);
  if (f.nodeId) p.set("nodeId", f.nodeId);
  if (f.granted !== undefined) p.set("granted", String(f.granted));
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.page !== undefined) p.set("page", String(f.page));
  if (f.limit !== undefined) p.set("limit", String(f.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function getAccessLogs(
  filter?: AccessLogFilter
): Promise<{ items: AccessLogEntry[]; pagination?: Pagination }> {
  const res = await api.get<AccessLogEntry[]>(`/access/logs${logQuery(filter)}`);
  return { items: res.data, pagination: res.pagination };
}
