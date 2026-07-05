"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Radio, ShieldCheck, Trash2, Truck } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSessionUser } from "@/lib/auth";
import { PanelHeader } from "@/components/ui";
import FacilityMap from "@/components/FacilityMap";
import {
  assignTracker,
  createAsset,
  deleteAsset,
  revokeTracker,
  setAssetProtocolRules,
  updateAsset,
} from "@/lib/api/assets";
import type { Asset } from "@/lib/types";

const WRITE_ROLES = ["super_admin", "security_manager", "security_personnel", "staff_admin"];

type Modal =
  | { kind: "create" }
  | { kind: "edit"; asset: Asset }
  | { kind: "tracker"; asset: Asset }
  | { kind: "rules"; asset: Asset };

const refresh = () => useStore.getState().refreshAssets();

export default function AssetsPage() {
  const assets = useStore((s) => s.assets);
  const toggleProto = useStore((s) => s.toggleProto);
  const reportBreach = useStore((s) => s.reportBreach);
  const user = useSessionUser();
  const canWrite = !!user && WRITE_ROLES.includes(user.role);

  const [modal, setModal] = useState<Modal | null>(null);

  const remove = async (a: Asset) => {
    if (!confirm(`Delete asset "${a.name}"? This cannot be undone.`)) return;
    try {
      await deleteAsset(a.id);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete asset");
    }
  };

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
      {/* TRACKED ASSETS */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Truck size={16} strokeWidth={1.9} color="var(--warn)" />
          <span className="panel-title">TRACKED ASSETS</span>
          <span className="panel-sub">· {assets.length} registered</span>
          <div style={{ flex: 1 }} />
          {canWrite && (
            <button onClick={() => setModal({ kind: "create" })} className="btn-accent" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={13} strokeWidth={2.4} /> NEW ASSET
            </button>
          )}
        </div>
        {assets.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--faint)", font: "500 12px var(--font-sans-stack)" }}>No assets registered yet.</div>
        ) : (
          assets.map((a) => {
            const active = a.protoActive;
            return (
              <div key={a.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--panel2)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Truck size={17} strokeWidth={1.6} color="var(--warn)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>{a.name}</div>
                    <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)", marginTop: 1 }}>
                      {a.type} · {a.plate || "no plate"} · tracker {a.tracker || "— no tracker —"}
                    </div>
                  </div>
                  <span
                    className="pill mono"
                    style={
                      active
                        ? { color: "var(--ok)", border: "1px solid var(--ok)" }
                        : { color: "var(--faint)", border: "1px solid var(--border2)" }
                    }
                  >
                    {active ? "PROTOCOL ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                  <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--muted)" }}>
                    Speed limit <span style={{ color: "var(--fg)" }}>{a.speed ? a.speed + " km/h" : "—"}</span>
                  </div>
                  <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--muted)" }}>
                    Boundary <span style={{ color: "var(--fg)" }}>{a.geo ? "Geofenced" : "—"}</span>
                  </div>
                  <div style={{ flex: 1 }} />
                  {canWrite && (
                    <>
                      <IconBtn onClick={() => setModal({ kind: "edit", asset: a })} title="Edit"><Pencil size={12} strokeWidth={1.9} /></IconBtn>
                      <IconBtn onClick={() => setModal({ kind: "tracker", asset: a })} title="Tracker" tone={a.tracker ? "var(--ok)" : "var(--muted)"}><Radio size={12} strokeWidth={1.9} /></IconBtn>
                      <IconBtn onClick={() => setModal({ kind: "rules", asset: a })} title="Protocol rules"><ShieldCheck size={12} strokeWidth={1.9} /></IconBtn>
                      <IconBtn onClick={() => remove(a)} title="Delete" tone="var(--danger)"><Trash2 size={12} strokeWidth={1.9} /></IconBtn>
                    </>
                  )}
                  {a.tracker && canWrite && (
                    <button
                      onClick={() => toggleProto(a.id)}
                      className="btn"
                      style={{ font: "600 9.5px var(--font-mono-stack)", padding: "5px 11px", borderRadius: 6 }}
                    >
                      {active ? "Deactivate" : "Activate"}
                    </button>
                  )}
                  {active && canWrite && (
                    <button
                      onClick={() => reportBreach(a.id)}
                      className="mono"
                      style={{ font: "600 9.5px var(--font-mono-stack)", padding: "5px 11px", borderRadius: 6, cursor: "pointer", border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)" }}
                    >
                      ⚑ REPORT BREACH
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* LIVE POSITIONS */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <PanelHeader title="LIVE POSITIONS" />
        <div style={{ padding: 14 }}>
          <FacilityMap />
          <div style={{ font: "500 10px var(--font-sans-stack)", color: "var(--muted)", lineHeight: 1.55, marginTop: 12 }}>
            Protocol interlocks: a protocol requires an assigned GPS tracker; an asset with an active protocol cannot be deleted; a breach raises an ASRS incident automatically.
          </div>
        </div>
      </div>

      {modal?.kind === "create" && (
        <AssetForm onClose={() => setModal(null)} onSaved={() => setModal(null)} />
      )}
      {modal?.kind === "edit" && (
        <AssetForm asset={modal.asset} onClose={() => setModal(null)} onSaved={() => setModal(null)} />
      )}
      {modal?.kind === "tracker" && (
        <TrackerModal asset={modal.asset} onClose={() => setModal(null)} onSaved={() => setModal(null)} />
      )}
      {modal?.kind === "rules" && (
        <RulesModal asset={modal.asset} onClose={() => setModal(null)} onSaved={() => setModal(null)} />
      )}
    </div>
  );
}

// ---- create / edit form ----
function AssetForm({ asset, onClose, onSaved }: { asset?: Asset; onClose: () => void; onSaved: () => void }) {
  const editing = !!asset;
  const [name, setName] = useState(asset?.name ?? "");
  const [type, setType] = useState(asset?.type ?? "");
  const [isVehicle, setIsVehicle] = useState(asset?.vehicle ?? false);
  const [plateNumber, setPlate] = useState(asset?.plate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return setError("Name is required.");
    setBusy(true);
    setError("");
    try {
      const body = {
        name: name.trim(),
        type: type.trim() || undefined,
        isVehicle,
        plateNumber: plateNumber.trim() || undefined,
      };
      if (editing) await updateAsset(asset!.id, body);
      else await createAsset(body);
      await refresh();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save asset");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={editing ? `Edit · ${asset!.name}` : "New asset"} onClose={() => !busy && onClose()}>
      <Field label="NAME">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Patrol Vehicle 3" autoFocus />
      </Field>
      <Field label="TYPE (OPTIONAL)">
        <input className="input" value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. vehicle, equipment, personnel" />
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={isVehicle} onChange={(e) => setIsVehicle(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
        <span style={{ font: "500 12px var(--font-sans-stack)", color: "var(--fg)" }}>Vehicle</span>
        <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>· enables a plate number</span>
      </label>
      <Field label="PLATE NUMBER (OPTIONAL)">
        <input className="input mono" value={plateNumber} onChange={(e) => setPlate(e.target.value)} placeholder={isVehicle ? "e.g. GR-1234-25" : "vehicles only"} disabled={!isVehicle} style={!isVehicle ? { opacity: 0.5 } : undefined} />
      </Field>
      {error && <Err>{error}</Err>}
      <button onClick={submit} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
        {busy ? "SAVING…" : editing ? "SAVE CHANGES" : "CREATE ASSET"}
      </button>
    </Shell>
  );
}

// ---- tracker assign / revoke ----
function TrackerModal({ asset, onClose, onSaved }: { asset: Asset; onClose: () => void; onSaved: () => void }) {
  const [serial, setSerial] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const assign = async () => {
    if (!serial.trim()) return setError("Tracker serial is required.");
    setBusy(true);
    setError("");
    try {
      await assignTracker(asset.id, serial.trim());
      await refresh();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign tracker");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    setError("");
    try {
      await revokeTracker(asset.id);
      await refresh();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke tracker");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={`Tracker · ${asset.name}`} onClose={() => !busy && onClose()}>
      {asset.tracker ? (
        <>
          <div>
            <div className="mono" style={{ font: "600 8.5px var(--font-mono-stack)", letterSpacing: ".6px", color: "var(--faint)", marginBottom: 5 }}>ASSIGNED TRACKER</div>
            <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--fg)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 11px" }}>{asset.tracker}</div>
          </div>
          <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", lineHeight: 1.5 }}>
            Revoking the tracker also disables any active protocol on this asset.
          </div>
          {error && <Err>{error}</Err>}
          <button onClick={revoke} disabled={busy} className="btn" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", border: "1px solid var(--danger)", color: "var(--danger)", background: "transparent", opacity: busy ? 0.7 : 1 }}>
            {busy ? "REVOKING…" : "REVOKE TRACKER"}
          </button>
        </>
      ) : (
        <>
          <Field label="TRACKER SERIAL (UNIQUE)">
            <input className="input mono" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. GPS-00A7" autoFocus />
          </Field>
          {error && <Err>{error}</Err>}
          <button onClick={assign} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
            {busy ? "ASSIGNING…" : "ASSIGN TRACKER"}
          </button>
        </>
      )}
    </Shell>
  );
}

// ---- protocol rules ----
function RulesModal({ asset, onClose, onSaved }: { asset: Asset; onClose: () => void; onSaved: () => void }) {
  const [speed, setSpeed] = useState(asset.speed != null ? String(asset.speed) : "");
  const [minLat, setMinLat] = useState("");
  const [maxLat, setMaxLat] = useState("");
  const [minLng, setMinLng] = useState("");
  const [maxLng, setMaxLng] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const boundsRaw = [minLat, maxLat, minLng, maxLng].map((v) => v.trim());
    const anyBound = boundsRaw.some((v) => v !== "");
    const allBound = boundsRaw.every((v) => v !== "");
    if (anyBound && !allBound) return setError("Provide all four bounds, or leave them all empty.");

    const nums = boundsRaw.map(Number);
    if (anyBound && nums.some((n) => Number.isNaN(n))) return setError("Bounds must be valid numbers.");
    const speedNum = speed.trim() === "" ? null : Number(speed);
    if (speedNum != null && (Number.isNaN(speedNum) || speedNum < 0)) return setError("Speed limit must be a non-negative number.");

    setBusy(true);
    setError("");
    try {
      await setAssetProtocolRules(asset.id, {
        speedLimitKph: speedNum,
        locationBounds: allBound
          ? { minLat: nums[0], maxLat: nums[1], minLng: nums[2], maxLng: nums[3] }
          : null,
      });
      await refresh();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set protocol rules");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={`Protocol rules · ${asset.name}`} onClose={() => !busy && onClose()}>
      <Field label="SPEED LIMIT (KPH) — EMPTY TO CLEAR">
        <input className="input mono" type="number" value={speed} onChange={(e) => setSpeed(e.target.value)} placeholder="e.g. 40" autoFocus />
      </Field>
      <div>
        <div className="field-label" style={{ marginBottom: 5 }}>LOCATION BOUNDS (GEOFENCE) — ALL FOUR OR NONE</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <BoundInput label="MIN LAT" value={minLat} onChange={setMinLat} />
          <BoundInput label="MAX LAT" value={maxLat} onChange={setMaxLat} />
          <BoundInput label="MIN LNG" value={minLng} onChange={setMinLng} />
          <BoundInput label="MAX LNG" value={maxLng} onChange={setMaxLng} />
        </div>
      </div>
      <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", lineHeight: 1.5 }}>
        Rules only — activate the protocol separately (needs a tracker).
      </div>
      {error && <Err>{error}</Err>}
      <button onClick={submit} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
        {busy ? "SAVING…" : "SAVE RULES"}
      </button>
    </Shell>
  );
}

function BoundInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mono" style={{ font: "600 8px var(--font-mono-stack)", letterSpacing: ".5px", color: "var(--faint)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
        <MapPin size={9} strokeWidth={2} /> {label}
      </div>
      <input className="input mono" type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder="—" />
    </div>
  );
}

// ---- shared bits (copied from acms page) ----
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
