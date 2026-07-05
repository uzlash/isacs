// ====================================================================
// Seed data — ported 1:1 from the design prototype's logic class.
// In production these factories would be replaced by API responses.
// All time-relative values are computed against a `now` epoch passed
// in at store-init time so the demo stays "live".
// ====================================================================

import type {
  AccessCard,
  AccessNode,
  Appointment,
  Asset,
  Camera,
  FeedEvent,
  Incident,
  Settings,
  Staff,
  User,
  Visitor,
} from "./types";

const MIN = 60_000;
const HOUR = 3_600_000;

export const seedStaff = (): Staff[] => [
  { id: "s1", staffId: "E-1001", name: "Cmdr. R. Okafor", dept: "Command", desig: "Facility Commander", phone: "+1 202 555 0118", email: "r.okafor@alpha.mil" },
  { id: "s2", staffId: "E-1042", name: "Lt. M. Vasquez", dept: "Security", desig: "Security Manager", phone: "+1 202 555 0142", email: "m.vasquez@alpha.mil" },
  { id: "s3", staffId: "E-1067", name: "Sgt. D. Park", dept: "Security", desig: "Gate Officer", phone: "+1 202 555 0167", email: "d.park@alpha.mil" },
  { id: "s4", staffId: "E-1088", name: "Cpl. A. Bauer", dept: "Security", desig: "Patrol Officer", phone: "+1 202 555 0188", email: "a.bauer@alpha.mil" },
  { id: "s5", staffId: "E-1103", name: "H. Tanaka", dept: "Operations", desig: "Facilities Lead", phone: "+1 202 555 0203", email: "h.tanaka@alpha.mil" },
  { id: "s6", staffId: "E-1119", name: "J. Mbeki", dept: "IT", desig: "Systems Engineer", phone: "+1 202 555 0219", email: "j.mbeki@alpha.mil" },
  { id: "s7", staffId: "E-1130", name: "Dr. L. Ferran", dept: "Research", desig: "Lab Director", phone: "+1 202 555 0230", email: "l.ferran@alpha.mil" },
  { id: "s8", staffId: "E-1155", name: "P. Nilsson", dept: "Logistics", desig: "Fleet Coordinator", phone: "+1 202 555 0255", email: "p.nilsson@alpha.mil" },
];

export const seedUsers = (): User[] => [
  { id: "u1", email: "r.okafor@alpha.mil", role: "super_admin", staff: "Cmdr. R. Okafor", staffId: null, assignedNodeIds: null, active: true, last: "2m ago" },
  { id: "u2", email: "m.vasquez@alpha.mil", role: "security_manager", staff: "Lt. M. Vasquez", staffId: null, assignedNodeIds: null, active: true, last: "11m ago" },
  { id: "u3", email: "d.park@alpha.mil", role: "security_personnel", staff: "Sgt. D. Park", staffId: null, assignedNodeIds: ["n1", "n2"], active: true, last: "4m ago" },
  { id: "u4", email: "a.bauer@alpha.mil", role: "security_personnel", staff: "Cpl. A. Bauer", staffId: null, assignedNodeIds: ["n5"], active: true, last: "1h ago" },
  { id: "u5", email: "h.tanaka@alpha.mil", role: "staff_admin", staff: "H. Tanaka", staffId: null, assignedNodeIds: null, active: true, last: "3h ago" },
  { id: "u6", email: "audit@alpha.mil", role: "auditor", staff: "—", staffId: null, assignedNodeIds: null, active: false, last: "6d ago" },
];

export const seedVisitors = (now: number): Visitor[] => [
  { id: "v1", name: "C. Rourke", org: "Meridian Defense", desig: "Account Rep", email: "c.rourke@meridian.com", phone: "+1 415 555 0911", checkedIn: now - MIN * 38 },
  { id: "v2", name: "S. Adeyemi", org: "Gridline Power", desig: "Field Engineer", email: "s.adeyemi@gridline.io", phone: "+1 415 555 0922", checkedIn: now - MIN * 92 },
  { id: "v3", name: "T. Wallace", org: "Audit & Co.", desig: "Compliance Auditor", email: "t.wallace@auditco.com", phone: "+1 415 555 0933", checkedIn: null },
  { id: "v4", name: "M. Ito", org: "Sakura Robotics", desig: "Solutions Architect", email: "m.ito@sakura.jp", phone: "+1 415 555 0944", checkedIn: now - MIN * 15 },
  { id: "v5", name: "F. Kowalski", org: "NorthBridge", desig: "Logistics", email: "f.k@northbridge.co", phone: "+1 415 555 0955", checkedIn: null },
  { id: "v6", name: "R. Singh", org: "Helix Medical", desig: "Inspector", email: "r.singh@helix.med", phone: "+1 415 555 0966", checkedIn: now - MIN * 120 },
];

