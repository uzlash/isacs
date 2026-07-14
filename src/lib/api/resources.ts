// ====================================================================
// Live read layer: fetch each ISACS resource and map the API's response
// shape onto the console's existing view-models (src/lib/types.ts), so
// the views render unchanged whether data is mock or live.
//
// Field renames and derivations are localized here. A few fields the API
// doesn't expose are marked TODO and filled best-effort / after probing
// against real data (card holder+nodes, incident severity, settings keys).
// ====================================================================

import { api } from "@/lib/api";
import type {
  AccessCard,
  AccessNode,
  Appointment,
  ApptStatus,
  Asset,
  Camera,
  CardType,
  Incident,
  IncidentSource,
  Role,
  Settings,
  Severity,
  Staff,
  User,
  Visitor,
} from "@/lib/types";

const ts = (s?: string | null): number | null => (s ? Date.parse(s) : null);

// ---------------- API response shapes (subset we consume) ----------------
interface ApiStaff {
  id: string;
  staffId: string;
  name: string;
  email: string;
  phone?: string | null;
  designation?: string | null;
  department?: string | null;
  pictureUrl?: string | null;
}
interface ApiUser {
  id: string;
  email: string;
  role: Role;
  staffId: string | null;
  assignedNodeIds?: string[] | null;
  isActive: boolean;
  lastLoginAt?: string | null;
}
export interface ApiVisitor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  placeOfWork?: string | null;
  pictureUrl?: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
}
interface ApiAppointment {
  id: string;
  scheduledAt: string;
  endsAt: string;
  purpose?: string | null;
  status: ApptStatus;
  host?: { id: string; name: string } | null;
  visitor?: { id: string; name: string } | null;
  requestedAccessNodeIds?: string[];
}
interface ApiNode {
  id: string;
  name: string;
  location?: string | null;
  longitude?: number | null;
  latitude?: number | null;
  level: number;
  parentId: string | null;
  maxFailedTries: number;
}
export interface ApiCardAssignment {
  id: string;
  holderType: "staff" | "visitor" | "asset";
  holderId: string;
  revokedAt?: string | null;
  accessNodeIds?: string[];
}
export interface ApiCard {
  id: string;
  cardNumber: string;
  rfidTag?: string | null;
  qrCode?: string | null;
  type: CardType;
  isActive: boolean;
  /** present only on GET /cards/:id — active (non-revoked) assignments */
  cardAssignments?: ApiCardAssignment[];
}
interface ApiCamera {
  id: string;
  name: string;
  location: string;
  level: number;
  isActive: boolean;
  longitude?: number | null;
  latitude?: number | null;
  lastSnapshotAt?: string | null;
  lastSnapshotUrl?: string | null;
}
export interface ApiAsset {
  id: string;
  name: string;
  type?: string | null;
  isVehicle: boolean;
  plateNumber?: string | null;
  securityProtocol?: {
    active: boolean;
    speedLimitKph?: number | null;
    locationBounds?: unknown | null;
  } | null;
  AssetTracker?: { trackerSerial: string } | null;
}
export interface ApiReportAssignment {
  id: string;
  reportId: string;
  userId: string;
  assignedBy: string;
  assignedAt: string;
  unassignedAt: string | null;
  user?: { id: string; email: string };
}
export interface ApiReport {
  id: string;
  source: "access-control" | "surveillance" | "assets" | "manual" | "lockdown";
  sourceRef?: string | null;
  description: string;
  status: "open" | "investigating" | "resolved";
  investigatorId?: string | null;
  /** active (non-unassigned) roster entries besides the lead investigator */
  assignments?: ApiReportAssignment[];
  imageUrls?: string[];
  resolution?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  investigator?: { id: string; email: string } | null;
}
interface ApiSetting {
  key: string;
  value: unknown;
}

// ---------------- mappers ----------------
const mapStaff = (s: ApiStaff): Staff => ({
  id: s.id,
  staffId: s.staffId,
  name: s.name,
  dept: s.department ?? "",
  desig: s.designation ?? "",
  phone: s.phone ?? "",
  email: s.email,
  pictureUrl: s.pictureUrl ?? null,
});

