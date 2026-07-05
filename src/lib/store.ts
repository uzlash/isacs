// ====================================================================
// ISACS client store (Zustand).
//
// Holds all module data + cross-module behavior so that an action in
// one view (e.g. an access failure) propagates everywhere it should:
// it raises an ASRS incident, writes to the live event bus, and bumps
// the sidebar/topbar open-incident badges — exactly like the prototype.
//
// Data is seeded in-memory (see seed.ts). Each mutating action is the
// natural place to later call the documented REST endpoint instead.
// ====================================================================

import { create } from "zustand";
import {
  RANDOM_FEED_POOL,
  seedAppointments,
  seedAssets,
  seedCameras,
  seedCards,
  seedFeed,
  seedIncidents,
  seedNodes,
  seedSettings,
  seedStaff,
  seedUsers,
  seedVisitors,
} from "./seed";
import {
  fetchAppointments,
  fetchAssets,
  fetchCameras,
  fetchCards,
  fetchNodes,
  fetchReports,
  fetchStaff,
  fetchUsers,
  fetchVisitors,
  loadAll,
} from "./api/resources";
import {
  accessCheck,
  assignReport,
  checkInVisitor,
  createAppointment,
  escalateCamera,
  putSetting,
  reportAssetBreach,
  resolveReport,
  setAssetProtocol,
} from "./api/mutations";
import { USER_COOKIE, isLive } from "./config";
import { connectEvents, type EventStream, type IsacsEvent } from "./events";
import { isBbiwReport, isClipUrl, parseBbiwDescription } from "./api/bbiw";
import type {
  AccessCard,
  AccessNode,
  Appointment,
  Asset,
  Camera,
  CheckLogEntry,
  Density,
  DetectionToast,
  EventModule,
  FeedEvent,
  Incident,
  Settings,
  Staff,
  Theme,
  User,
  Visitor,
} from "./types";

interface ScheduleForm {
  host: string;
  visitor: string;
  date: string;
  dur: number;
  error: string;
}

interface State {
  ready: boolean;
  tick: number;
  loadError: string | null;

  // prefs
  theme: Theme;
  accent: string | null;
  density: Density;
  liveFeed: boolean;

  // data
  staff: Staff[];
  users: User[];
  visitors: Visitor[];
  appointments: Appointment[];
  nodes: AccessNode[];
  cards: AccessCard[];
  cameras: Camera[];
  assets: Asset[];
  incidents: Incident[];
  feed: FeedEvent[];
  settings: Settings;
  /** bumped by acm.* live events so the ACM page can re-fetch connectivity */
  acmVersion: number;
  /** live BBIW detection alerts (SSE) shown as dismissable toasts */
  detectionToasts: DetectionToast[];

  // incidents view
  selectedIncident: string | null;
  incFilter: string;
  incSource: string;
  resolveText: string;

  // access view
  expanded: Record<string, boolean>;
  selectedNode: string;
  checkForm: { nodeId: string; code: string };
  checkLog: CheckLogEntry[];
  failedTries: Record<string, number>;

  // directory
  visitorSearch: string;
  showSchedule: boolean;
  schedule: ScheduleForm;

  // ---- actions ----
  hydrate: (now: number) => void;
  loadLive: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  refreshNodes: () => Promise<void>;
  refreshStaff: () => Promise<void>;
  refreshVisitors: () => Promise<void>;
  refreshAppointments: () => Promise<void>;
  refreshCameras: () => Promise<void>;
  refreshAssets: () => Promise<void>;
  refreshCards: () => Promise<void>;
  refreshReports: () => Promise<void>;
  tickClock: () => void;
  setTheme: (t: Theme) => void;
  setAccent: (a: string | null) => void;
  setDensity: (d: Density) => void;
  setLiveFeed: (v: boolean) => void;
  maybePushRandom: () => void;
  connectEventStream: () => void;
  disconnectEventStream: () => void;
  dismissToast: (id: number) => void;
  /** internal setters used by the out-of-closure SSE event handler */
  __setIncidents: (v: Incident[]) => void;
  __setAppointments: (v: Appointment[]) => void;

