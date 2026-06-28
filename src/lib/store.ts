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
import type {
  AccessCard,
  AccessNode,
  Appointment,
  Asset,
  Camera,
  CheckLogEntry,
  Density,
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
  tickClock: () => void;
  setTheme: (t: Theme) => void;
  setAccent: (a: string | null) => void;
  setDensity: (d: Density) => void;
  setLiveFeed: (v: boolean) => void;
  maybePushRandom: () => void;

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
  runCheck: () => void;

  toggleProto: (id: string) => void;
  reportBreach: (id: string) => void;
  escalateCam: (id: string) => void;

  openSchedule: () => void;
  closeSchedule: () => void;
  setSched: (k: keyof ScheduleForm, v: string | number) => void;
  submitSchedule: () => void;

  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
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

    tickClock: () => set((s) => ({ tick: s.tick + 1 })),
    setTheme: (theme) => set({ theme }),
    setAccent: (accent) => set({ accent }),
    setDensity: (density) => set({ density }),
    setLiveFeed: (liveFeed) => set({ liveFeed }),

    maybePushRandom: () => {
      if (!get().liveFeed || Math.random() >= 0.62) return;
      const p = RANDOM_FEED_POOL[Math.floor(Math.random() * RANDOM_FEED_POOL.length)];
      set((s) => ({
        feed: [{ id: uid(), at: Date.now(), ...p }, ...s.feed].slice(0, 40),
      }));
    },

    selectIncident: (id) => {
      const i = get().incidents.find((x) => x.id === id);
      set({ selectedIncident: id, resolveText: (i && i.resolution) || "" });
    },
    setIncFilter: (incFilter) => set({ incFilter }),
    setIncSource: (incSource) => set({ incSource }),
    setResolveText: (resolveText) => set({ resolveText }),

    assignIncident: (id) => {
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

    resolveIncident: (id) => {
      const txt = get().resolveText.trim();
      if (!txt) return;
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

    checkIn: (id) => {
      const t = get().visitors.find((x) => x.id === id);
      if (!t) return;
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

    runCheck: () => {
      const { nodeId, code } = get().checkForm;
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node) return;
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
    },

    toggleProto: (id) => {
      const a = get().assets.find((x) => x.id === id);
      if (!a || !a.tracker) return; // safety interlock: needs a tracker
      const next = !a.protoActive;
      set((s) => ({ assets: s.assets.map((x) => (x.id === id ? { ...x, protoActive: next } : x)) }));
      logEvent("ASSET", "Security protocol " + (next ? "ACTIVATED" : "deactivated") + " · " + a.name, next ? "var(--ok)" : "var(--muted)");
    },

    reportBreach: (id) => {
      const a = get().assets.find((x) => x.id === id);
      if (!a || !a.protoActive) return;
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
        log: [{ t: Date.now(), s: "Auto-created by Asset Protocol breach" }],
      };
      set((s) => ({ incidents: [incident, ...s.incidents] }));
      logEvent("ASSET", a.name + " boundary breach detected → ASRS", "var(--danger)");
      logEvent("ASRS", "Incident " + iid + " auto-created from protocol breach", "var(--danger)");
    },

    escalateCam: (id) => {
      const cam = get().cameras.find((c) => c.id === id);
      if (!cam) return;
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
    submitSchedule: () => {
      const s = get().schedule;
      const maxDur = get().settings.maxApptDuration;
      if (s.dur > maxDur) {
        set((st) => ({ schedule: { ...st.schedule, error: "Duration exceeds facility limit (" + maxDur + " min)" } }));
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
  };
});

// ---- derived selectors (computed outside the store) ----
export const openIncidentCount = (incidents: Incident[]) =>
  incidents.filter((i) => i.status === "open").length;
