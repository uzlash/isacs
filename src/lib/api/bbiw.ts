// ====================================================================
// BBIW (AI video intelligence) integration. See bbiw-integration.md.
// Camera sync + webhook are backend-invisible; these are the frontend
// touchpoints: SSO deep-link, detection filters, the connection config,
// the camera rules lookup, and watchlist (POI/VOI) management.
//   GET  /bbiw/sso              → { url }         (super_admin, security_manager)
//   GET  /bbiw/filters          → filter settings (super_admin, security_manager)
//   PUT  /bbiw/filters
//   GET  /settings/bbiw         → connection config (super_admin)
//   PUT  /settings/bbiw
//   POST /bbiw/sync             → push cameras to BBIW (super_admin)
//   GET  /bbiw/cameras/:id/rules → configured detection rules (surveillance:read)
//   GET|POST /bbiw/watchlist/poi[/:id[/photos[/:index]]]  (super_admin, security_manager)
//   GET|POST /bbiw/watchlist/voi[/:id[/photos[/:index]]]  (super_admin, security_manager)
// ====================================================================

import { api } from "@/lib/api";

export type BbiwSeverity = "low" | "medium" | "high" | "critical";

// Rule types BBIW ships with (free-text also allowed for future rules).
export const BBIW_RULE_TYPES = [
  "weapon",
  "fight",
  "loitering",
  "person_detected",
  "running",
  "zone_motion",
  "abandoned_object",
  "camera_inactivity",
  "person_count",
  "poi_detected",
  "voi_detected",
] as const;

// ---- camera rules lookup (July 2026 update — resolved by ISACS camera UUID) ----
export interface BbiwCameraRule {
  id: number;
  camera_id: number;
  type: string;
  config: Record<string, unknown>;
  mqtt_topic: string;
  cooldown_s: number;
  enabled: boolean;
}

/** Read-only "what's being monitored" lookup for one camera's configured BBIW rules. */
export async function getBbiwCameraRules(cameraId: string): Promise<BbiwCameraRule[]> {
  const { data } = await api.get<BbiwCameraRule[]>(`/bbiw/cameras/${cameraId}/rules`);
  return data;
}

// ---- SSO deep-link ----
/** Returns a one-time SSO URL that logs the user into the BBIW dashboard. */
export async function getBbiwSsoUrl(): Promise<string> {
  const { data } = await api.get<{ url: string }>("/bbiw/sso");
  return data.url;
}

// ---- detection filters ----
export interface BbiwFilters {
  minSeverity: BbiwSeverity | null; // null = all severities
  allowedRuleTypes: string[] | null; // null = all rule types
}

export async function getBbiwFilters(): Promise<BbiwFilters> {
  const { data } = await api.get<BbiwFilters>("/bbiw/filters");
  return data;
}

export async function putBbiwFilters(filters: BbiwFilters): Promise<BbiwFilters> {
  const { data } = await api.put<BbiwFilters>("/bbiw/filters", filters);
  return data;
}

// ---- connection config (super_admin) ----
export interface BbiwConfig {
  host: string;
  apiToken: string;
  webhookSecret: string;
}

/** Read the BBIW connection settings. The stored apiToken may be masked. */
export async function getBbiwConfig(): Promise<Partial<BbiwConfig> | null> {
  const { data } = await api.get<{ value?: Partial<BbiwConfig> } | Partial<BbiwConfig>>("/settings/bbiw");
  // /settings/:key returns a setting object { key, value, ... }; unwrap value.
  const value = (data as { value?: Partial<BbiwConfig> })?.value ?? (data as Partial<BbiwConfig>);
  return value ?? null;
}

export async function putBbiwConfig(config: BbiwConfig): Promise<void> {
  await api.put("/settings/bbiw", { value: config });
}

// ---- camera sync (super_admin) ----
export interface BbiwSyncResult {
  synced: number;
  bbiw?: unknown;
}

/** Push all local cameras to BBIW's bulk endpoint. Returns the synced count and the server's status message. */
export async function syncBbiwCameras(): Promise<{ result: BbiwSyncResult; message: string }> {
  const { data, message } = await api.post<BbiwSyncResult>("/bbiw/sync");
  return { result: data, message };
}

// ---- watchlist — Persons & Vehicles of Interest (July 2026 update) ----
// Roles: super_admin, security_manager. Matches are automatic across every
// camera/node once an entry exists — there's no separate "apply" step.

export type VoiColor =
  | "white" | "silver" | "gray" | "black" | "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "brown";
export type VoiVehicleType = "car" | "truck" | "motorcycle" | "bus" | "bicycle";
export const VOI_COLORS: VoiColor[] = ["white", "silver", "gray", "black", "red", "orange", "yellow", "green", "blue", "purple", "brown"];
export const VOI_VEHICLE_TYPES: VoiVehicleType[] = ["car", "truck", "motorcycle", "bus", "bicycle"];

export interface PoiEntry {
  id: string;
  name: string;
  dangerous: boolean;
  photo_count: number;
  added_at: string;
}

export interface VoiEntry {
  id: string;
  name: string;
  plate_number?: string;
  color?: VoiColor;
  vehicle_type?: VoiVehicleType;
  photo_count: number;
  added_at: string;
}