export const seedAppointments = (now: number): Appointment[] => [
  { id: "a1", visitor: "C. Rourke", host: "Lt. M. Vasquez", start: now - HOUR * 0.6, end: now + HOUR * 0.4, status: "active", purpose: "Contract review" },
  { id: "a2", visitor: "M. Ito", host: "J. Mbeki", start: now - HOUR * 0.25, end: now + HOUR * 0.75, status: "active", purpose: "Systems integration" },
  { id: "a3", visitor: "T. Wallace", host: "Cmdr. R. Okafor", start: now + HOUR * 1.5, end: now + HOUR * 2.5, status: "scheduled", purpose: "Quarterly compliance audit" },
  { id: "a4", visitor: "F. Kowalski", host: "P. Nilsson", start: now + HOUR * 3, end: now + HOUR * 4, status: "scheduled", purpose: "Delivery coordination" },
  { id: "a5", visitor: "R. Singh", host: "Dr. L. Ferran", start: now + HOUR * 5, end: now + HOUR * 6, status: "postponed", purpose: "Lab equipment inspection" },
  { id: "a6", visitor: "S. Adeyemi", host: "H. Tanaka", start: now - HOUR * 26, end: now - HOUR * 25, status: "cancelled", purpose: "Grid maintenance — cancelled (weather)" },
];

export const seedNodes = (): AccessNode[] => [
  { id: "n1", name: "Main Compound Gate", parent: null, level: 0, max: 3, loc: "Perimeter — South", longitude: null, latitude: null },
  { id: "n2", name: "Building A Entrance", parent: "n1", level: 0, max: 3, loc: "Bldg A — Lobby", longitude: null, latitude: null },
  { id: "n3", name: "Floor 1 — General", parent: "n2", level: 1, max: 3, loc: "Bldg A — L1", longitude: null, latitude: null },
  { id: "n4", name: "Floor 2 — Restricted", parent: "n2", level: 2, max: 3, loc: "Bldg A — L2", longitude: null, latitude: null },
  { id: "n5", name: "Server Room", parent: "n4", level: 2, max: 2, loc: "Bldg A — L2 secure", longitude: null, latitude: null },
  { id: "n6", name: "Vehicle Bay", parent: "n1", level: 0, max: 3, loc: "Yard — East", longitude: null, latitude: null },
  { id: "n7", name: "Vehicle Inspection Point", parent: "n6", level: 0, max: 3, loc: "Yard — Checkpoint", longitude: null, latitude: null },
  { id: "n8", name: "Building B Entrance", parent: "n1", level: 0, max: 3, loc: "Bldg B — Lobby", longitude: null, latitude: null },
  { id: "n9", name: "Comms Room", parent: "n8", level: 1, max: 2, loc: "Bldg B — L1 secure", longitude: null, latitude: null },
];

export const seedCards = (): AccessCard[] => [
  { id: "c1", num: "CARD-00231", rfid: "RFID-8841", qr: null, type: "staff", active: true, holder: "Sgt. D. Park", nodes: ["n1", "n2"] },
  { id: "c2", num: "CARD-00232", rfid: "RFID-8842", qr: null, type: "staff", active: true, holder: "J. Mbeki", nodes: ["n1", "n8", "n9"] },
  { id: "c3", num: "CARD-00233", rfid: null, qr: "QR-VIS-7741", type: "visitor", active: true, holder: "M. Ito", nodes: ["n3"] },
  { id: "c4", num: "CARD-00234", rfid: null, qr: "QR-VIS-7742", type: "visitor", active: true, holder: "C. Rourke", nodes: ["n2"] },
  { id: "c5", num: "CARD-00235", rfid: "RFID-8845", qr: null, type: "vehicle", active: true, holder: "Patrol Unit 4", nodes: ["n1", "n6", "n7"] },
  { id: "c6", num: "CARD-00236", rfid: "RFID-8846", qr: null, type: "staff", active: false, holder: "— (deactivated)", nodes: [] },
];

