"use client";

import { Fragment, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import FacilityKmlMap, { type NodeMarker } from "@/components/map/FacilityKmlMap";
import { useStore } from "@/lib/store";
import { createNode, updateNode } from "@/lib/api/nodes";
import type { AccessNode } from "@/lib/types";

const STEPS = ["Location", "Parent", "Details"];

export default function NodeWizard({ onClose, editNode }: { onClose: () => void; editNode?: AccessNode }) {
  const nodes = useStore((s) => s.nodes);
  const refreshNodes = useStore((s) => s.refreshNodes);

  const nodeMarkers: NodeMarker[] = useMemo(
    () =>
      nodes
        .filter((n) => n.latitude != null && n.longitude != null)
        .map((n) => ({ id: n.id, name: n.name, lat: n.latitude as number, lng: n.longitude as number })),
    [nodes]
  );

  const isEdit = !!editNode;
  const [step, setStep] = useState(0);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(
    editNode && editNode.latitude != null && editNode.longitude != null
      ? { lat: editNode.latitude, lng: editNode.longitude }
      : null
  );
  const [parentId, setParentId] = useState<string>(editNode?.parent ?? "");
  const [name, setName] = useState(editNode?.name ?? "");
  const [location, setLocation] = useState(editNode?.loc ?? "");
  const [level, setLevel] = useState(editNode?.level ?? 0);
  const [maxTries, setMaxTries] = useState(editNode?.max ?? 3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // in edit mode a node keeps its location — allow skipping straight to details
  const parentOptions = useMemo(() => nodes.filter((n) => n.id !== editNode?.id), [nodes, editNode]);

  const next = () => {
    if (step === 0 && !loc) return setError("Click a point on the map to set the node's location.");
    setError("");
    setStep((s) => Math.min(2, s + 1));
  };
  const back = () => {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  };

  const submit = async () => {
    if (!name.trim()) return setError("A node name is required.");
    setBusy(true);
    setError("");
    try {
      if (isEdit && editNode) {
        await updateNode(editNode.id, {
          name: name.trim(),
          location: location.trim() || null,
          ...(loc ? { latitude: loc.lat, longitude: loc.lng } : {}),
          level: Number(level) || 0,
          parentId: parentId || null,
          maxFailedTries: Number(maxTries) || 3,
        });
      } else {
        await createNode({
          name: name.trim(),
          ...(location.trim() ? { location: location.trim() } : {}),
          ...(loc ? { latitude: loc.lat, longitude: loc.lng } : {}),
          level: Number(level) || 0,
          ...(parentId ? { parentId } : {}),
          maxFailedTries: Number(maxTries) || 3,
        });
      }
      await refreshNodes();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${isEdit ? "update" : "create"} node`);
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number) => n.toFixed(6);

  return (
    <div onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 720, maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        {/* header + step rail */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>{isEdit ? "Edit Access Node" : "New Access Node"}</span>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <Fragment key={label}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span className="mono" style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", font: "600 9px var(--font-mono-stack)", ...(active ? { background: "var(--accent)", color: "#04120f" } : done ? { background: "rgba(63,185,80,0.15)", color: "var(--ok)", border: "1px solid var(--ok)" } : { background: "var(--bg)", color: "var(--faint)", border: "1px solid var(--border2)" }) }}>
                      {done ? "✓" : i + 1}
                    </span>
                    <span style={{ font: "600 10.5px var(--font-sans-stack)", color: active ? "var(--fg)" : done ? "var(--ok)" : "var(--faint)" }}>{label}</span>
                  </div>
                  {i < 2 && <span style={{ width: 26, height: 1.5, borderRadius: 2, background: done ? "var(--ok)" : "var(--border2)" }} />}
                </Fragment>
              );
            })}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {/* STEP 1 — LOCATION */}
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.5 }}>
                Click the point on the facility map where this access node sits. The coordinates are captured for the map layer.
              </div>
              <FacilityKmlMap height={340} showSwitcher={false} onMapClick={(lat, lng) => setLoc({ lat, lng })} marker={loc} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                <div>
                  <div className="field-label" style={{ marginBottom: 5 }}>LATITUDE</div>
                  <input className="input mono" type="number" value={loc?.lat ?? ""} onChange={(e) => setLoc((p) => ({ lat: Number(e.target.value), lng: p?.lng ?? 0 }))} placeholder="click map or enter" />
                </div>
                <div>
                  <div className="field-label" style={{ marginBottom: 5 }}>LONGITUDE</div>
                  <input className="input mono" type="number" value={loc?.lng ?? ""} onChange={(e) => setLoc((p) => ({ lat: p?.lat ?? 0, lng: Number(e.target.value) }))} placeholder="click map or enter" />
                </div>
              </div>
              {loc && (
                <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={12} strokeWidth={2} /> {fmt(loc.lat)}, {fmt(loc.lng)}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — PARENT */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.5 }}>
                Optionally attach this node under a parent — a child inherits access from its parent. Click a node on the map, or pick from the list. Leave empty for a root node.
              </div>
              <FacilityKmlMap height={320} showSwitcher={false} marker={loc} nodeMarkers={nodeMarkers} selectedNodeId={parentId || null} onNodeClick={(id) => setParentId((p) => (p === id ? "" : id))} />
              <div>
                <div className="field-label" style={{ marginBottom: 5 }}>PARENT NODE (OPTIONAL)</div>
                <select className="select" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">— none (root node) —</option>
                  {parentOptions.map((n) => (
                    <option key={n.id} value={n.id}>{"— ".repeat(n.level)}{n.name}</option>
                  ))}
                </select>
              </div>
              {nodeMarkers.length === 0 && nodes.length > 0 && (
                <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>
                  Existing nodes have no coordinates yet, so none appear on the map — use the dropdown.
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — DETAILS */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 13, maxWidth: 460, margin: "0 auto" }}>
              <div>
                <div className="field-label" style={{ marginBottom: 5 }}>NODE NAME</div>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Server Room" autoFocus />
              </div>
              <div>
                <div className="field-label" style={{ marginBottom: 5 }}>LOCATION DESCRIPTION (OPTIONAL)</div>
                <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bldg A — L2 secure" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                <div>
                  <div className="field-label" style={{ marginBottom: 5 }}>LEVEL</div>
                  <input className="input mono" type="number" value={level} onChange={(e) => setLevel(Number(e.target.value))} />
                </div>
                <div>
                  <div className="field-label" style={{ marginBottom: 5 }}>MAX FAILED TRIES</div>
                  <input className="input mono" type="number" value={maxTries} onChange={(e) => setMaxTries(Number(e.target.value))} />
                </div>
              </div>
              <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", lineHeight: 1.55, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 11px" }}>
                {loc ? `Location: ${fmt(loc.lat)}, ${fmt(loc.lng)}` : "Location: not set"}
                {" · "}
                Parent: {parentId ? nodes.find((n) => n.id === parentId)?.name ?? "—" : "root node"}
              </div>
            </div>
          )}

          {error && (
            <div role="alert" style={{ marginTop: 12, font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>⚠ {error}</div>
          )}
        </div>

        {/* footer */}
        <div style={{ padding: "13px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={step === 0 ? onClose : back} className="btn" style={{ height: 40, padding: "0 16px", font: "600 11px var(--font-mono-stack)", letterSpacing: ".5px" }}>
            {step === 0 ? "CANCEL" : "BACK"}
          </button>
          <div style={{ flex: 1 }} />
          {step < 2 ? (
            <button onClick={next} className="btn-accent" style={{ height: 40, padding: "0 22px", font: "600 11px var(--font-mono-stack)", letterSpacing: ".6px" }}>
              {step === 1 ? (parentId ? "NEXT" : "SKIP →") : "NEXT →"}
            </button>
          ) : (
            <button onClick={submit} disabled={busy} className="btn-accent" style={{ height: 40, padding: "0 22px", font: "600 11px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
              {busy ? (isEdit ? "SAVING…" : "CREATING…") : isEdit ? "SAVE CHANGES" : "CREATE NODE"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