export const mapVisitor = (v: ApiVisitor): Visitor => ({
  id: v.id,
  name: v.name,
  org: v.placeOfWork ?? "",
  desig: v.designation ?? "",
  email: v.email ?? "",
  phone: v.phone ?? "",
  pictureUrl: v.pictureUrl ?? null,
  checkedIn: ts(v.checkedInAt),
  checkedOut: ts(v.checkedOutAt),
});

const mapAppointment = (a: ApiAppointment): Appointment => ({
  id: a.id,
  visitor: a.visitor?.name ?? "—",
  visitorId: a.visitor?.id ?? "",
  host: a.host?.name ?? "—",
  start: ts(a.scheduledAt) ?? 0,
  end: ts(a.endsAt) ?? 0,
  status: a.status,
  purpose: a.purpose ?? "",
  requestedAccessNodeIds: a.requestedAccessNodeIds ?? [],
});

const mapNode = (n: ApiNode): AccessNode => ({
  id: n.id,
  name: n.name,
  parent: n.parentId,
  level: n.level ?? 0,
  max: n.maxFailedTries ?? 3,
  loc: n.location ?? "",
  longitude: n.longitude ?? null,
  latitude: n.latitude ?? null,
});

/** Refetch access nodes (used after creating a node). */
export async function fetchNodes(): Promise<AccessNode[]> {
  const { data } = await api.get<ApiNode[]>("/nodes");
  return data.map(mapNode);
}

/** Resolve a holderId to a display name across staff/visitor/asset lists. */
export type HolderResolver = (holderType: string, holderId: string) => string | undefined;

export const mapCard = (c: ApiCard, resolveHolder?: HolderResolver): AccessCard => {
  const active = (c.cardAssignments ?? []).find((a) => !a.revokedAt);
  const holder = active
    ? resolveHolder?.(active.holderType, active.holderId) || `${active.holderType} ${active.holderId.slice(0, 8)}`
    : "—";
  return {
    id: c.id,
    num: c.cardNumber,
    rfid: c.rfidTag ?? null,
    qr: c.qrCode ?? null,
    type: c.type,
    active: c.isActive,
    holder,
    holderType: active?.holderType ?? null,
    holderId: active?.holderId ?? null,
    nodes: active?.accessNodeIds ?? [],
  };
};

const mapCamera = (c: ApiCamera): Camera => ({
  id: c.id,
  name: c.name,
  loc: c.location,
  level: c.level ?? 0,
  active: c.isActive,
  snap: ts(c.lastSnapshotAt) ?? 0,
  snapUrl: c.lastSnapshotUrl ?? null,
  lat: c.latitude ?? null,
  lng: c.longitude ?? null,
});

export const mapAsset = (a: ApiAsset): Asset => ({
  id: a.id,
  name: a.name,
  type: a.type ?? "",
  vehicle: a.isVehicle,
  plate: a.plateNumber ?? null,
  tracker: a.AssetTracker?.trackerSerial ?? null,
  protoActive: a.securityProtocol?.active ?? false,
  speed: a.securityProtocol?.speedLimitKph ?? null,
  geo: !!a.securityProtocol?.locationBounds,
});

// Severity isn't in the API — derive a consistent value from the source.
// A lockdown-originated report is inherently critical: it exists because a
// facility (or zone) is actively locked down.
const SEV_BY_SOURCE: Record<ApiReport["source"], Severity> = {
  "access-control": "critical",
  assets: "high",
  surveillance: "medium",
  manual: "low",
  lockdown: "critical",
};
const SOURCE_MAP: Record<ApiReport["source"], IncidentSource> = {
  "access-control": "access",
  surveillance: "surveillance",
  assets: "assets",
  manual: "manual",
  lockdown: "lockdown",
};