export const seedCameras = (now: number): Camera[] => (
  [
    { id: "cam1", name: "CAM-01 Main Gate", loc: "Perimeter South", level: 0, active: true, snap: now - MIN * 2 },
    { id: "cam2", name: "CAM-02 Bldg A Lobby", loc: "Building A L1", level: 1, active: true, snap: now - MIN * 1 },
    { id: "cam3", name: "CAM-03 Floor 2 Hall", loc: "Building A L2", level: 2, active: true, snap: now - MIN * 3 },
    { id: "cam4", name: "CAM-04 Server Room", loc: "Bldg A secure", level: 2, active: true, snap: now - MIN * 1 },
    { id: "cam5", name: "CAM-05 Vehicle Bay", loc: "Yard East", level: 0, active: true, snap: now - MIN * 4 },
    { id: "cam6", name: "CAM-06 Bldg B Lobby", loc: "Building B L1", level: 1, active: true, snap: now - MIN * 2 },
    { id: "cam7", name: "CAM-07 North Fence", loc: "Perimeter North", level: 0, active: false, snap: now - MIN * 240 },
    { id: "cam8", name: "CAM-08 Comms Room", loc: "Bldg B secure", level: 1, active: true, snap: now - MIN * 1 },
  ] as Omit<Camera, "snapUrl" | "lat" | "lng">[]
).map((c) => ({ ...c, snapUrl: null, lat: null, lng: null }));

export const seedAssets = (): Asset[] => [
  { id: "as1", name: "Patrol Unit 4", type: "Vehicle", vehicle: true, plate: "GOV-4471", tracker: "GPS-A4-009", protoActive: true, speed: 60, geo: true },
  { id: "as2", name: "Supply Truck 2", type: "Vehicle", vehicle: true, plate: "GOV-2218", tracker: "GPS-T2-014", protoActive: true, speed: 50, geo: true },
  { id: "as3", name: "Mobile Generator", type: "Equipment", vehicle: false, plate: null, tracker: "GPS-EQ-021", protoActive: false, speed: null, geo: false },
  { id: "as4", name: "Drone Recon-1", type: "UAV", vehicle: false, plate: null, tracker: "GPS-UAV-003", protoActive: true, speed: 45, geo: true },
  { id: "as5", name: "Cargo Forklift", type: "Equipment", vehicle: false, plate: null, tracker: null, protoActive: false, speed: null, geo: false },
];

// base rows omit imageUrls/sourceRef; defaults are injected below.
const seedIncidentRows = (now: number): Omit<Incident, "imageUrls" | "sourceRef">[] => [
  { id: "I-2048", source: "access", sev: "critical", status: "open", desc: "Card QR-VIS-7741 failed access at Server Room 3 times", node: "Server Room", investigator: null, created: now - 3 * MIN, images: 2, log: [{ t: now - 3 * MIN, s: "Auto-created by Access Control Engine" }] },
  { id: "I-2047", source: "assets", sev: "high", status: "investigating", desc: "Supply Truck 2 exceeded geofence boundary — Sector E", node: "Perimeter", investigator: "Cpl. A. Bauer", created: now - 22 * MIN, images: 1, log: [{ t: now - 22 * MIN, s: "Auto-created by Asset Protocol breach" }, { t: now - 18 * MIN, s: "Assigned to Cpl. A. Bauer" }] },
  { id: "I-2046", source: "surveillance", sev: "medium", status: "investigating", desc: "Unidentified individual loitering near Vehicle Bay (CAM-05)", node: "Vehicle Bay", investigator: "Sgt. D. Park", created: now - 54 * MIN, images: 3, log: [{ t: now - 54 * MIN, s: "Escalated from CAM-05 by Lt. M. Vasquez" }, { t: now - 50 * MIN, s: "Assigned to Sgt. D. Park" }] },
  { id: "I-2045", source: "manual", sev: "low", status: "open", desc: "Visitor badge found unattended in Building A lobby", node: "Building A", investigator: null, created: now - 88 * MIN, images: 0, log: [{ t: now - 88 * MIN, s: "Filed manually by Sgt. D. Park" }] },
  { id: "I-2044", source: "access", sev: "high", status: "resolved", desc: "Repeated failed access at Comms Room — deactivated card", node: "Comms Room", investigator: "Cpl. A. Bauer", created: now - HOUR * 5, images: 1, resolution: "Card CARD-00236 confirmed lost; deactivated and reissued. No breach.", resolvedAt: now - HOUR * 4, log: [{ t: now - HOUR * 5, s: "Auto-created by Access Control Engine" }, { t: now - HOUR * 4.6, s: "Assigned to Cpl. A. Bauer" }, { t: now - HOUR * 4, s: "Resolved" }] },
  { id: "I-2043", source: "surveillance", sev: "medium", status: "resolved", desc: "Motion flagged at North Fence after hours (CAM-07)", node: "Perimeter North", investigator: "Sgt. D. Park", created: now - HOUR * 9, images: 2, resolution: "Wildlife confirmed via snapshot review. No action required.", resolvedAt: now - HOUR * 8, log: [{ t: now - HOUR * 9, s: "Escalated from CAM-07" }, { t: now - HOUR * 8, s: "Resolved" }] },
];

