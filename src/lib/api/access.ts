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
// ====================================================================

import { api } from "@/lib/api";

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