  selectIncident: (id: string) => void;
  setIncFilter: (s: string) => void;
  setIncSource: (s: string) => void;
  setResolveText: (s: string) => void;
  assignIncident: (id: string) => void;
  resolveIncident: (id: string) => void;

  checkIn: (id: string) => void;
  setVisitorSearch: (s: string) => void;

  toggleNode: (id: string) => void;
  selectNode: (id: string) => void;
  setCheckNode: (id: string) => void;
  setCheckCode: (c: string) => void;
  runCheck: () => Promise<CheckLogEntry | null>;
  runCheckFor: (code: string, nodeId: string) => Promise<CheckLogEntry | null>;

  toggleProto: (id: string) => void;
  reportBreach: (id: string) => void;
  escalateCam: (id: string) => void;

  openSchedule: () => void;
  closeSchedule: () => void;
  setSched: (k: keyof ScheduleForm, v: string | number) => void;
  submitSchedule: () => void;

  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  saveSettings: () => Promise<{ ok: boolean; error?: string }>;
}

// next ASRS incident id — mirrors the prototype's counter exactly:
// "I-" + (2049 + count of existing I-20* incidents)
function nextIncidentId(incidents: Incident[]): string {
  return "I-" + (2049 + incidents.filter((x) => x.id.startsWith("I-20")).length);
}

// Strictly-increasing unique id for list keys (feed events, decision-log
// rows). Date.now() alone collides when two actions fire in the same ms
// (e.g. a double-click). Seeded above the static seed-feed ids (1–10).
let uidSeq = 1000;
const uid = () => (uidSeq += 1);

// current user id from the readable session cookie (for "assign to me")
function currentUserId(): string | null {
  if (typeof document === "undefined") return null;
  const e = document.cookie.split("; ").find((c) => c.startsWith(USER_COOKIE + "="));
  if (!e) return null;
  try {
    return (JSON.parse(decodeURIComponent(e.slice(USER_COOKIE.length + 1))) as { id?: string })?.id ?? null;
  } catch {
    return null;
  }
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

// ---- preference persistence (theme/density/accent/livefeed) ----
function persistPref(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* localStorage blocked (private mode etc.) — ignore */
  }
}
function applyHtml(attr: string, value: string) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(attr, value);
}

// ---- live event bus wiring (SSE) ----
// Single connection handle for the whole app (the store is a module singleton).
let eventStream: EventStream | null = null;

type LogFn = (module: EventModule, text: string, tone: string) => void;

