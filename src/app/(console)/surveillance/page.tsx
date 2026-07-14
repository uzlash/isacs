"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera as CameraIcon,
  ClipboardList,
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useSessionUser } from "@/lib/auth";
import { rel } from "@/lib/format";
import {
  createCamera,
  deleteCamera,
  getCamera,
  updateCamera,
  type ApiCamera,
} from "@/lib/api/cameras";
import {
  getBbiwSsoUrl,
  getBbiwFilters,
  putBbiwFilters,
  syncBbiwCameras,
  getBbiwCameraRules,
  listPois,
  addPoi,
  deletePoi,
  addPoiPhoto,
  deletePoiPhoto,
  poiPhotoUrl,
  listVois,
  addVoi,
  deleteVoi,
  addVoiPhoto,
  deleteVoiPhoto,
  voiPhotoUrl,
  BBIW_RULE_TYPES,
  VOI_COLORS,
  VOI_VEHICLE_TYPES,
  type BbiwFilters,
  type BbiwSeverity,
  type BbiwCameraRule,
  type PoiEntry,
  type VoiEntry,
  type VoiColor,
  type VoiVehicleType,
} from "@/lib/api/bbiw";
import { uploadCameraSnapshot } from "@/lib/api/uploads";
import CameraFeed from "@/components/CameraFeed";
import FacilityKmlMap from "@/components/map/FacilityKmlMap";
import type { Camera } from "@/lib/types";

const WRITE_ROLES = ["super_admin", "security_manager", "staff_admin"];
const BBIW_ROLES = ["super_admin", "security_manager"];
const BBIW_ACCENT = "#a371f7";

// The SSO url is built server-side from the configured BBIW orchestrator host,
// which may be a docker-internal name (e.g. host.docker.internal) only
// resolvable from the backend's network — rewrite it to something the user's
// own browser can actually reach before opening a tab to it.
function toOpenableUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "host.docker.internal") u.hostname = "127.0.0.1";
    return u.toString();
  } catch {
    return url;
  }
}

// Fetch a one-time SSO URL and open the BBIW dashboard in a new tab.
// The SSO link always lands on the BBIW root and sets the session cookie; for a
// camera deep-link we can't combine them (the token-login endpoint redirects to
// "/"), so when a camera path is given we open SSO to authenticate, then open
// the deep-linked page in a second tab a moment later — both in the BBIW origin.
async function openBbiw(setBusy?: (b: boolean) => void, deepLinkPath?: string) {
  setBusy?.(true);
  try {
    const url = toOpenableUrl(await getBbiwSsoUrl());
    const win = window.open(url, "_blank", "noopener");
    if (deepLinkPath) {
      try {
        const origin = new URL(url).origin; // BBIW host
        const target = origin + (deepLinkPath.startsWith("/") ? deepLinkPath : "/" + deepLinkPath);
        // give SSO a beat to set the session cookie, then open the camera page
        setTimeout(() => window.open(target, "_blank", "noopener"), 1200);
      } catch {
        /* malformed path/url — the root SSO tab still opened */
      }
    }
    if (!win) alert("Pop-up blocked — allow pop-ups for ISACS to open BBIW.");
  } catch (e) {
    alert(e instanceof Error ? e.message : "BBIW is not available.");
  } finally {
    setBusy?.(false);
  }
}

type Modal =
  | { kind: "create" }
  | { kind: "edit"; cam: Camera }
  | { kind: "feed"; cam: Camera }
  | { kind: "bbiwFilters" }
  | { kind: "bbiwWatchlist" }
  | { kind: "bbiwRules"; cam: Camera };