export const mapReport = (r: ApiReport): Incident => {
  const created = ts(r.createdAt) ?? 0;
  const resolvedAt = ts(r.resolvedAt) ?? undefined;
  // Synthesize a lifecycle timeline from the timestamps the API does provide.
  const log = [{ t: created, s: "Report created" }];
  if (r.investigatorId && r.status !== "open") {
    log.push({ t: ts(r.updatedAt) ?? created, s: "Assigned to investigator" });
  }
  if (resolvedAt) log.push({ t: resolvedAt, s: "Resolved" });
  const assignments = (r.assignments ?? [])
    .filter((a) => a.unassignedAt == null)
    .map((a) => ({
      id: a.id,
      userId: a.userId,
      name: a.user?.email ?? a.userId,
      assignedAt: ts(a.assignedAt) ?? created,
    }));
  return {
    id: r.id,
    source: SOURCE_MAP[r.source] ?? "manual",
    sev: SEV_BY_SOURCE[r.source] ?? "low",
    status: r.status,
    desc: r.description,
    node: r.sourceRef ?? "—",
    investigator: r.investigator?.email ?? (r.investigatorId ? "Assigned" : null),
    investigatorId: r.investigatorId ?? null,
    created,
    images: r.imageUrls?.length ?? 0,
    imageUrls: r.imageUrls ?? [],
    sourceRef: r.sourceRef ?? null,
    assignments,
    resolution: r.resolution ?? undefined,
    resolvedAt,
    log,
  };
};

/** Refetch all incident reports (used after a server-side auto-escalation). */
export async function fetchReports(): Promise<Incident[]> {
  const { data } = await api.get<ApiReport[]>("/reports?limit=100");
  return data.map(mapReport);
}

/** Refetch appointments (used after scheduling). */
export async function fetchAppointments(): Promise<Appointment[]> {
  const { data } = await api.get<ApiAppointment[]>("/appointments?limit=100");
  return data.map(mapAppointment);
}

/** Refetch lists after CRUD in their respective module pages. */
export async function fetchStaff(): Promise<Staff[]> {
  const { data } = await api.get<ApiStaff[]>("/staff?limit=100");
  return data.map(mapStaff);
}
export async function fetchVisitors(): Promise<Visitor[]> {
  const { data } = await api.get<ApiVisitor[]>("/visitors?limit=100");
  return data.map(mapVisitor);
}
export async function fetchCameras(): Promise<Camera[]> {
  const { data } = await api.get<ApiCamera[]>("/cameras");
  return data.map(mapCamera);
}
export async function fetchAssets(): Promise<Asset[]> {
  const { data } = await api.get<ApiAsset[]>("/assets");
  return data.map(mapAsset);
}
// The /cards LIST returns no assignment data — holder + nodes live on each
// card's detail (GET /cards/:id → cardAssignments). So we fetch details in
// parallel and enrich. `resolveHolder` maps a holderId to a display name
// using the store's staff/visitor/asset lists.
export async function fetchCards(resolveHolder?: HolderResolver): Promise<AccessCard[]> {
  const { data } = await api.get<ApiCard[]>("/cards");
  const detailed = await Promise.all(
    data.map(async (c) => {
      try {
        const { data: full } = await api.get<ApiCard>(`/cards/${c.id}`);
        return mapCard(full, resolveHolder);
      } catch {
        return mapCard(c, resolveHolder); // fall back to the thin list row
      }
    })
  );
  return detailed;
}

export function mapUser(u: ApiUser, staffById: Map<string, string>): User {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    staff: (u.staffId && staffById.get(u.staffId)) || "—",
    staffId: u.staffId,
    assignedNodeIds: u.assignedNodeIds ?? null,
    active: u.isActive,
    last: u.lastLoginAt ? relLabel(Date.parse(u.lastLoginAt)) : "never",
  };
}

/** Refetch users (used after user CRUD). Needs the staff map for name resolution. */
export async function fetchUsers(staffById: Map<string, string>): Promise<User[]> {
  const { data } = await api.get<ApiUser[]>("/users");
  return data.map((u) => mapUser(u, staffById));
}

