// ====================================================================
// ISACS domain types.
// These mirror the documented REST resources (see ISACS_API_Reference)
// so the in-memory seed can later be swapped for live `fetch` calls.
// ====================================================================

export type Role =
  | "super_admin"
  | "security_manager"
  | "security_personnel"
  | "staff_admin"
  | "auditor";

export type Theme = "obsidian" | "daylight" | "steel";
export type Density = "compact" | "balanced" | "spacious";

export type View =
  | "dashboard"
  | "incidents"
  | "surveillance"
  | "access"
  | "assets"
  | "visitors"
  | "appointments"
  | "staff"
  | "users"
  | "settings";

export interface Staff {
  id: string;
  staffId: string;
  name: string;
  dept: string;
  desig: string;
  phone: string;
  email: string;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  /** linked staff display name ("—" if none) */
  staff: string;
  /** linked staff id (for editing) */
  staffId: string | null;
  /** access nodes this personnel account is assigned to (security_personnel
   *  only; null for other roles or unassigned) */
  assignedNodeIds: string[] | null;
  active: boolean;
  last: string;
}

export interface Visitor {
  id: string;
  name: string;
  org: string;
  desig: string;
  email: string;
  phone: string;
  /** epoch ms of check-in, or null if not on site */
  checkedIn: number | null;
}

export type ApptStatus =
  | "scheduled"
  | "active"
  | "postponed"
  | "cancelled"
  | "completed";

export interface Appointment {
  id: string;
  visitor: string;
  host: string;
  start: number;
  end: number;
  status: ApptStatus;
  purpose: string;
}

export interface AccessNode {
  id: string;
  name: string;
  parent: string | null;
  level: number;
  max: number;
  loc: string;
  longitude: number | null;
  latitude: number | null;
}

export type CardType = "staff" | "visitor" | "vehicle";

export interface AccessCard {
  id: string;
  num: string;
  rfid: string | null;
  qr: string | null;
  type: CardType;
  active: boolean;
  holder: string;
  nodes: string[];
}

export interface Camera {
  id: string;
  name: string;
  loc: string;
  level: number;
  active: boolean;
  snap: number;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  vehicle: boolean;
  plate: string | null;
  tracker: string | null;
  protoActive: boolean;
  speed: number | null;
  geo: boolean;
}

export type IncidentSource = "access" | "surveillance" | "assets" | "manual";
export type Severity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "open" | "investigating" | "resolved";

export interface IncidentLog {
  t: number;
  s: string;
}

export interface Incident {
  id: string;
  source: IncidentSource;
  sev: Severity;
  status: IncidentStatus;
  desc: string;
  node: string;
  investigator: string | null;
  created: number;
  images: number;
  /** attachment URLs — for BBIW surveillance reports imageUrls[0] is an MP4 clip */
  imageUrls: string[];
  /** the source record ref — for BBIW reports this is the ISACS camera UUID */
  sourceRef: string | null;
  resolution?: string;
  resolvedAt?: number;
  log: IncidentLog[];
}

export type EventModule =
  | "ACCESS"
  | "ASRS"
  | "VISITOR"
  | "ASSET"
  | "SURVEIL"
  | "APPT"
  | "AUTH";

export interface FeedEvent {
  id: number;
  module: EventModule;
  text: string;
  /** CSS color token, e.g. "var(--ok)" */
  tone: string;
  at: number;
}

// A transient on-screen alert for a live BBIW detection (SSE-driven).
export interface DetectionToast {
  id: number;
  rule: string;
  camera: string;
  severity: string;
  clipUrl: string | null;
  at: number;
}

export interface CheckLogEntry {
  id: number;
  node: string;
  code: string;
  granted: boolean;
  reason?: string;
  holder?: string;
  tries: number;
  maxT: number;
  escalated: boolean;
  at: number;
}

export interface Settings {
  maxApptDuration: number;
  advanceBooking: number;
  staffToStaff: boolean;
  maxFailedTries: number;
}