// Map a raw SSE event to a feed entry + any targeted data refresh. The event
// payload shapes come from the RabbitMQ bridge; we read defensively (unknown →
// best-effort field access) so an unexpected shape never throws in the stream.
function handleLiveEvent(e: IsacsEvent, get: () => State, log: LogFn) {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const str = (k: string): string => (typeof p[k] === "string" ? (p[k] as string) : "");
  // resolve a node id → name using current store state
  const nodeName = (id: string) => get().nodes.find((n) => n.id === id)?.name || id;
  const who = str("holderName") || str("cardNumber") || str("rfidTag") || str("credential") || "credential";
  const node = nodeName(str("nodeId") || str("accessNodeId"));

  switch (e.type) {
    case "connected":
      log("AUTH", "Live event stream connected · receiving facility events", "var(--ok)");
      break;

    case "access.granted":
      log("ACCESS", `${who} granted entry · ${node}`, "var(--ok)");
      break;
    case "access.denied":
      log("ACCESS", `DENIED · ${who} · ${node}${str("reason") ? " · " + str("reason") : ""}`, "var(--danger)");
      break;
    case "acm.scan":
      // very chatty — keep it low-key
      log("ACCESS", `Scan at ${node}`, "var(--muted)");
      break;
    case "acm.online":
      log("ACCESS", `Device online · ${str("name") || str("deviceId") || node}`, "var(--ok)");
      useStore.setState((s) => ({ acmVersion: s.acmVersion + 1 }));
      break;
    case "acm.offline":
      log("ACCESS", `Device OFFLINE · ${str("name") || str("deviceId") || node}`, "var(--danger)");
      useStore.setState((s) => ({ acmVersion: s.acmVersion + 1 }));
      break;

    case "lockdown.created":
      log("ACCESS", `FACILITY LOCKDOWN · ${str("description") || "initiated"}`, "var(--danger)");
      break;
    case "lockdown.lifted":
      log("ACCESS", `Lockdown lifted${str("resolution") ? " · " + str("resolution") : ""}`, "var(--ok)");
      break;

    case "security.report.created": {
      const desc = str("description");
      log("ASRS", `Incident raised · ${desc || str("source") || "new report"}`, "var(--danger)");
      // A BBIW AI detection → also raise a dismissable toast with the clip.
      if (str("source") === "surveillance" && isBbiwReport(desc)) {
        const parsed = parseBbiwDescription(desc);
        const imgs = Array.isArray(p.imageUrls) ? (p.imageUrls as unknown[]).filter((u): u is string => typeof u === "string") : [];
        const clip = imgs.find((u) => isClipUrl(u)) ?? null;
        useStore.setState((s) => ({
          detectionToasts: [
            { id: uid(), rule: parsed.rule || "detection", camera: parsed.camera || "camera", severity: parsed.severity || "", clipUrl: clip, at: Date.now() },
            ...s.detectionToasts,
          ].slice(0, 4),
        }));
      }
      void refreshReportsInto(get);
      break;
    }
    case "security.report.resolved":
      log("ASRS", `Incident resolved${str("id") ? " · " + str("id") : ""}`, "var(--ok)");
      void refreshReportsInto(get);
      break;

    case "appointment.created":
      log("APPT", `Appointment scheduled · ${str("visitorName") || str("title") || ""}`, "var(--info)");
      void refreshAppointmentsInto(get);
      break;
    case "appointment.cancelled":
      log("APPT", `Appointment cancelled${str("visitorName") ? " · " + str("visitorName") : ""}`, "var(--warn)");
      void refreshAppointmentsInto(get);
      break;
    case "appointment.postponed":
      log("APPT", `Appointment postponed${str("visitorName") ? " · " + str("visitorName") : ""}`, "var(--warn)");
      void refreshAppointmentsInto(get);
      break;

    case "visitor.checked_in":
      log("VISITOR", `${str("name") || str("visitorName") || "Visitor"} checked in · timestamp recorded`, "var(--info)");
      break;

    case "staff.created":
      log("VISITOR", `New staff record · ${str("name") || ""}`, "var(--muted)");
      break;

    case "asset.protocol.breached":
      log("ASSET", `PROTOCOL BREACH · ${str("assetName") || str("name") || "asset"}`, "var(--danger)");
      break;

    default:
      // unknown/unmapped event — surface it quietly so nothing is silently lost
      log("AUTH", `Event · ${e.type}`, "var(--muted)");
  }
}

// targeted refreshes reused by the event handler (kept out of the store closure
// so the module-level handler can call them). They write straight into the store.
async function refreshReportsInto(get: () => State) {
  try {
    get().__setIncidents(await fetchReports());
  } catch {
    /* ignore — the next poll/load will reconcile */
  }
}
async function refreshAppointmentsInto(get: () => State) {
  try {
    get().__setAppointments(await fetchAppointments());
  } catch {
    /* ignore */
  }
}

