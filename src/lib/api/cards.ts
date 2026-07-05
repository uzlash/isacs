// ====================================================================
// Access Cards CRUD. See ISACS_API_Reference "Access Cards".
//   GET    /cards            list (filters: type, isActive)
//   POST   /cards            create
//   GET    /cards/:id        single (with active cardAssignments)
//   PATCH  /cards/:id/deactivate
//   DELETE /cards/:id        (409 if active assignment — revoke first)
// Card↔holder↔node assignment lives in access.ts (/access/assign etc.).
// ====================================================================

import { api } from "@/lib/api";
import { mapCard, type ApiCard } from "@/lib/api/resources";
import type { AccessCard, CardType } from "@/lib/types";

export interface CardFilter {
  type?: CardType;
  isActive?: boolean;
}

function query(f?: CardFilter): string {
  if (!f) return "";
  const p = new URLSearchParams();
  if (f.type) p.set("type", f.type);
  if (f.isActive !== undefined) p.set("isActive", String(f.isActive));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listCards(filter?: CardFilter): Promise<AccessCard[]> {
  const { data } = await api.get<ApiCard[]>(`/cards${query(filter)}`);
  return data.map(mapCard);
}

export interface CreateCardInput {
  cardNumber: string;
  rfidTag?: string;
  qrCode?: string;
  type: CardType;
}

export async function createCard(body: CreateCardInput): Promise<AccessCard> {
  const { data } = await api.post<ApiCard>("/cards", body);
  return mapCard(data);
}

/** Full card incl. active assignments (raw — the list view uses the mapped one). */
export async function getCard(id: string): Promise<ApiCard> {
  const { data } = await api.get<ApiCard>(`/cards/${id}`);
  return data;
}

/** Deactivate — denied at all checkpoints immediately, even if assigned. */
export async function deactivateCard(id: string): Promise<AccessCard> {
  const { data } = await api.patch<ApiCard>(`/cards/${id}/deactivate`);
  return mapCard(data);
}

/** Delete — 409 if the card has an active assignment (revoke it first). */
export async function deleteCard(id: string): Promise<void> {
  await api.del(`/cards/${id}`);
}