/** Same-origin path for one reference photo — use directly as an <img src>. */
export function poiPhotoUrl(id: string, index: number): string {
  return `/api/bbiw/watchlist/poi/${id}/photos/${index}`;
}
export function voiPhotoUrl(id: string, index: number): string {
  return `/api/bbiw/watchlist/voi/${id}/photos/${index}`;
}

// ---- Persons of Interest ----
export async function listPois(): Promise<PoiEntry[]> {
  const { data } = await api.get<PoiEntry[]>("/bbiw/watchlist/poi");
  return data;
}

export async function addPoi(input: { name: string; dangerous?: boolean; photo: File }): Promise<PoiEntry> {
  const form = new FormData();
  form.append("name", input.name);
  form.append("dangerous", String(!!input.dangerous));
  form.append("photo", input.photo);
  const { data } = await api.upload<PoiEntry>("/bbiw/watchlist/poi", form);
  return data;
}

export async function deletePoi(id: string): Promise<void> {
  await api.del(`/bbiw/watchlist/poi/${id}`);
}

export async function addPoiPhoto(id: string, photo: File): Promise<void> {
  const form = new FormData();
  form.append("photo", photo);
  await api.upload(`/bbiw/watchlist/poi/${id}/photos`, form);
}

/** A person must keep at least one reference photo — the API rejects removing the last one. */
export async function deletePoiPhoto(id: string, index: number): Promise<void> {
  await api.del(`/bbiw/watchlist/poi/${id}/photos/${index}`);
}

// ---- Vehicles of Interest ----
export async function listVois(): Promise<VoiEntry[]> {
  const { data } = await api.get<VoiEntry[]>("/bbiw/watchlist/voi");
  return data;
}

export async function addVoi(input: {
  name: string;
  plate_number?: string;
  color?: VoiColor;
  vehicle_type?: VoiVehicleType;
  photo?: File;
}): Promise<VoiEntry> {
  const form = new FormData();
  form.append("name", input.name);
  if (input.plate_number) form.append("plate_number", input.plate_number);
  if (input.color) form.append("color", input.color);
  if (input.vehicle_type) form.append("vehicle_type", input.vehicle_type);
  if (input.photo) form.append("photo", input.photo);
  const { data } = await api.upload<VoiEntry>("/bbiw/watchlist/voi", form);
  return data;
}

export async function deleteVoi(id: string): Promise<void> {
  await api.del(`/bbiw/watchlist/voi/${id}`);
}

export async function addVoiPhoto(id: string, photo: File): Promise<void> {
  const form = new FormData();
  form.append("photo", photo);
  await api.upload(`/bbiw/watchlist/voi/${id}/photos`, form);
}

export async function deleteVoiPhoto(id: string, index: number): Promise<void> {
  await api.del(`/bbiw/watchlist/voi/${id}/photos/${index}`);
}

// ---- helpers ----
/** A BBIW detection report has a structured "BBIW: … | Camera: … | …" desc. */
export function isBbiwReport(description: string): boolean {
  return /^BBIW:/i.test(description.trim());
}

export interface ParsedBbiwDescription {
  rule?: string;
  camera?: string;
  severity?: string;
  node?: string;
  // watchlist-match fields (poi_detected / voi_detected only)
  match?: string;
  dangerous?: boolean;
  confidence?: string;
  vehicleType?: string;
  signals?: string;
  raw: string;
}

/**
 * Parse "BBIW: weapon | Camera: Parking Lot A | Severity: critical | Node: n1", plus the
 * watchlist-match fields poi_detected/voi_detected append, e.g.
 * "BBIW: poi_detected | Camera: Main Gate | Severity: high | Node: n1 | Match: Jane Smith | DANGEROUS | Confidence: 91%".
 */
export function parseBbiwDescription(description: string): ParsedBbiwDescription {
  const out: ParsedBbiwDescription = { raw: description };
  for (const part of description.split("|").map((s) => s.trim())) {
    const bbiw = /^BBIW:\s*(.+)$/i.exec(part);
    if (bbiw) { out.rule = bbiw[1].trim(); continue; }
    const cam = /^Camera:\s*(.+)$/i.exec(part);
    if (cam) { out.camera = cam[1].trim(); continue; }
    const sev = /^Severity:\s*(.+)$/i.exec(part);
    if (sev) { out.severity = sev[1].trim(); continue; }
    const node = /^Node:\s*(.+)$/i.exec(part);
    if (node) { out.node = node[1].trim(); continue; }
    const match = /^Match:\s*(.+)$/i.exec(part);
    if (match) { out.match = match[1].trim(); continue; }
    if (/^DANGEROUS$/i.test(part)) { out.dangerous = true; continue; }
    const confidence = /^Confidence:\s*(.+)$/i.exec(part);
    if (confidence) { out.confidence = confidence[1].trim(); continue; }
    const type = /^Type:\s*(.+)$/i.exec(part);
    if (type) { out.vehicleType = type[1].trim(); continue; }
    const signals = /^Signals:\s*(.+)$/i.exec(part);
    if (signals) { out.signals = signals[1].trim(); continue; }
  }
  return out;
}

/** True if the URL looks like a video clip (BBIW serves MP4 clips). */
export function isClipUrl(url: string | undefined): boolean {
  return !!url && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}
