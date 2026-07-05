// ====================================================================
// Assets API — tracked people/vehicles, their GPS trackers, and the
// security protocol (speed limit + geofence) rules engine.
// See ISACS_API_Reference "Assets".
//   GET    /assets                       list (filters: type, isVehicle)
//   POST   /assets                       create
//   GET    /assets/:id                   single
//   PUT    /assets/:id                   update (all optional)
//   DELETE /assets/:id                   remove (409 if protocol active)
//   POST   /assets/:id/tracker           assign a GPS tracker
//   DELETE /assets/:id/tracker           revoke the tracker
//   PATCH  /assets/:id/protocol          set rules (does NOT activate)
//   PATCH  /assets/:id/protocol/activate    turn the protocol on
//   PATCH  /assets/:id/protocol/deactivate  turn the protocol off
//   POST   /assets/:id/protocol/breach   report a breach (202, no payload)
//
// NOTE: mutations.ts already carries a `setAssetProtocol(id, active)` that
// hits activate/deactivate, and a `reportAssetBreach`. This module is a
// parallel, richer client — its functions are named `activateAssetProtocol`,
// `deactivateAssetProtocol` and `reportAssetProtocolBreach` to stay explicit
// and non-colliding at import sites.
// ====================================================================

import { api } from "@/lib/api";
import { type ApiAsset, mapAsset } from "@/lib/api/resources";
import type { Asset } from "@/lib/types";

export interface LocationBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** A GPS tracker record as returned by the tracker assign/revoke endpoints. */
export interface AssetTracker {
  id: string;
  assetId: string;
  trackerSerial: string;
  assignedAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetFilter {
  type?: string;
  isVehicle?: boolean;
}

function query(f?: AssetFilter): string {
  if (!f) return "";
  const p = new URLSearchParams();
  if (f.type) p.set("type", f.type);
  if (f.isVehicle !== undefined) p.set("isVehicle", String(f.isVehicle));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listAssets(filter?: AssetFilter): Promise<Asset[]> {
  const { data } = await api.get<ApiAsset[]>(`/assets${query(filter)}`);
  return data.map(mapAsset);
}

export async function getAsset(id: string): Promise<Asset> {
  const { data } = await api.get<ApiAsset>(`/assets/${id}`);
  return mapAsset(data);
}

export interface CreateAssetInput {
  name: string;
  type?: string;
  isVehicle?: boolean;
  plateNumber?: string;
}

export async function createAsset(body: CreateAssetInput): Promise<Asset> {
  const { data } = await api.post<ApiAsset>("/assets", body);
  return mapAsset(data);
}

export interface UpdateAssetInput {
  name?: string;
  type?: string;
  isVehicle?: boolean;
  plateNumber?: string;
}

export async function updateAsset(id: string, body: UpdateAssetInput): Promise<Asset> {
  const { data } = await api.put<ApiAsset>(`/assets/${id}`, body);
  return mapAsset(data);
}

/** Remove an asset. Propagates 409 if the security protocol is still active. */
export async function deleteAsset(id: string): Promise<void> {
  await api.del(`/assets/${id}`);
}

/** Assign a GPS tracker to the asset — returns the new tracker record. */
export async function assignTracker(id: string, trackerSerial: string): Promise<AssetTracker> {
  const { data } = await api.post<AssetTracker>(`/assets/${id}/tracker`, { trackerSerial });
  return data;
}

/** Revoke the asset's tracker — returns the revoked tracker (with revokedAt set). */
export async function revokeTracker(id: string): Promise<AssetTracker> {
  const { data } = await api.del<AssetTracker>(`/assets/${id}/tracker`);
  return data;
}

export interface ProtocolRulesInput {
  speedLimitKph?: number | null;
  locationBounds?: LocationBounds | null;
}

/** Set the protocol rules (speed limit / geofence). Does NOT activate it. */
export async function setAssetProtocolRules(id: string, body: ProtocolRulesInput): Promise<Asset> {
  const { data } = await api.patch<ApiAsset>(`/assets/${id}/protocol`, body);
  return mapAsset(data);
}

export async function activateAssetProtocol(id: string): Promise<Asset> {
  const { data } = await api.patch<ApiAsset>(`/assets/${id}/protocol/activate`);
  return mapAsset(data);
}

export async function deactivateAssetProtocol(id: string): Promise<Asset> {
  const { data } = await api.patch<ApiAsset>(`/assets/${id}/protocol/deactivate`);
  return mapAsset(data);
}

/** Report a protocol breach (202 Accepted, no payload). */
export async function reportAssetProtocolBreach(id: string, description: string): Promise<void> {
  await api.post(`/assets/${id}/protocol/breach`, { description });
}
