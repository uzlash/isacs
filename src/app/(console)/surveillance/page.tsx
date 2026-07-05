"use client";

import { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, ExternalLink, Pencil, Plus, Sparkles, SlidersHorizontal, Trash2 } from "lucide-react";
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
  BBIW_RULE_TYPES,
  type BbiwFilters,
  type BbiwSeverity,
} from "@/lib/api/bbiw";
import { uploadCameraSnapshot } from "@/lib/api/uploads";
import type { Camera } from "@/lib/types";

const WRITE_ROLES = ["super_admin", "security_manager", "staff_admin"];
const BBIW_ROLES = ["super_admin", "security_manager"];
const BBIW_ACCENT = "#a371f7";

// Fetch a one-time SSO URL and open the BBIW dashboard in a new tab.
// The SSO link always lands on the BBIW root and sets the session cookie; for a
// camera deep-link we can't combine them (the token-login endpoint redirects to
// "/"), so when a camera path is given we open SSO to authenticate, then open
// the deep-linked page in a second tab a moment later — both in the BBIW origin.
async function openBbiw(setBusy?: (b: boolean) => void, deepLinkPath?: string) {
  setBusy?.(true);
  try {
    const url = await getBbiwSsoUrl();
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
  | { kind: "bbiwFilters" };

export default function SurveillancePage() {
  useStore((s) => s.tick);
  const cameras = useStore((s) => s.cameras);
  const escalate = useStore((s) => s.escalateCam);
  const user = useSessionUser();
  const canWrite = !!user && WRITE_ROLES.includes(user.role);
  const canBbiw = !!user && BBIW_ROLES.includes(user.role);

  const [modal, setModal] = useState<Modal | null>(null);
  const [bbiwBusy, setBbiwBusy] = useState(false);

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
              {/* feed area */}
              <div
                style={{
                  position: "relative",
                  aspectRatio: "16 / 10",
                  background:
                    "repeating-linear-gradient(45deg,#0a0e14,#0a0e14 8px,#0d121a 8px,#0d121a 16px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent,rgba(0,0,0,.4))" }} />
                <span className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", zIndex: 1 }}>
                  {c.active ? "◉ RTSP FEED" : "NO SIGNAL"}
                </span>
                <div style={{ position: "absolute", top: 7, left: 8, display: "flex", alignItems: "center", gap: 5, zIndex: 1 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone, boxShadow: `0 0 6px ${tone}` }} />
                  <span className="mono" style={{ font: "600 8px var(--font-mono-stack)", letterSpacing: ".5px", color: tone }}>
                    {c.active ? "ONLINE" : "OFFLINE"}
                  </span>
                </div>
                <div className="mono" style={{ position: "absolute", top: 7, right: 8, font: "500 8px var(--font-mono-stack)", color: "var(--faint)", zIndex: 1 }}>
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
                  {(canWrite || canBbiw) && (
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      {canBbiw && <BbiwCameraButton cameraId={c.id} />}
                      {canWrite && (
                        <>
                          <SnapshotButton cameraId={c.id} />
                          <IconBtn onClick={() => setModal({ kind: "edit", cam: c })} title="Edit"><Pencil size={12} strokeWidth={1.9} /></IconBtn>
                          <IconBtn onClick={() => remove(c)} title="Delete" tone="var(--danger)"><Trash2 size={12} strokeWidth={1.9} /></IconBtn>
                        </>
                      )}
                    </div>
                  )}
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
                return (
                  <button
                    key={rule}
                    onClick={() => toggle(rule)}
                    className="mono"
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
                    {rule}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 7, gap: 10 }}>
              <span className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)" }}>
                {allowed.size ? "Only checked rule types forwarded." : "All rule types — none selected = all allowed."}
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
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="LONGITUDE (OPTIONAL)">
                <input className="input mono" type="number" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="—" />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="LATITUDE (OPTIONAL)">
                <input className="input mono" type="number" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="—" />
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