// Settings keys are facility-defined; map defensively by fuzzy key match.
function mapSettings(list: ApiSetting[]): Settings {
  const defaults: Settings = { maxApptDuration: 120, advanceBooking: 30, staffToStaff: true, maxFailedTries: 3 };
  const find = (...needles: string[]) =>
    list.find((s) => needles.some((n) => s.key.toLowerCase().replace(/[._-]/g, "").includes(n)));
  const num = (v: unknown, d: number) => (typeof v === "number" ? v : Number(v) || d);
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : d);
  return {
    maxApptDuration: num(find("maxduration", "apptduration", "maxappt")?.value, defaults.maxApptDuration),
    advanceBooking: num(find("advancebooking", "bookingwindow", "advance")?.value, defaults.advanceBooking),
    staffToStaff: bool(find("stafftostaff", "s2s")?.value, defaults.staffToStaff),
    maxFailedTries: num(find("maxfailed", "failedtries", "failedattempts")?.value, defaults.maxFailedTries),
  };
}

// ---------------- orchestrated load ----------------
export interface LiveData {
  staff: Staff[];
  users: User[];
  visitors: Visitor[];
  appointments: Appointment[];
  nodes: AccessNode[];
  cards: AccessCard[];
  cameras: Camera[];
  assets: Asset[];
  incidents: Incident[];
  settings: Settings;
}

// Fetch a list resource, returning [] on any failure so one bad/slow endpoint
// can never block the whole console load (each module degrades independently).
async function safeList<T>(path: string): Promise<T[]> {
  try {
    const { data } = await api.get<T[]>(path);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Fetch everything the console needs in parallel and map to view-models. */
export async function loadAll(): Promise<LiveData> {
  const [staffRaw, usersRaw, visitorsRaw, apptsRaw, nodesRaw, cardsRaw, camerasRaw, assetsRaw, reportsRaw, settingsRaw] =
    await Promise.all([
      safeList<ApiStaff>("/staff?limit=100"),
      safeList<ApiUser>("/users"),
      safeList<ApiVisitor>("/visitors?limit=100"),
      safeList<ApiAppointment>("/appointments?limit=100"),
      safeList<ApiNode>("/nodes"),
      safeList<ApiCard>("/cards"),
      safeList<ApiCamera>("/cameras"),
      safeList<ApiAsset>("/assets"),
      safeList<ApiReport>("/reports?limit=100"),
      safeList<ApiSetting>("/settings"),
    ]);

  const staff = staffRaw.map(mapStaff);
  const staffById = new Map(staff.map((s) => [s.id, s.name]));
  const visitors = visitorsRaw.map(mapVisitor);
  const assets = assetsRaw.map(mapAsset);

  const users: User[] = usersRaw.map((u) => mapUser(u, staffById));

  // holder-name resolver across the three holder populations
  const visById = new Map(visitors.map((v) => [v.id, v.name]));
  const assetById = new Map(assets.map((a) => [a.id, a.name]));
  const resolveHolder: HolderResolver = (t, id) =>
    t === "staff" ? staffById.get(id) : t === "visitor" ? visById.get(id) : assetById.get(id);

  // enrich cards with their assignment (holder + nodes) — /cards omits it, so
  // pull each card's detail. Best-effort: a failed detail falls back to the row.
  const cards = await Promise.all(
    cardsRaw.map(async (c) => {
      try {
        const { data: full } = await api.get<ApiCard>(`/cards/${c.id}`);
        return mapCard(full, resolveHolder);
      } catch {
        return mapCard(c, resolveHolder);
      }
    })
  );

  return {
    staff,
    users,
    visitors,
    appointments: apptsRaw.map(mapAppointment),
    nodes: nodesRaw.map(mapNode),
    cards,
    cameras: camerasRaw.map(mapCamera),
    assets,
    incidents: reportsRaw.map(mapReport),
    settings: mapSettings(settingsRaw),
  };
}

function relLabel(ms: number): string {
  const d = Math.max(0, Date.now() - ms);
  const s = Math.floor(d / 1000);
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}