export const useStore = create<State>((set, get) => {
  // append an event to the live bus (cap 40)
  const logEvent = (module: EventModule, text: string, tone: string) => {
    set((s) => ({
      feed: [{ id: uid(), at: Date.now(), module, text, tone }, ...s.feed].slice(0, 40),
    }));
  };

  // does `reqNode` fall under one of the `assigned` nodes (inheritance)?
  const isCovered = (reqNode: string, assigned: string[]): boolean => {
    const byId: Record<string, AccessNode> = {};
    get().nodes.forEach((n) => (byId[n.id] = n));
    let cur: string | null = reqNode;
    while (cur) {
      if (assigned.includes(cur)) return true;
      cur = byId[cur] ? byId[cur].parent : null;
    }
    return false;
  };

  return {
    ready: false,
    tick: 0,
    loadError: null,
    theme: "obsidian",
    accent: null,
    density: "balanced",
    liveFeed: true,

    staff: [],
    users: [],
    visitors: [],
    appointments: [],
    nodes: [],
    cards: [],
    cameras: [],
    assets: [],
    incidents: [],
    feed: [],
    settings: seedSettings(),
    acmVersion: 0,
    detectionToasts: [],

    selectedIncident: null,
    incFilter: "all",
    incSource: "all",
    resolveText: "",

    expanded: { n1: true, n2: true, n6: false, n8: false },
    selectedNode: "n4",
    checkForm: { nodeId: "n5", code: "QR-VIS-7741" },
    checkLog: [],
    failedTries: {},

    visitorSearch: "",
    showSchedule: false,
    schedule: { host: "", visitor: "", date: "", dur: 60, error: "" },

    hydrate: (now) => {
      if (get().ready) return;
      set({
        ready: true,
        staff: seedStaff(),
        users: seedUsers(),
        visitors: seedVisitors(now),
        appointments: seedAppointments(now),
        nodes: seedNodes(),
        cards: seedCards(),
        cameras: seedCameras(now),
        assets: seedAssets(),
        incidents: seedIncidents(now),
        feed: seedFeed(now),
      });
    },

    // Live load: fetch every resource from the API and map to view-models.
    // The REST API has no event stream, so the feed starts empty and fills
    // from console-initiated actions (logEvent) instead.
    loadLive: async () => {
      try {
        const d = await loadAll();
        const firstNode = d.nodes[0]?.id ?? "";
        set((s) => ({
          ready: true,
          loadError: null,
          staff: d.staff,
          users: d.users,
          visitors: d.visitors,
          appointments: d.appointments,
          nodes: d.nodes,
          cards: d.cards,
          cameras: d.cameras,
          assets: d.assets,
          incidents: d.incidents,
          settings: d.settings,
          feed: [],
          // point the checkpoint engine + tree at real node ids
          selectedNode: firstNode || s.selectedNode,
          checkForm: { nodeId: firstNode || s.checkForm.nodeId, code: "" },
        }));
      } catch (e) {
        // 401s already redirect to /login inside the api client
        set({ ready: true, loadError: e instanceof Error ? e.message : "Failed to load data" });
      }
    },

    refreshUsers: async () => {
      try {
        const staffById = new Map(get().staff.map((s) => [s.id, s.name]));
        set({ users: await fetchUsers(staffById) });
      } catch {
        /* leave the current list in place on failure */
      }
    },

    refreshNodes: async () => {
      try {
        set({ nodes: await fetchNodes() });
      } catch {
        /* leave the current list in place on failure */
      }
    },
    refreshStaff: async () => {
      try {
        set({ staff: await fetchStaff() });
      } catch {
        /* keep current */
      }
    },
    refreshVisitors: async () => {
      try {
        set({ visitors: await fetchVisitors() });
      } catch {
        /* keep current */
      }
    },
    refreshAppointments: async () => {
      try {
        set({ appointments: await fetchAppointments() });
      } catch {
        /* keep current */
      }
    },
    refreshCameras: async () => {
      try {
        set({ cameras: await fetchCameras() });
      } catch {
        /* keep current */
      }
    },
    refreshAssets: async () => {
      try {
        set({ assets: await fetchAssets() });
      } catch {
        /* keep current */
      }
    },
    refreshCards: async () => {
      try {
        // resolve holder names from the current store lists
        const s = get();
        const staffById = new Map(s.staff.map((x) => [x.id, x.name]));
        const visById = new Map(s.visitors.map((x) => [x.id, x.name]));
        const assetById = new Map(s.assets.map((x) => [x.id, x.name]));
        const resolveHolder = (t: string, id: string) =>
          t === "staff" ? staffById.get(id) : t === "visitor" ? visById.get(id) : assetById.get(id);
        set({ cards: await fetchCards(resolveHolder) });
      } catch {
        /* keep current */
      }
    },
    refreshReports: async () => {
      try {
        set({ incidents: await fetchReports() });
      } catch {
        /* keep current */
      }
    },

    tickClock: () => set((s) => ({ tick: s.tick + 1 })),
    // Prefs persist to localStorage + apply to <html> immediately in the setter,
    // so a change survives reload and reflects on every page (incl. /login)
    // without depending on any effect having run first.
    setTheme: (theme) => {
      set({ theme });
      persistPref("isacs-theme", theme);
      applyHtml("data-theme", theme);
    },
    setAccent: (accent) => {
      set({ accent });
      persistPref("isacs-accent", accent);
      if (typeof document !== "undefined") {
        if (accent) document.documentElement.style.setProperty("--accent", accent);
        else document.documentElement.style.removeProperty("--accent");
      }
    },
    setDensity: (density) => {
      set({ density });
      persistPref("isacs-density", density);
      applyHtml("data-density", density);
    },
    setLiveFeed: (liveFeed) => {
      set({ liveFeed });
      persistPref("isacs-livefeed", liveFeed ? "1" : "0");
    },

    maybePushRandom: () => {
      // no synthetic events in live mode — the feed only reflects real actions
      if (isLive) return;
      if (!get().liveFeed || Math.random() >= 0.62) return;
      const p = RANDOM_FEED_POOL[Math.floor(Math.random() * RANDOM_FEED_POOL.length)];
      set((s) => ({
        feed: [{ id: uid(), at: Date.now(), ...p }, ...s.feed].slice(0, 40),
      }));
    },

    // ---- live event bus (SSE) ----
    connectEventStream: () => {
      if (!isLive || eventStream) return; // live-only, single connection
      eventStream = connectEvents((e) => handleLiveEvent(e, get, logEvent));
    },
    disconnectEventStream: () => {
      eventStream?.close();
      eventStream = null;
    },
    dismissToast: (id) => set((s) => ({ detectionToasts: s.detectionToasts.filter((t) => t.id !== id) })),
    __setIncidents: (v) => set({ incidents: v }),
    __setAppointments: (v) => set({ appointments: v }),

    selectIncident: (id) => {
      const i = get().incidents.find((x) => x.id === id);
      set({ selectedIncident: id, resolveText: (i && i.resolution) || "" });
    },
    setIncFilter: (incFilter) => set({ incFilter }),
    setIncSource: (incSource) => set({ incSource }),
    setResolveText: (resolveText) => set({ resolveText }),

    assignIncident: async (id) => {
      if (isLive) {
        const investigatorId = currentUserId();
        if (!investigatorId) {
          logEvent("ASRS", "Assign failed · no active session", "var(--danger)");
          return;
        }
        try {
          const updated = await assignReport(id, investigatorId);
          set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
          logEvent("ASRS", "Incident " + id + " assigned · investigator notified", "var(--info)");
        } catch (e) {
          logEvent("ASRS", "Assign failed · " + errMsg(e), "var(--danger)");
        }
        return;
      }
      set((s) => ({
        incidents: s.incidents.map((i) =>
          i.id === id
            ? {
                ...i,
                investigator: "Sgt. D. Park",
                status: "investigating",
                log: [...i.log, { t: Date.now(), s: "Assigned to Sgt. D. Park" }],
              }
            : i
        ),
      }));
      logEvent("ASRS", "Incident " + id + " assigned to Sgt. D. Park · investigator notified", "var(--info)");
    },

    resolveIncident: async (id) => {
      const txt = get().resolveText.trim();
      if (!txt) return;
      if (isLive) {
        try {
          const updated = await resolveReport(id, txt);
          set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
          logEvent("ASRS", "Incident " + id + " resolved · permanent record sealed", "var(--ok)");
        } catch (e) {
          logEvent("ASRS", "Resolve failed · " + errMsg(e), "var(--danger)");
        }
        return;
      }
      set((s) => ({
        incidents: s.incidents.map((i) =>
          i.id === id
            ? {
                ...i,
                status: "resolved",
                resolution: txt,
                resolvedAt: Date.now(),
                log: [...i.log, { t: Date.now(), s: "Resolved" }],
              }
            : i
        ),
      }));
      logEvent("ASRS", "Incident " + id + " resolved · permanent record sealed", "var(--ok)");
    },

    checkIn: async (id) => {
      const t = get().visitors.find((x) => x.id === id);
      if (!t) return;
      if (isLive) {
        try {
          const updated = await checkInVisitor(id);
          set((s) => ({ visitors: s.visitors.map((v) => (v.id === id ? updated : v)) }));
          logEvent("VISITOR", t.name + " checked in · permanent timestamp recorded", "var(--info)");
        } catch (e) {
          logEvent("VISITOR", "Check-in failed · " + errMsg(e), "var(--danger)");
        }
        return;
      }
      set((s) => ({
        visitors: s.visitors.map((v) => (v.id === id ? { ...v, checkedIn: Date.now() } : v)),
      }));
      logEvent("VISITOR", t.name + " checked in · permanent timestamp recorded", "var(--info)");
    },
    setVisitorSearch: (visitorSearch) => set({ visitorSearch }),

    toggleNode: (id) =>
      set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
    selectNode: (selectedNode) => set({ selectedNode }),
    setCheckNode: (id) => set((s) => ({ checkForm: { ...s.checkForm, nodeId: id } })),
    setCheckCode: (code) => set((s) => ({ checkForm: { ...s.checkForm, code } })),
    // Run a check for a specific card credential against a chosen checkpoint —
    // used by the "Run check" action on the cards table.
    runCheckFor: async (code, nodeId) => {
      set((s) => ({ checkForm: { ...s.checkForm, code, nodeId } }));
      return get().runCheck();
    },

    runCheck: async () => {
      const { nodeId, code } = get().checkForm;
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node) return null;

      if (isLive) {
        try {
          // single credential input → try it as any of the three identifier types
          const r = await accessCheck({ cardNumber: code, rfidTag: code, qrCode: code, nodeId });
          let holderName: string | undefined;
          if (r.granted && r.holderId) {
            holderName =
              get().staff.find((x) => x.id === r.holderId)?.name ||
              get().visitors.find((x) => x.id === r.holderId)?.name ||
              get().assets.find((x) => x.id === r.holderId)?.name ||
              r.holderType;
          }
          const entry: CheckLogEntry = {
            id: uid(),
            node: node.name,
            code,
            granted: r.granted,
            reason: r.reason,
            holder: holderName,
            tries: r.failedTries ?? 0,
            maxT: r.maxTries ?? node.max,
            escalated: !!r.escalated,
            at: Date.now(),
          };
          set((s) => ({ checkLog: [entry, ...s.checkLog].slice(0, 12) }));
          if (r.granted) {
            logEvent("ACCESS", (holderName || code) + " granted entry · " + node.name, "var(--ok)");
          } else if (r.escalated) {
            logEvent("ACCESS", "DENIED · " + code + " · " + node.name + " (" + entry.tries + "/" + entry.maxT + ") → ESCALATED", "var(--danger)");
            logEvent("ASRS", "Incident auto-created from access failure at " + node.name, "var(--danger)");
            try {
              set({ incidents: await fetchReports() });
            } catch {
              /* keep going — badge will catch up on next load */
            }
          } else {
            logEvent("ACCESS", "DENIED · " + code + " · " + node.name + " (" + entry.tries + "/" + entry.maxT + ") · " + (r.reason ?? ""), "var(--warn)");
          }
          return entry;
        } catch (e) {
          logEvent("ACCESS", "Access check failed · " + errMsg(e), "var(--danger)");
          return null;
        }
      }

      const card = get().cards.find((c) => c.num === code || c.rfid === code || c.qr === code);
      const ft = { ...get().failedTries };

      let granted = false;
      let reason: string | undefined;
      let holder: string | undefined;
      if (!card || !card.active) {
        reason = "Card not recognised or inactive";
      } else if (!card.nodes || card.nodes.length === 0) {
        reason = "Card is not currently assigned";
      } else if (!isCovered(nodeId, card.nodes)) {
        reason = "Access not permitted for this node";
      } else {
        granted = true;
        holder = card.holder;
      }

      let escalated = false;
      let tries = 0;
      const maxT = node.max;

      if (granted) {
        ft[nodeId] = 0;
        logEvent("ACCESS", (holder || code) + " granted entry · " + node.name, "var(--ok)");
      } else {
        tries = (ft[nodeId] || 0) + 1;
        ft[nodeId] = tries;
        if (tries >= maxT) {
          escalated = true;
          ft[nodeId] = 0;
          const id = nextIncidentId(get().incidents);
          const incident: Incident = {
            id,
            source: "access",
            sev: "critical",
            status: "open",
            desc: "Card " + code + " failed access at " + node.name + " " + maxT + " times",
            node: node.name,
            investigator: null,
            created: Date.now(),
            images: 0,
            imageUrls: [],
            sourceRef: null,
            log: [{ t: Date.now(), s: "Auto-created by Access Control Engine" }],
          };
          set((s) => ({ incidents: [incident, ...s.incidents] }));
          logEvent("ACCESS", "DENIED · " + code + " · " + node.name + " (" + maxT + "/" + maxT + ") → ESCALATED", "var(--danger)");
          logEvent("ASRS", "Incident " + id + " auto-created from access failure", "var(--danger)");
        } else {
          logEvent("ACCESS", "DENIED · " + code + " · " + node.name + " (" + tries + "/" + maxT + ") · " + reason, "var(--warn)");
        }
      }

      const entry: CheckLogEntry = {
        id: uid(),
        node: node.name,
        code,
        granted,
        reason,
        holder,
        tries,
        maxT,
        escalated,
        at: Date.now(),
      };
      set((s) => ({ failedTries: ft, checkLog: [entry, ...s.checkLog].slice(0, 12) }));
      return entry;
    },

    toggleProto: async (id) => {
      const a = get().assets.find((x) => x.id === id);
      if (!a || !a.tracker) return; // safety interlock: needs a tracker
      const next = !a.protoActive;
      if (isLive) {
        try {
          const updated = await setAssetProtocol(id, next);
          set((s) => ({ assets: s.assets.map((x) => (x.id === id ? updated : x)) }));
          logEvent("ASSET", "Security protocol " + (next ? "ACTIVATED" : "deactivated") + " · " + a.name, next ? "var(--ok)" : "var(--muted)");
        } catch (e) {
          logEvent("ASSET", "Protocol change failed · " + errMsg(e), "var(--danger)");
        }
        return;
      }
      set((s) => ({ assets: s.assets.map((x) => (x.id === id ? { ...x, protoActive: next } : x)) }));
      logEvent("ASSET", "Security protocol " + (next ? "ACTIVATED" : "deactivated") + " · " + a.name, next ? "var(--ok)" : "var(--muted)");
    },

    reportBreach: async (id) => {
      const a = get().assets.find((x) => x.id === id);
      if (!a || !a.protoActive) return;
      if (isLive) {
        try {
          await reportAssetBreach(id, a.name + " has left its permitted boundary");
          logEvent("ASSET", a.name + " boundary breach detected → ASRS", "var(--danger)");
          logEvent("ASRS", "Incident auto-created from protocol breach · " + a.name, "var(--danger)");
          try {
            set({ incidents: await fetchReports() });
          } catch {
            /* badge will catch up on next load */
          }
        } catch (e) {
          logEvent("ASSET", "Breach report failed · " + errMsg(e), "var(--danger)");
        }
        return;
      }
      const iid = nextIncidentId(get().incidents);
      const incident: Incident = {
        id: iid,
        source: "assets",
        sev: "high",
        status: "open",
        desc: a.name + " has left its permitted boundary",
        node: "Perimeter",
        investigator: null,
        created: Date.now(),
        images: 0,
        imageUrls: [],
        sourceRef: null,
        log: [{ t: Date.now(), s: "Auto-created by Asset Protocol breach" }],
      };
      set((s) => ({ incidents: [incident, ...s.incidents] }));
      logEvent("ASSET", a.name + " boundary breach detected → ASRS", "var(--danger)");
      logEvent("ASRS", "Incident " + iid + " auto-created from protocol breach", "var(--danger)");
    },

    escalateCam: async (id) => {
      const cam = get().cameras.find((c) => c.id === id);
      if (!cam) return;
      if (isLive) {
        try {
          await escalateCamera(id, "Operator escalation from " + cam.name + " · snapshot attached");
          logEvent("SURVEIL", cam.name + " escalated to ASRS · snapshot attached", "var(--danger)");
          logEvent("ASRS", "Incident created from camera observation · " + cam.name, "var(--danger)");
          try {
            set({ incidents: await fetchReports() });
          } catch {
            /* badge will catch up on next load */
          }
        } catch (e) {
          logEvent("SURVEIL", "Escalation failed · " + errMsg(e), "var(--danger)");
        }
        return;
      }
      const iid = nextIncidentId(get().incidents);
      const incident: Incident = {
        id: iid,
        source: "surveillance",
        sev: "medium",
        status: "open",
        desc: "Operator escalation from " + cam.name + " · snapshot attached",
        node: cam.loc,
        investigator: null,
        created: Date.now(),
        images: 1,
        imageUrls: [],
        sourceRef: null,
        log: [{ t: Date.now(), s: "Escalated from " + cam.name + " (last snapshot attached)" }],
      };
      set((s) => ({ incidents: [incident, ...s.incidents] }));
      logEvent("SURVEIL", cam.name + " escalated to ASRS · snapshot attached", "var(--danger)");
      logEvent("ASRS", "Incident " + iid + " created from camera observation", "var(--danger)");
    },

    openSchedule: () =>
      set({
        showSchedule: true,
        schedule: { host: "Lt. M. Vasquez", visitor: "T. Wallace", date: "14:30", dur: 60, error: "" },
      }),
    closeSchedule: () => set({ showSchedule: false }),
    setSched: (k, v) =>
      set((s) => ({ schedule: { ...s.schedule, [k]: v, error: "" } as ScheduleForm })),
    submitSchedule: async () => {
      const s = get().schedule;
      const maxDur = get().settings.maxApptDuration;
      // client-side pre-check for instant feedback (server enforces authoritatively)
      if (s.dur > maxDur) {
        set((st) => ({ schedule: { ...st.schedule, error: "Duration exceeds facility limit (" + maxDur + " min)" } }));
        return;
      }

      if (isLive) {
        const hostStaffId = get().staff.find((x) => x.name === s.host)?.id;
        const visitorId = get().visitors.find((x) => x.name === s.visitor)?.id;
        if (!hostStaffId || !visitorId) {
          set((st) => ({ schedule: { ...st.schedule, error: "Select a valid host and visitor" } }));
          return;
        }
        // build ISO window from the HH:MM time (today, or tomorrow if already past)
        const start = new Date();
        const m = /^(\d{1,2}):(\d{2})$/.exec(s.date.trim());
        if (m) {
          start.setHours(Number(m[1]), Number(m[2]), 0, 0);
          if (start.getTime() < Date.now()) start.setDate(start.getDate() + 1);
        } else {
          start.setTime(Date.now() + 5 * 60000);
        }
        const end = new Date(start.getTime() + s.dur * 60000);
        try {
          await createAppointment({
            hostStaffId,
            visitorId,
            scheduledAt: start.toISOString(),
            endsAt: end.toISOString(),
          });
          try {
            set({ appointments: await fetchAppointments() });
          } catch {
            /* list refreshes on next load */
          }
          logEvent("APPT", "Appointment booked · " + s.visitor + " ↔ " + s.host + " · host notified by email", "var(--accent)");
          set({ showSchedule: false });
        } catch (e) {
          set((st) => ({ schedule: { ...st.schedule, error: errMsg(e) } }));
        }
        return;
      }

      if (s.host === "Lt. M. Vasquez" && s.date === "14:30") {
        set((st) => ({ schedule: { ...st.schedule, error: "Host double-booked — Lt. Vasquez has an overlapping appointment" } }));
        return;
      }
      logEvent("APPT", "Appointment booked · " + s.visitor + " ↔ " + s.host + " · host notified by email", "var(--accent)");
      set({ showSchedule: false });
    },

    setSetting: (k, v) =>
      set((s) => ({ settings: { ...s.settings, [k]: v } as Settings })),

    // Persist the current settings to the API (live mode). Keys mirror the
    // canonical setting keys; mapSettings() reads them back fuzzily on load.
    saveSettings: async () => {
      if (!isLive) return { ok: true };
      const s = get().settings;
      try {
        await Promise.all([
          putSetting("max_appointment_duration_minutes", s.maxApptDuration),
          putSetting("advance_booking_window_days", s.advanceBooking),
          putSetting("permit_staff_to_staff_appointments", s.staffToStaff),
          putSetting("access_default_max_failed_tries", s.maxFailedTries),
        ]);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errMsg(e) };
      }
    },
  };
});

// ---- derived selectors (computed outside the store) ----
export const openIncidentCount = (incidents: Incident[]) =>
  incidents.filter((i) => i.status === "open").length;