export const seedIncidents = (now: number): Incident[] =>
  seedIncidentRows(now).map((r) => ({ ...r, imageUrls: [], sourceRef: null }));

export const seedFeed = (now: number): FeedEvent[] => [
  { id: 1, module: "ACCESS", text: "Sgt. D. Park granted entry · Building A Entrance", tone: "var(--ok)", at: now - 12_000 },
  { id: 2, module: "ACCESS", text: "DENIED · QR-VIS-7741 · Server Room (attempt 3/2) → escalated", tone: "var(--danger)", at: now - 22_000 },
  { id: 3, module: "ASRS", text: "Incident I-2048 auto-created from access failure", tone: "var(--danger)", at: now - 23_000 },
  { id: 4, module: "VISITOR", text: "M. Ito checked in · QR pass issued (Floor 1)", tone: "var(--info)", at: now - MIN * 15 },
  { id: 5, module: "ASSET", text: "Supply Truck 2 left permitted boundary · Sector E", tone: "var(--warn)", at: now - MIN * 22 },
  { id: 6, module: "SURVEIL", text: "CAM-04 snapshot stored · Server Room", tone: "var(--muted)", at: now - MIN * 5 },
  { id: 7, module: "APPT", text: "Appointment booked · T. Wallace ↔ Cmdr. Okafor · host notified", tone: "var(--accent)", at: now - MIN * 40 },
  { id: 8, module: "ACCESS", text: "J. Mbeki granted entry · Comms Room", tone: "var(--ok)", at: now - MIN * 8 },
  { id: 9, module: "AUTH", text: "Session refreshed · m.vasquez@alpha.mil", tone: "var(--muted)", at: now - MIN * 11 },
  { id: 10, module: "VISITOR", text: "C. Rourke checked in · escort assigned", tone: "var(--info)", at: now - MIN * 38 },
];

export const RANDOM_FEED_POOL: Omit<FeedEvent, "id" | "at">[] = [
  { module: "ACCESS", text: "Card RFID-8841 granted · Building A Entrance", tone: "var(--ok)" },
  { module: "ACCESS", text: "Card RFID-8842 granted · Comms Room", tone: "var(--ok)" },
  { module: "SURVEIL", text: "Snapshot cycle complete · 7 cameras indexed", tone: "var(--muted)" },
  { module: "ASSET", text: "Patrol Unit 4 telemetry nominal · 42 km/h", tone: "var(--muted)" },
  { module: "AUTH", text: "Permission cache refreshed · 30s TTL", tone: "var(--muted)" },
  { module: "ACCESS", text: "DENIED · unknown credential · Vehicle Inspection", tone: "var(--danger)" },
  { module: "VISITOR", text: "Visit history updated · R. Singh", tone: "var(--info)" },
];

export const seedSettings = (): Settings => ({
  maxApptDuration: 120,
  advanceBooking: 30,
  staffToStaff: true,
  maxFailedTries: 3,
});