export default function SurveillancePage() {
  useStore((s) => s.tick);
  const cameras = useStore((s) => s.cameras);
  const escalate = useStore((s) => s.escalateCam);
  const user = useSessionUser();
  const canWrite = !!user && WRITE_ROLES.includes(user.role);
  const canBbiw = !!user && BBIW_ROLES.includes(user.role);
  const canSyncBbiw = user?.role === "super_admin";

  const [modal, setModal] = useState<Modal | null>(null);
  const [bbiwBusy, setBbiwBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);

  const syncBbiw = async () => {
    setSyncBusy(true);
    try {
      const { result, message } = await syncBbiwCameras();
      alert(message || `Synced ${result.synced} camera(s) to BBIW.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to sync cameras to BBIW.");
    } finally {
      setSyncBusy(false);
    }
  };

  const remove = async (c: Camera) => {
    if (!confirm(`Delete camera "${c.name}" (${c.loc})? This removes its feed and snapshot history.`)) return;
    try {
      await deleteCamera(c.id);
      await useStore.getState().refreshCameras();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete camera");
    }
  };

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span className="mono" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".7px", color: "var(--faint)" }}>
          AUTO-SNAPSHOT EVERY 5 MIN · STORED ON-PREM (MinIO)
        </span>
        <div style={{ flex: 1 }} />
        {canBbiw && (
          <>
            <button
              onClick={() => setModal({ kind: "bbiwFilters" })}
              className="mono"
              style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${BBIW_ACCENT}`, color: BBIW_ACCENT, borderRadius: 7, cursor: "pointer" }}
            >
              <SlidersHorizontal size={13} strokeWidth={2.2} /> DETECTION FILTERS
            </button>
            <button
              onClick={() => setModal({ kind: "bbiwWatchlist" })}
              className="mono"
              title="Manage Persons/Vehicles of Interest"
              style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${BBIW_ACCENT}`, color: BBIW_ACCENT, borderRadius: 7, cursor: "pointer" }}
            >
              <ShieldAlert size={13} strokeWidth={2.2} /> WATCHLIST
            </button>
            <button
              onClick={() => void openBbiw(setBbiwBusy)}
              disabled={bbiwBusy}
              className="mono"
              title="Open the BBIW AI video dashboard"
              style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${BBIW_ACCENT}`, color: BBIW_ACCENT, borderRadius: 7, cursor: bbiwBusy ? "default" : "pointer", opacity: bbiwBusy ? 0.6 : 1 }}
            >
              <Sparkles size={13} strokeWidth={2.2} /> {bbiwBusy ? "OPENING…" : "OPEN BBIW DASHBOARD"} <ExternalLink size={12} strokeWidth={2.2} />
            </button>
          </>
        )}
        {canSyncBbiw && (
          <button
            onClick={() => void syncBbiw()}
            disabled={syncBusy}
            className="mono"
            title="Push all cameras to BBIW"
            style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${BBIW_ACCENT}`, color: BBIW_ACCENT, borderRadius: 7, cursor: syncBusy ? "default" : "pointer", opacity: syncBusy ? 0.6 : 1 }}
          >
            <RefreshCw size={13} strokeWidth={2.2} className={syncBusy ? "isacs-spin" : undefined} /> {syncBusy ? "SYNCING…" : "SYNC TO BBIW"}
          </button>
        )}
        {canWrite && (
          <button onClick={() => setModal({ kind: "create" })} className="btn-accent" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} strokeWidth={2.4} /> ADD CAMERA
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {cameras.map((c) => {
          const tone = c.active ? "var(--ok)" : "var(--faint)";
          return (
            <div key={c.id} className="panel" style={{ overflow: "hidden" }}>
              {/* live feed — MJPEG (ffmpeg) with snapshot fallback */}
              <div style={{ position: "relative" }}>
                <CameraFeed
                  cameraId={c.id}
                  active={c.active}
                  snapshotUrl={c.snapUrl}
                  onMaximize={() => setModal({ kind: "feed", cam: c })}
                />
                <div className="mono" style={{ position: "absolute", bottom: 7, right: 8, font: "500 8px var(--font-mono-stack)", color: "#cbd5e1", textShadow: "0 1px 3px #000", zIndex: 2, pointerEvents: "none" }}>
                  L{c.level}
                </div>
              </div>

              {/* meta */}
              <div style={{ padding: "11px 13px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 11.5px var(--font-sans-stack)", color: "var(--fg)" }}>{c.name}</div>
                    <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)", marginTop: 2 }}>{c.loc}</div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <IconBtn onClick={() => setModal({ kind: "bbiwRules", cam: c })} title="View BBIW detection rules">
                      <ClipboardList size={12} strokeWidth={1.9} />
                    </IconBtn>
                    {canBbiw && <BbiwCameraButton cameraId={c.id} />}
                    {canWrite && (
                      <>
                        <SnapshotButton cameraId={c.id} />
                        <IconBtn onClick={() => setModal({ kind: "edit", cam: c })} title="Edit"><Pencil size={12} strokeWidth={1.9} /></IconBtn>
                        <IconBtn onClick={() => remove(c)} title="Delete" tone="var(--danger)"><Trash2 size={12} strokeWidth={1.9} /></IconBtn>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <span className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--muted)" }}>snap {rel(c.snap)} ago</span>
                  <button
                    onClick={() => escalate(c.id)}
                    className="mono"
                    style={{
                      font: "600 9px var(--font-mono-stack)",
                      letterSpacing: ".4px",
                      color: "var(--danger)",
                      background: "transparent",
                      border: "1px solid var(--danger)",
                      borderRadius: 6,
                      padding: "4px 9px",
                      cursor: "pointer",
                    }}
                  >
                    ⚑ ESCALATE
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal?.kind === "create" && (
        <CameraForm
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void useStore.getState().refreshCameras();
          }}
        />
      )}

      {modal?.kind === "edit" && (
        <CameraForm
          cam={modal.cam}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void useStore.getState().refreshCameras();
          }}
        />
      )}

      {modal?.kind === "bbiwFilters" && (
        <BbiwFiltersModal onClose={() => setModal(null)} />
      )}

      {modal?.kind === "bbiwWatchlist" && (
        <BbiwWatchlistModal onClose={() => setModal(null)} />
      )}

      {modal?.kind === "bbiwRules" && (
        <BbiwRulesModal cam={modal.cam} onClose={() => setModal(null)} />
      )}

      {modal?.kind === "feed" && (
        <FeedModal cam={modal.cam} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// Maximized single-camera view.
function FeedModal({ cam, onClose }: { cam: Camera; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(1100px, 96vw)", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 12, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.6)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>{cam.name}</span>
          <span className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)" }}>{cam.loc} · L{cam.level}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} className="mono" style={{ background: "none", border: "1px solid var(--border2)", borderRadius: 7, color: "var(--muted)", cursor: "pointer", font: "600 10px var(--font-mono-stack)", padding: "5px 11px" }}>CLOSE ✕</button>
        </div>
        <div style={{ background: "#000" }}>
          <CameraFeed cameraId={cam.id} active={cam.active} snapshotUrl={cam.snapUrl} pollMs={1000} />
        </div>
      </div>
    </div>
  );
}

// ---- BBIW detection filters ----
const SEVERITY_OPTIONS: { label: string; value: BbiwSeverity | null }[] = [
  { label: "None", value: null },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
];

function BbiwFiltersModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [minSeverity, setMinSeverity] = useState<BbiwSeverity | null>(null);
  // Explicit allow-list of rule types. Empty set = allow all (sent as null).
  const [allowed, setAllowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const f: BbiwFilters = await getBbiwFilters();
        if (cancelled) return;
        setMinSeverity(f.minSeverity);
        setAllowed(new Set(f.allowedRuleTypes ?? []));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load filters");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (rule: string) => {
    setAllowed((prev) => {
      const next = new Set(prev);
      if (next.has(rule)) next.delete(rule);
      else next.add(rule);
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await putBbiwFilters({
        minSeverity,
        allowedRuleTypes: allowed.size ? Array.from(allowed) : null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save filters");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="BBIW · Detection filters" onClose={() => !busy && onClose()} accent={BBIW_ACCENT}>
      {loading ? (
        <div style={{ padding: "10px 0", textAlign: "center", color: "var(--faint)", font: "500 12px var(--font-sans-stack)" }}>Loading filters…</div>
      ) : (
        <>
          <Field label="MINIMUM SEVERITY">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {SEVERITY_OPTIONS.map((opt) => {
                const on = minSeverity === opt.value;
                return (
                  <button
                    key={opt.label}
                    onClick={() => setMinSeverity(opt.value)}
                    className="mono"
                    style={{
                      font: "600 10px var(--font-mono-stack)",
                      letterSpacing: ".4px",
                      padding: "6px 12px",
                      borderRadius: 7,
                      cursor: "pointer",
                      border: on ? `1px solid ${BBIW_ACCENT}` : "1px solid var(--border2)",
                      background: on ? `color-mix(in srgb, ${BBIW_ACCENT} 15%, transparent)` : "transparent",
                      color: on ? BBIW_ACCENT : "var(--muted)",
                    }}
                  >
                    {opt.label.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)", marginTop: 6 }}>
              “None” = all severities forwarded.
            </div>
          </Field>

          <Field label="ALLOWED RULE TYPES">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {BBIW_RULE_TYPES.map((rule) => {
                const on = allowed.has(rule);
                const recommended = rule === "poi_detected" || rule === "voi_detected";
                return (
                  <button
                    key={rule}
                    onClick={() => toggle(rule)}
                    className="mono"
                    title={recommended ? "Recommended: keep enabled — watchlist matches are high-value" : undefined}
                    style={{
                      font: "600 10px var(--font-mono-stack)",
                      letterSpacing: ".3px",
                      padding: "6px 11px",
                      borderRadius: 999,
                      cursor: "pointer",
                      border: on ? `1px solid ${BBIW_ACCENT}` : "1px solid var(--border2)",
                      background: on ? `color-mix(in srgb, ${BBIW_ACCENT} 15%, transparent)` : "transparent",
                      color: on ? BBIW_ACCENT : "var(--muted)",
                    }}
                  >
                    {rule}{recommended ? " ★" : ""}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 7, gap: 10 }}>
              <span className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)" }}>
                {allowed.size ? "Only checked rule types forwarded. ★ = recommended" : "All rule types — none selected = all allowed."}
              </span>
              {allowed.size > 0 && (
                <button
                  onClick={() => setAllowed(new Set())}
                  className="mono"
                  style={{ font: "600 9px var(--font-mono-stack)", letterSpacing: ".4px", color: "var(--muted)", background: "transparent", border: "1px solid var(--border2)", borderRadius: 6, padding: "4px 9px", cursor: "pointer", flexShrink: 0 }}
                >
                  CLEAR (ALLOW ALL)
                </button>
              )}
            </div>
          </Field>

          {error && <Err>{error}</Err>}
          <button
            onClick={save}
            disabled={busy}
            className="mono"
            style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", borderRadius: 9, cursor: busy ? "default" : "pointer", border: `1px solid ${BBIW_ACCENT}`, background: `color-mix(in srgb, ${BBIW_ACCENT} 18%, transparent)`, color: BBIW_ACCENT, opacity: busy ? 0.7 : 1 }}
          >
            {busy ? "SAVING…" : "SAVE FILTERS"}
          </button>
        </>
      )}
    </Shell>
  );
}

// ---- BBIW camera rules (read-only "what's being monitored") ----
function BbiwRulesModal({ cam, onClose }: { cam: Camera; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rules, setRules] = useState<BbiwCameraRule[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getBbiwCameraRules(cam.id);
        if (!cancelled) setRules(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load camera rules");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cam.id]);

  return (
    <Shell title={`BBIW · Rules · ${cam.name}`} onClose={onClose} accent={BBIW_ACCENT}>
      {loading ? (
        <Loading text="Loading camera rules…" />
      ) : error ? (
        <Err>{error}</Err>
      ) : rules.length === 0 ? (
        <Empty text="No detection rules configured for this camera yet. Rule authoring is done in the BBIW dashboard." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rules.map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--border2)", borderRadius: 9, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: r.enabled ? "var(--ok)" : "var(--faint)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ font: "600 12px var(--font-sans-stack)", color: "var(--fg)", textTransform: "capitalize" }}>
                  {r.type.replace(/_/g, " ")}
                </span>
                <div style={{ flex: 1 }} />
                <span className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)" }}>
                  cooldown {r.cooldown_s}s
                </span>
              </div>
              {r.config && Object.keys(r.config).length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {Object.entries(r.config).map(([k, v]) => (
                    <RulesChip key={k}>
                      {k} · {String(v)}
                    </RulesChip>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

function RulesChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--muted)", background: "var(--panel2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "3px 8px" }}
    >
      {children}
    </span>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div style={{ padding: "16px 0", textAlign: "center", color: "var(--faint)", font: "500 12px var(--font-sans-stack)" }}>{text}</div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: "16px 0", textAlign: "center", color: "var(--faint)", font: "500 12px var(--font-sans-stack)", lineHeight: 1.5 }}>{text}</div>
  );
}

// ---- BBIW watchlist — Persons & Vehicles of Interest ----
function BbiwWatchlistModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"poi" | "voi">("poi");
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 640, maxWidth: "100%", background: "var(--panel)", border: `1px solid ${BBIW_ACCENT}`, borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden", maxHeight: "88vh", display: "flex", flexDirection: "column" }}
      >
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ font: "600 13px var(--font-sans-stack)", color: BBIW_ACCENT }}>BBIW · Watchlist</span>
          <div style={{ display: "flex", gap: 4 }}>
            {(["poi", "voi"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="mono"
                style={{
                  font: "600 10px var(--font-mono-stack)",
                  letterSpacing: ".4px",
                  padding: "6px 12px",
                  borderRadius: 7,
                  cursor: "pointer",
                  border: tab === t ? `1px solid ${BBIW_ACCENT}` : "1px solid var(--border2)",
                  background: tab === t ? `color-mix(in srgb, ${BBIW_ACCENT} 15%, transparent)` : "transparent",
                  color: tab === t ? BBIW_ACCENT : "var(--muted)",
                }}
              >
                {t === "poi" ? "PERSONS" : "VEHICLES"}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 18, overflowY: "auto" }}>{tab === "poi" ? <PoiPanel /> : <VoiPanel />}</div>
      </div>
    </div>
  );
}

// Adding an entry alone doesn't turn on matching — the camera also needs a
// poi_detected/voi_detected rule, which is still authored in the BBIW dashboard.
function WatchlistRuleHint({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mono" style={{ flex: 1, font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)", lineHeight: 1.6 }}>
      Matched automatically once a camera has a &ldquo;{label}&rdquo; rule enabled — set that up in{" "}
      <button
        onClick={() => void openBbiw(setBusy)}
        disabled={busy}
        className="mono"
        style={{ background: "none", border: "none", padding: 0, color: BBIW_ACCENT, textDecoration: "underline", cursor: busy ? "default" : "pointer", font: "inherit" }}
      >
        {busy ? "opening…" : "the BBIW dashboard"}
      </button>{" "}
      (camera → Rules → add &ldquo;{label}&rdquo;).
    </div>
  );
}

function AddToggleButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mono"
      style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".4px", padding: "6px 11px", borderRadius: 7, cursor: "pointer", border: `1px solid ${BBIW_ACCENT}`, background: "transparent", color: BBIW_ACCENT, display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}
    >
      <Plus size={12} strokeWidth={2.4} /> {label}
    </button>
  );
}

function PoiPanel() {
  const [items, setItems] = useState<PoiEntry[] | null>(null);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    try {
      setItems(await listPois());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load persons of interest");
    }
  };
  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from the persons of interest watchlist?`)) return;
    try {
      await deletePoi(id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove entry");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <WatchlistRuleHint label="Person of Interest" />
        <AddToggleButton label="ADD PERSON" onClick={() => setShowAdd((s) => !s)} />
      </div>

      {showAdd && (
        <AddPoiForm
          onAdded={() => {
            setShowAdd(false);
            void load();
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {error && <Err>{error}</Err>}
      {items === null && !error && <Loading text="Loading persons of interest…" />}
      {items && items.length === 0 && <Empty text="No persons of interest yet." />}
      {items &&
        items.map((p) => (
          <WatchlistRow
            key={p.id}
            photoUrl={p.photo_count > 0 ? poiPhotoUrl(p.id, 0) : null}
            title={p.name}
            badges={p.dangerous ? [{ label: "DANGEROUS", tone: "var(--danger)" }] : []}
            meta={`${p.photo_count} photo${p.photo_count === 1 ? "" : "s"}`}
            expanded={expanded === p.id}
            onToggleExpand={() => setExpanded(expanded === p.id ? null : p.id)}
            onDelete={() => void remove(p.id, p.name)}
          >
            <PhotoManager
              count={p.photo_count}
              minKeep={1}
              photoUrl={(i) => poiPhotoUrl(p.id, i)}
              onAdd={(file) => addPoiPhoto(p.id, file)}
              onDelete={(i) => deletePoiPhoto(p.id, i)}
              onChanged={load}
            />
          </WatchlistRow>
        ))}
    </div>
  );
}

function AddPoiForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [dangerous, setDangerous] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return setError("Name is required.");
    if (!photo) return setError("A reference photo is required.");
    setBusy(true);
    setError("");
    try {
      await addPoi({ name: name.trim(), dangerous, photo });
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add person");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid var(--border2)", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <Field label="NAME">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Smith" autoFocus />
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <input type="checkbox" checked={dangerous} onChange={(e) => setDangerous(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--danger)" }} />
        <span style={{ font: "500 11.5px var(--font-sans-stack)", color: "var(--fg)" }}>Flag as dangerous</span>
        <span className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)" }}>· shown as a red badge on matching alerts</span>
      </label>
      <Field label="REFERENCE PHOTO">
        <PhotoPicker file={photo} onPick={setPhoto} required />
      </Field>
      {error && <Err>{error}</Err>}
      <FormActions busy={busy} onSubmit={submit} onCancel={onCancel} submitLabel="ADD" busyLabel="ADDING…" />
    </div>
  );
}

function VoiPanel() {
  const [items, setItems] = useState<VoiEntry[] | null>(null);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    try {
      setItems(await listVois());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vehicles of interest");
    }
  };
  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from the vehicles of interest watchlist?`)) return;
    try {
      await deleteVoi(id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove entry");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <WatchlistRuleHint label="Vehicle of Interest" />
        <AddToggleButton label="ADD VEHICLE" onClick={() => setShowAdd((s) => !s)} />
      </div>

      {showAdd && (
        <AddVoiForm
          onAdded={() => {
            setShowAdd(false);
            void load();
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {error && <Err>{error}</Err>}
      {items === null && !error && <Loading text="Loading vehicles of interest…" />}
      {items && items.length === 0 && <Empty text="No vehicles of interest yet." />}
      {items &&
        items.map((v) => {
          const badges: { label: string; tone: string }[] = [];
          if (v.plate_number) badges.push({ label: v.plate_number, tone: "var(--muted)" });
          if (v.color) badges.push({ label: v.color, tone: "var(--muted)" });
          if (v.vehicle_type) badges.push({ label: v.vehicle_type, tone: "var(--muted)" });
          return (
            <WatchlistRow
              key={v.id}
              photoUrl={v.photo_count > 0 ? voiPhotoUrl(v.id, 0) : null}
              title={v.name}
              badges={badges}
              meta={`${v.photo_count} photo${v.photo_count === 1 ? "" : "s"}`}
              expanded={expanded === v.id}
              onToggleExpand={() => setExpanded(expanded === v.id ? null : v.id)}
              onDelete={() => void remove(v.id, v.name)}
            >
              <PhotoManager
                count={v.photo_count}
                minKeep={0}
                photoUrl={(i) => voiPhotoUrl(v.id, i)}
                onAdd={(file) => addVoiPhoto(v.id, file)}
                onDelete={(i) => deleteVoiPhoto(v.id, i)}
                onChanged={load}
              />
            </WatchlistRow>
          );
        })}
    </div>
  );
}

function AddVoiForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [color, setColor] = useState<VoiColor | "">("");
  const [vehicleType, setVehicleType] = useState<VoiVehicleType | "">("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return setError("Name is required.");
    if (!plateNumber.trim() && !color && !vehicleType) {
      return setError("Set at least a plate number, color, or vehicle type so this entry can be matched.");
    }
    setBusy(true);
    setError("");
    try {
      await addVoi({
        name: name.trim(),
        plate_number: plateNumber.trim() || undefined,
        color: color || undefined,
        vehicle_type: vehicleType || undefined,
        photo: photo || undefined,
      });
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add vehicle");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid var(--border2)", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <Field label="NAME">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g. "Suspect vehicle #3"' autoFocus />
      </Field>
      <Field label="PLATE NUMBER (OPTIONAL)">
        <input className="input mono" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="e.g. ABC-123" />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="COLOR (OPTIONAL)">
            <select className="input" value={color} onChange={(e) => setColor(e.target.value as VoiColor | "")}>
              <option value="">—</option>
              {VOI_COLORS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="VEHICLE TYPE (OPTIONAL)">
            <select className="input" value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VoiVehicleType | "")}>
              <option value="">—</option>
              {VOI_VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <Field label="REFERENCE PHOTO (OPTIONAL)">
        <PhotoPicker file={photo} onPick={setPhoto} />
      </Field>
      {error && <Err>{error}</Err>}
      <FormActions busy={busy} onSubmit={submit} onCancel={onCancel} submitLabel="ADD" busyLabel="ADDING…" />
    </div>
  );
}

function FormActions({ busy, onSubmit, onCancel, submitLabel, busyLabel }: { busy: boolean; onSubmit: () => void; onCancel: () => void; submitLabel: string; busyLabel: string }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={onSubmit}
        disabled={busy}
        className="mono"
        style={{ flex: 1, height: 36, font: "600 10.5px var(--font-mono-stack)", letterSpacing: ".5px", borderRadius: 8, cursor: busy ? "default" : "pointer", border: `1px solid ${BBIW_ACCENT}`, background: `color-mix(in srgb, ${BBIW_ACCENT} 18%, transparent)`, color: BBIW_ACCENT, opacity: busy ? 0.7 : 1 }}
      >
        {busy ? busyLabel : submitLabel}
      </button>
      <button
        onClick={onCancel}
        disabled={busy}
        className="mono"
        style={{ height: 36, padding: "0 14px", font: "600 10.5px var(--font-mono-stack)", borderRadius: 8, cursor: "pointer", border: "1px solid var(--border2)", background: "transparent", color: "var(--muted)" }}
      >
        CANCEL
      </button>
    </div>
  );
}

function PhotoPicker({ file, onPick, required }: { file: File | null; onPick: (f: File | null) => void; required?: boolean }) {
  const ref = useRef<HTMLInputElement | null>(null);
  const prevUrl = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const pick = (f: File | null | undefined) => {
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
    const url = f ? URL.createObjectURL(f) : null;
    prevUrl.current = url;
    setPreview(url);
    onPick(f ?? null);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        onClick={() => ref.current?.click()}
        style={{ width: 52, height: 52, borderRadius: 9, border: "1px dashed var(--border2)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer", flexShrink: 0 }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <ImagePlus size={17} strokeWidth={1.7} color="var(--faint)" />
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <button type="button" onClick={() => ref.current?.click()} className="btn" style={{ height: 28, padding: "0 10px", font: "600 9px var(--font-mono-stack)" }}>
          {file ? "REPLACE" : "CHOOSE FILE"}
        </button>
        <span className="mono" style={{ font: "500 8px var(--font-mono-stack)", color: "var(--faint)" }}>
          JPEG/PNG · max 10MB{required ? "" : " · optional"}
        </span>
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png" style={{ display: "none" }} onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

function WatchlistRow({
  photoUrl,
  title,
  badges,
  meta,
  expanded,
  onToggleExpand,
  onDelete,
  children,
}: {
  photoUrl: string | null;
  title: string;
  badges: { label: string; tone: string }[];
  meta: React.ReactNode;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ border: "1px solid var(--border2)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", background: "var(--bg)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <ImagePlus size={15} strokeWidth={1.6} color="var(--faint)" />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ font: "600 12px var(--font-sans-stack)", color: "var(--fg)" }}>{title}</span>
            {badges.map((b) => (
              <span
                key={b.label}
                className="mono"
                style={{ font: "700 8px var(--font-mono-stack)", letterSpacing: ".5px", color: b.tone, border: `1px solid ${b.tone}`, borderRadius: 4, padding: "2px 6px", textTransform: "uppercase" }}
              >
                {b.label}
              </span>
            ))}
          </div>
          <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)", marginTop: 2 }}>{meta}</div>
        </div>
        <button
          onClick={onToggleExpand}
          className="mono"
          style={{ font: "600 9px var(--font-mono-stack)", letterSpacing: ".4px", color: "var(--muted)", background: "transparent", border: "1px solid var(--border2)", borderRadius: 6, padding: "5px 9px", cursor: "pointer", flexShrink: 0 }}
        >
          {expanded ? "HIDE PHOTOS" : "PHOTOS"}
        </button>
        <IconBtn onClick={onDelete} title="Remove" tone="var(--danger)"><Trash2 size={12} strokeWidth={1.9} /></IconBtn>
      </div>
      {expanded && <div style={{ padding: "0 12px 12px" }}>{children}</div>}
    </div>
  );
}

function PhotoManager({
  count,
  minKeep,
  photoUrl,
  onAdd,
  onDelete,
  onChanged,
}: {
  count: number;
  minKeep: number;
  photoUrl: (index: number) => string;
  onAdd: (file: File) => Promise<void>;
  onDelete: (index: number) => Promise<void>;
  onChanged: () => Promise<void> | void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const addFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await onAdd(file);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add photo");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const removeAt = async (index: number) => {
    if (count <= minKeep) return;
    if (!confirm("Remove this photo?")) return;
    setBusy(true);
    setError("");
    try {
      await onDelete(index);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove photo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ position: "relative", width: 56, height: 56, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border2)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(i)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button
              onClick={() => void removeAt(i)}
              disabled={busy || count <= minKeep}
              title={count <= minKeep ? `Must keep at least ${minKeep} photo` : "Remove photo"}
              style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "rgba(0,0,0,.6)", border: "none", color: count <= minKeep ? "rgba(255,255,255,.35)" : "#fff", cursor: count <= minKeep ? "default" : "pointer" }}
            >
              <X size={11} strokeWidth={2.4} />
            </button>
          </div>
        ))}
        <button
          onClick={() => ref.current?.click()}
          disabled={busy}
          title="Add photo"
          style={{ width: 56, height: 56, borderRadius: 8, border: "1px dashed var(--border2)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", cursor: busy ? "default" : "pointer", color: "var(--faint)" }}
        >
          {busy ? <Loader2 size={16} className="isacs-spin" /> : <Plus size={16} strokeWidth={2} />}
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 7 }}>
          <Err>{error}</Err>
        </div>
      )}
      <input ref={ref} type="file" accept="image/jpeg,image/png" style={{ display: "none" }} onChange={(e) => void addFile(e.target.files?.[0])} />
    </div>
  );
}

// ---- shared create/edit form ----
function CameraForm({ cam, onClose, onSaved }: { cam?: Camera; onClose: () => void; onSaved: () => void }) {
  const editing = !!cam;

  const [loading, setLoading] = useState(editing);
  const [name, setName] = useState(cam?.name ?? "");
  const [rtspPath, setRtspPath] = useState("");
  const [adminDashboardPath, setAdminDashboardPath] = useState("");
  const [location, setLocation] = useState(cam?.loc ?? "");
  const [level, setLevel] = useState(cam ? String(cam.level) : "0");
  const [longitude, setLongitude] = useState("");
  const [latitude, setLatitude] = useState("");
  const [isActive, setIsActive] = useState(cam?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // On edit, fetch full record to prefill fields the view-model doesn't carry.
  useEffect(() => {
    if (!cam) return;
    let cancelled = false;
    (async () => {
      try {
        const full: ApiCamera = await getCamera(cam.id);
        if (cancelled) return;
        setName(full.name);
        setRtspPath(full.rtspPath);
        setAdminDashboardPath(full.adminDashboardPath ?? "");
        setLocation(full.location);
        setLevel(String(full.level));
        setLongitude(full.longitude != null ? String(full.longitude) : "");
        setLatitude(full.latitude != null ? String(full.latitude) : "");
        setIsActive(full.isActive);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load camera");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cam]);

  const numOrUndef = (v: string): number | undefined => {
    const t = v.trim();
    if (!t) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  };

  const submit = async () => {
    if (!name.trim()) return setError("Name is required.");
    if (!rtspPath.trim()) return setError("RTSP stream path is required.");
    if (!location.trim()) return setError("Location is required.");
    setBusy(true);
    setError("");
    try {
      if (editing && cam) {
        await updateCamera(cam.id, {
          name: name.trim(),
          rtspPath: rtspPath.trim(),
          adminDashboardPath: adminDashboardPath.trim() || undefined,
          location: location.trim(),
          level: numOrUndef(level),
          isActive,
          longitude: numOrUndef(longitude),
          latitude: numOrUndef(latitude),
        });
      } else {
        await createCamera({
          name: name.trim(),
          rtspPath: rtspPath.trim(),
          adminDashboardPath: adminDashboardPath.trim() || undefined,
          location: location.trim(),
          longitude: numOrUndef(longitude),
          latitude: numOrUndef(latitude),
          level: numOrUndef(level) ?? 0,
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save camera");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={editing ? `Edit · ${cam!.name}` : "Add camera"} onClose={() => !busy && onClose()}>
      {loading ? (
        <div style={{ padding: "10px 0", textAlign: "center", color: "var(--faint)", font: "500 12px var(--font-sans-stack)" }}>Loading camera…</div>
      ) : (
        <>
          <Field label="NAME">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Gate Cam" autoFocus />
          </Field>
          <Field label="RTSP STREAM PATH">
            <input className="input mono" value={rtspPath} onChange={(e) => setRtspPath(e.target.value)} placeholder="rtsp://…" />
          </Field>
          <Field label="BBIW STREAM PATH (OPTIONAL)">
            <input className="input mono" value={adminDashboardPath} onChange={(e) => setAdminDashboardPath(e.target.value)} placeholder="e.g. /cameras/3" />
            <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)", marginTop: 5, lineHeight: 1.5 }}>
              This camera&apos;s page inside the BBIW dashboard. Used to deep-link &ldquo;View in BBIW&rdquo;.
            </div>
          </Field>
          <Field label="LOCATION">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. North Perimeter" />
          </Field>
          <Field label="LEVEL (OPTIONAL)">
            <input className="input mono" type="number" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="0" />
          </Field>

          {/* Pinpoint the camera on the facility map — click to fill lat/lng. */}
          <Field label="LOCATION ON MAP (OPTIONAL)">
            <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)", marginBottom: 7, lineHeight: 1.5 }}>
              Click where the camera is mounted — its coordinates are captured below.
            </div>
            <FacilityKmlMap
              height={260}
              showSwitcher={false}
              onMapClick={(lat, lng) => { setLatitude(String(lat)); setLongitude(String(lng)); }}
              marker={
                Number.isFinite(Number(latitude)) && latitude.trim() && Number.isFinite(Number(longitude)) && longitude.trim()
                  ? { lat: Number(latitude), lng: Number(longitude) }
                  : null
              }
            />
          </Field>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="LONGITUDE (OPTIONAL)">
                <input className="input mono" type="number" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="click map or type" />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="LATITUDE (OPTIONAL)">
                <input className="input mono" type="number" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="click map or type" />
              </Field>
            </div>
          </div>
          {editing && (
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
              <span style={{ font: "500 12px var(--font-sans-stack)", color: "var(--fg)" }}>Active</span>
              <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>· inactive cameras stop pulling the feed</span>
            </label>
          )}
          {error && <Err>{error}</Err>}
          <button onClick={submit} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
            {busy ? (editing ? "SAVING…" : "ADDING…") : editing ? "SAVE CHANGES" : "ADD CAMERA"}
          </button>
        </>
      )}
    </Shell>
  );
}

// ---- shared bits ----
function Shell({ title, onClose, children, accent }: { title: string; onClose: () => void; children: React.ReactNode; accent?: string }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: "100%", background: "var(--panel)", border: `1px solid ${accent || "var(--border2)"}`, borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
          <span style={{ font: "600 13px var(--font-sans-stack)", color: accent || "var(--fg)" }}>{title}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 13 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="field-label" style={{ marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

function Err({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" style={{ font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>⚠ {children}</div>
  );
}

function IconBtn({ children, onClick, title, tone }: { children: React.ReactNode; onClick: () => void; title: string; tone?: string }) {
  return (
    <button onClick={onClick} title={title} className="mono" style={{ height: 28, minWidth: 28, padding: "0 7px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 6, cursor: "pointer", background: "transparent", border: `1px solid ${tone ? tone : "var(--border2)"}`, color: tone ? tone : "var(--muted)" }}>
      {children}
    </button>
  );
}

// "View in BBIW" for one camera: fetch its BBIW stream path (adminDashboardPath),
// then open SSO + deep-link. Falls back to the dashboard root if no path is set.
function BbiwCameraButton({ cameraId }: { cameraId: string }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const full = await getCamera(cameraId);
      await openBbiw(undefined, full.adminDashboardPath ?? undefined);
    } catch {
      await openBbiw(); // couldn't read the path — open BBIW root
    } finally {
      setBusy(false);
    }
  };
  return (
    <IconBtn onClick={() => void open()} title={busy ? "Opening BBIW…" : "View in BBIW"} tone={BBIW_ACCENT}>
      <ExternalLink size={12} strokeWidth={1.9} />
    </IconBtn>
  );
}

// Upload a JPEG snapshot for a camera (raw image/jpeg body). Overwrites the
// previous snapshot; refreshes the camera list so the timestamp updates.
function SnapshotButton({ cameraId }: { cameraId: string }) {
  const ref = useRef<HTMLInputElement | null>(null);
  const refreshCameras = useStore((s) => s.refreshCameras);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await uploadCameraSnapshot(cameraId, file);
      await refreshCameras();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Snapshot upload failed (camera must be active)");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <IconBtn onClick={() => ref.current?.click()} title={busy ? "Uploading…" : "Upload snapshot (JPEG)"}>
        <CameraIcon size={12} strokeWidth={1.9} />
      </IconBtn>
      <input ref={ref} type="file" accept="image/jpeg" style={{ display: "none" }} onChange={(e) => void onFile(e.target.files?.[0])} />
    </>
  );
}
