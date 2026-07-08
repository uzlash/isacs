// ====================================================================
// BBIW (AI video intelligence) integration. See bbiw-integration.md.
// Camera sync + webhook are backend-invisible; these are the frontend
// touchpoints: SSO deep-link, detection filters, and the connection config.
//   GET  /bbiw/sso        → { url }         (super_admin, security_manager)
//   GET  /bbiw/filters    → filter settings (super_admin, security_manager)
//   PUT  /bbiw/filters
//   GET  /settings/bbiw   → connection config (super_admin)
//   PUT  /settings/bbiw
//   POST /bbiw/sync       → push cameras to BBIW (super_admin)
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
] as const;

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
  raw: string;
}

/** Parse "BBIW: weapon | Camera: Parking Lot A | Severity: critical | Node: n1". */
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
  }
  return out;
}

/** True if the URL looks like a video clip (BBIW serves MP4 clips). */
export function isClipUrl(url: string | undefined): boolean {
  return !!url && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}
